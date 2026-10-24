// Read-only hosted exports. Backup SQL and logs remain in an ignored private directory.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const run = promisify(execFile);
const ref = 'onfxxtvfprjnqsxdmhkp';
if (readFileSync('supabase/.temp/project-ref','utf8').trim() !== ref) throw new Error('Unexpected linked project.');
const acl = await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"(Get-Acl -LiteralPath '.supabase/backups').AreAccessRulesProtected"],{timeout:10000});
if(acl.stdout.trim() !== 'True') throw new Error('Backup parent ACL is not restricted.');
await run('git',['check-ignore','.supabase/backups/privacy-check'],{timeout:10000});
const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const directory = path.join('.supabase','backups',`${ref}-${stamp}`);
mkdirSync(directory);
console.log(`Private backup directory: ${directory}`);
const manifest = { project:ref, createdAt:new Date().toISOString(), files:[] };
for (const [name, options] of [
  ['schema.sql',['--schema','public,app_private,auth,storage,supabase_migrations']],
  ['data.sql',['--schema','public,app_private,auth,storage,supabase_migrations','--data-only','--use-copy']],
  ['roles.sql',['--role-only']],
]) {
  const file = path.join(directory,name);
  console.log(`Starting ${name}; bounded to five minutes.`);
  const started = Date.now();
  try {
    await run('cmd.exe',['/d','/s','/c',`npx supabase db dump --linked ${options.join(' ')} --file ${file}`],{timeout:300000,maxBuffer:1000000});
  } catch (error) {
    console.error(`Export failed: ${name}; ${error.killed ? 'five-minute timeout' : 'CLI error'}. No backup readiness claimed.`);
    process.exitCode = 1;
    break;
  }
  const bytes = statSync(file).size;
  if (!bytes) throw new Error(`Empty backup: ${name}`);
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  manifest.files.push({name,bytes,sha256:hash});
  console.log(`Completed ${name}: ${bytes} bytes in ${Math.round((Date.now()-started)/1000)} seconds.`);
}
writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
if (manifest.files.length === 3) console.log('Exports complete; isolated restore verification is still required.');
