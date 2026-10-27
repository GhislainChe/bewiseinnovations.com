// Local container/socket only. No remote URL or credential argument is accepted.
import { spawn } from 'node:child_process';
const target=process.env.BEWISE_TEST_DATABASE_CONTAINER;
if(target && !/^bewise-mfa-preflight-[0-9]{13}$/.test(target)) throw new Error('Only a disposable local preflight container is allowed');
const container=target || 'supabase_db_bewiseinnovations.com';
const database=target ? 'mfa_preflight' : 'postgres';
export function localSql(statement) {
  return new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,'psql','-h','/var/run/postgresql','-U','postgres','-d',database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',error='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('Bounded local SQL timeout'));},30000);
    child.stdout.on('data',b=>{output+=b.toString();});child.stderr.on('data',b=>{error+=b.toString();});
    child.on('error',()=>{clearTimeout(timer);reject(new Error('Local database unavailable'));});
    child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(output.trim());else reject(new Error(`Local SQL rejected (${error.match(/ERROR:\s*([A-Z0-9]{5})/)?.[1]??'unknown'})`));});
    child.stdin.on('error',()=>{});child.stdin.end(statement);
  });
}
export async function localScalar(statement) {
  return (await localSql(statement)).split(/\r?\n/).filter(Boolean).at(-1);
}
