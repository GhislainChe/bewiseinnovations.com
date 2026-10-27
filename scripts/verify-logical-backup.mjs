// Restores only into a new network-isolated container, never the development DB.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { backupExpectedVersions, verifyRestoredCatalog } from './logical-backup-expectations.mjs';
import { restoreSecuritySql, compareRestoredSecurity, policyEquivalenceSql } from './restore-security-snapshot.mjs';
const run = promisify(execFile);
const root = path.resolve('.supabase/backups');
const directory = path.resolve(process.argv[2] ?? '');
const expectedVersions = backupExpectedVersions(process.argv[3]);
if (!directory.startsWith(`${root}${path.sep}`)) throw new Error('Expected a private backup directory.');
const manifest = JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8'));
if (manifest.project !== 'onfxxtvfprjnqsxdmhkp' || manifest.files.length !== 3) throw new Error('Incomplete or wrong-project backup.');
for (const file of manifest.files) {
  if (!['schema.sql','data.sql','roles.sql'].includes(file.name)) throw new Error('Unexpected backup file.');
  const contents = readFileSync(path.join(directory,file.name));
  if (!contents.length || contents.length !== file.bytes || createHash('sha256').update(contents).digest('hex') !== file.sha256) throw new Error('Backup integrity failure.');
}
const container = `bewise-backup-verify-${Date.now()}`;
const image = 'public.ecr.aws/supabase/postgres:17.11.0.003';
const env = {...process.env, POSTGRES_PASSWORD:randomBytes(32).toString('hex')};
let created = false;
let step = 'start_isolated_container';
const report = { container, project:manifest.project, expectedVersions, startedAt:new Date().toISOString(), restored:false };
// Preserve prior failed diagnostics; the SQL backup and manifest never change.
const attemptDirectory=path.join(directory,`verification-${Date.now()}`);
mkdirSync(attemptDirectory);
if(existsSync(path.join(directory,'restore-verification.json'))) copyFileSync(path.join(directory,'restore-verification.json'),path.join(attemptDirectory,'previous-verification.json'));
report.artifactsDirectory=attemptDirectory;
async function docker(args, timeout=30000) { return run('docker',args,{env,timeout,maxBuffer:2000000}); }
async function sql(statement, database='postgres') {
  return docker(['exec',container,'psql','-U','supabase_admin','-d',database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',statement]);
}
try {
  await docker(['run','-d','--name',container,'--network','none','--env','POSTGRES_PASSWORD',image]);
  created = true;
  let ready = false;
  for (let i=0;i<30;i++) {
    // Initialization uses a socket-only temporary server. TCP listening begins
    // only after init scripts finish and the final server starts.
    try {
      const logs = await docker(['logs',container],5000);
      if ((logs.stdout+logs.stderr).includes('listening on IPv4 address')) {
        await docker(['exec',container,'pg_isready','-U','supabase_admin'],5000);
        ready=true; break;
      }
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready.');
  step = 'prepare_isolated_platform_roles';
  // The logical role dump expects this managed platform role; vanilla image lacks it.
  await sql("do $$ begin if not exists(select from pg_roles where rolname='supabase_realtime_admin') then create role supabase_realtime_admin; end if; end $$;");
  await sql('create database backup_verify;');
  for (const name of ['roles.sql','schema.sql','data.sql']) {
    step = `restore_${name.replace('.sql','')}`;
    await docker(['cp',path.join(directory,name),`${container}:/tmp/${name}`]);
    const result = await docker(['exec',container,'psql','-U','supabase_admin','-d',name==='roles.sql'?'postgres':'backup_verify','-X','-v','ON_ERROR_STOP=1','--file',`/tmp/${name}`],60000);
    writeFileSync(path.join(attemptDirectory,`restore-${name}.log`),result.stdout+result.stderr);
    console.log(`Restored ${name} with ON_ERROR_STOP.`);
  }
  step = 'catalog_counts_sql';
  const {stdout} = await sql(`select json_build_object(
    'postgres_major',current_setting('server_version_num')::int / 10000,
    'rbac_tables',(select count(*) from information_schema.tables where table_schema='public' and table_name in ('team_profiles','roles','permissions','role_permissions','team_role_assignments','audit_logs')),
    'roles',(select count(*) from public.roles),
    'permissions',(select count(*) from public.permissions),
    'mappings',(select count(*) from public.role_permissions),
    'profiles',(select count(*) from public.team_profiles),
    'assignments',(select count(*) from public.team_role_assignments),
    'auth_users',(select count(*) from auth.users),
    'storage_objects',(select count(*) from storage.objects),
    'auth_tables',(select count(*) from information_schema.tables where table_schema='auth'),
    'storage_tables',(select count(*) from information_schema.tables where table_schema='storage'),
    'auth_security_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname in ('auth_flow_tickets','auth_recovery_buckets') and c.relkind='r'),
    'auth_security_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname in ('auth_flow_tickets','auth_recovery_buckets') and c.relkind='r' and c.relrowsecurity),
    'mfa_policies',(select count(*) from pg_policies where schemaname='public' and policyname in ('team_profiles_mfa','roles_mfa','permissions_mfa','role_permissions_mfa','team_role_assignments_mfa','audit_logs_mfa') and permissive='RESTRICTIVE'),
    'mfa_helper',to_regprocedure('app_private.has_aal2_session()') is not null,
    'migration_versions',(select json_agg(version order by version) from supabase_migrations.schema_migrations));`,'backup_verify');
  const counts = JSON.parse(stdout.trim());
  report.counts=counts;
  step = 'catalog_counts_assertions';
  verifyRestoredCatalog(counts,expectedVersions);
  const baselineFile = path.join(directory,'hosted-before.json');
  if (existsSync(baselineFile)) {
    const baseline = JSON.parse(readFileSync(baselineFile,'utf8'));
    assert.deepEqual(baseline.migrations,expectedVersions);
    step = 'security_snapshot_sql';
    const {stdout:securityOutput}=await sql(restoreSecuritySql,'backup_verify');
    const security=JSON.parse(securityOutput.trim());
    writeFileSync(path.join(attemptDirectory,'restored-security.json'),JSON.stringify(security,null,2));
    step = 'resolved_policy_catalog_sql';
    const {stdout:evidenceOutput}=await sql(policyEquivalenceSql(baseline.policies),'backup_verify');
    const policyEvidence=JSON.parse(evidenceOutput.split(/\r?\n/).find(line=>line.startsWith('{')));
    writeFileSync(path.join(attemptDirectory,'policy-evidence.json'),JSON.stringify(policyEvidence,null,2));
    step = 'security_snapshot_comparison';
    compareRestoredSecurity(security,baseline,policyEvidence);
    for(const name of ['roles','permissions','mappings','profiles','assignments','auth_users']) assert.equal(counts[name],baseline.counts[name]);
    report.securityMatchesSource=true;
    report.verifiedPolicyCount=security.policies.length;
    report.verifiedFunctionCount=security.functions.length;
    console.log('Restored RLS/policies, function definitions, API grants and exact permission mappings match the hosted baseline.');
  }
  report.restored=true;
  report.counts=counts;
  report.completedStep='all_restore_checks_passed';
  console.log('Isolated restore verified:',JSON.stringify(counts));
} catch(error) {
  report.failedStep=step;
  report.sqlState=String(error.stderr??'').match(/ERROR:\s*([A-Z0-9]{5}):/)?.[1]??null;
  report.errorLine=String(error.stderr??'').match(/LINE ([0-9]+):/)?.[1]??null;
  writeFileSync(path.join(attemptDirectory,'restore-error.log'),`${error.stderr ?? error.message ?? 'Restore failed'}`);
  if(created) { const logs=await docker(['logs',container]).catch(()=>null); if(logs) writeFileSync(path.join(attemptDirectory,'restore-container.log'),logs.stdout+logs.stderr); }
  console.error(`Restore verification failed at ${step}; SQLSTATE ${report.sqlState??'unavailable'}; line ${report.errorLine??'unavailable'}. Raw details remain private.`);
  process.exitCode=1;
} finally {
  report.completedAt=new Date().toISOString();
  writeFileSync(path.join(directory,'restore-verification.json'),JSON.stringify(report,null,2));
  if(created) await docker(['rm','-f','-v',container]);
}
