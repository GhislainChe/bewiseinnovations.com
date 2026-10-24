// Restores only into a new network-isolated container, never the development DB.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
const run = promisify(execFile);
const root = path.resolve('.supabase/backups');
const directory = path.resolve(process.argv[2] ?? '');
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
const report = { container, project:manifest.project, startedAt:new Date().toISOString(), restored:false };
async function docker(args, timeout=30000) { return run('docker',args,{env,timeout,maxBuffer:2000000}); }
async function sql(statement, database='postgres') {
  return docker(['exec',container,'psql','-U','supabase_admin','-d',database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',statement]);
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
  // The logical role dump expects this managed platform role; vanilla image lacks it.
  await sql("do $$ begin if not exists(select from pg_roles where rolname='supabase_realtime_admin') then create role supabase_realtime_admin; end if; end $$;");
  await sql('create database backup_verify;');
  for (const name of ['roles.sql','schema.sql','data.sql']) {
    await docker(['cp',path.join(directory,name),`${container}:/tmp/${name}`]);
    const result = await docker(['exec',container,'psql','-U','supabase_admin','-d',name==='roles.sql'?'postgres':'backup_verify','-X','-v','ON_ERROR_STOP=1','--file',`/tmp/${name}`],60000);
    writeFileSync(path.join(directory,`restore-${name}.log`),result.stdout+result.stderr);
    console.log(`Restored ${name} with ON_ERROR_STOP.`);
  }
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
    'migration_versions',(select json_agg(version order by version) from supabase_migrations.schema_migrations));`,'backup_verify');
  const counts = JSON.parse(stdout.trim());
  if(counts.postgres_major!==17 || counts.rbac_tables!==6 || counts.roles!==4 || counts.permissions!==18 || counts.mappings!==31 || JSON.stringify(counts.migration_versions)!==JSON.stringify(['20261021010000','20261021010100'])) throw new Error('Unexpected restored catalog counts.');
  report.restored=true;
  report.counts=counts;
  console.log('Isolated restore verified:',JSON.stringify(counts));
} catch(error) {
  writeFileSync(path.join(directory,'restore-error.log'),`${error.stderr ?? error.message ?? 'Restore failed'}`);
  if(created) { const logs=await docker(['logs',container]).catch(()=>null); if(logs) writeFileSync(path.join(directory,'restore-container.log'),logs.stdout+logs.stderr); }
  console.error('Restore verification failed; details retained only in the private backup directory.');
  process.exitCode=1;
} finally {
  report.completedAt=new Date().toISOString();
  writeFileSync(path.join(directory,'restore-verification.json'),JSON.stringify(report,null,2));
  if(created) await docker(['rm','-f','-v',container]);
}
