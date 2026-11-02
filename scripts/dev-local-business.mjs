// Local-only development entry point. Never imports hosted-test credentials.
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
const values={};
for(const line of readFileSync('.env.integration.local','utf8').split(/\r?\n/)){
 const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/,'$2');
}
if(values.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:65421'||!values.SUPABASE_AUTH_STORE_SECRET_KEY||!values.AUTH_FLOW_SIGNING_SECRET||process.env.VERCEL||process.env.NETLIFY)throw new Error('Local business configuration unavailable.');
const env={...process.env,...values,NODE_ENV:'development',BUSINESS_BACKEND_ENABLED:'local',
 SUPABASE_BUSINESS_INGRESS_SECRET_KEY:values.SUPABASE_AUTH_STORE_SECRET_KEY,
 // Stable domain-separated LOCAL development key; no quota reset on ordinary restart.
 BUSINESS_SUBMISSION_SECRET:createHmac('sha256',values.AUTH_FLOW_SIGNING_SECRET).update('bewise-local-business-v1').digest('hex'),
 AUTH_TRUSTED_ORIGIN:'http://localhost:3022',AUTH_RECOVERY_MODE:'disabled',AUTH_RECOVERY_TEST_ORIGIN:'',AUTH_COOKIE_DIAGNOSTICS:'0',AUTH_LOCAL_PREFLIGHT:'0'};
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3022'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
// Do not forward request URLs, provider payloads or inherited diagnostics.
child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
child.on('error',()=>{console.error('Local business server could not start.');process.exitCode=1;});
child.on('exit',code=>{console.log('Local business server stopped.');process.exitCode=code??0;});
console.log('Local-only business server starting at http://localhost:3022. Request logs suppressed; recovery disabled.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
