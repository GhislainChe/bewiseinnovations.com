// Bounded, non-mutating network/CLI probes. No backup, token exchange or writes.
import { Resolver, lookup } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ref='onfxxtvfprjnqsxdmhkp';
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref) throw new Error('Wrong linked project');
const pool=new URL(readFileSync('supabase/.temp/pooler-url','utf8').trim());
if(!decodeURIComponent(pool.username).endsWith(`.${ref}`)||pool.port!=='5432'||!pool.hostname.endsWith('.pooler.supabase.com')) throw new Error('Unexpected session-pooler metadata');
const cli=path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
if(!existsSync(cli)) throw new Error('Installed CLI binary unavailable');
const safeCode=error=>/^[A-Z_0-9]+$/.test(error?.code??'')?error.code:'unclassified';
const emit=value=>console.log(JSON.stringify({at:new Date().toISOString(),...value}));

async function addresses(hostname,type) {
  const resolver=new Resolver({timeout:3000,tries:1});
  const timer=setTimeout(()=>resolver.cancel(),4000);
  try {return {addresses:await resolver[type](hostname),error:null};}
  catch(error){return {addresses:[],error:safeCode(error)};}
  finally{clearTimeout(timer);}
}
async function systemAddresses(hostname) {
  let timer;
  try {
    return {addresses:await Promise.race([lookup(hostname,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(),{code:'SYSTEM_DNS_TIMEOUT'})),4000);})]),error:null};
  }catch(error){return {addresses:[],error:safeCode(error)};}
  finally{clearTimeout(timer);}
}
function socketProbe(hostname,address,port,family,postgresTls=false) {
  return new Promise(resolve=>{
    let secure,finished=false,tcp=false;
    const socket=net.connect({host:address,port,family});
    const timer=setTimeout(()=>finish({error:'bounded_timeout'}),6000);
    function finish(extra){if(finished)return;finished=true;clearTimeout(timer);secure?.destroy();socket.destroy();resolve({family,tcp,...extra});}
    function startTls(){secure=tls.connect({socket,servername:hostname,rejectUnauthorized:true});secure.once('secureConnect',()=>finish({tls:true,certificateVerified:secure.authorized,protocol:secure.getProtocol()}));secure.once('error',e=>finish({tls:false,error:safeCode(e)}));}
    socket.once('connect',()=>{tcp=true;if(postgresTls){const request=Buffer.alloc(8);request.writeInt32BE(8,0);request.writeInt32BE(80877103,4);socket.write(request);socket.once('data',data=>{if(data[0]===83)startTls();else finish({postgresSslAccepted:false});});}else startTls();});
    socket.once('error',e=>finish({error:safeCode(e)}));
    socket.once('end',()=>finish({error:'connection_ended'}));
  });
}
function httpProbe(label,url,headers={},family) {
  return new Promise(resolve=>{
    let done=false;
    const started=Date.now();
    const finish=extra=>{if(done)return;done=true;clearTimeout(timer);resolve({label,elapsedMs:Date.now()-started,...extra});};
    const request=https.get(url,{headers,...(family?{family}:{})},response=>{
      let body='';response.on('data',chunk=>{if(body.length<65536)body+=chunk;else response.destroy();});
      response.on('end',()=>{let code;try{const parsed=JSON.parse(body);if(/^[A-Z0-9_]{1,40}$/.test(parsed.code??''))code=parsed.code;}catch{}finish({status:response.statusCode,reachable:true,...(code?{errorCode:code}:{})});});
      response.on('error',error=>finish({reachable:false,error:safeCode(error)}));
    });
    const timer=setTimeout(()=>{request.destroy();finish({reachable:false,error:'bounded_timeout'});},10000);
    request.on('error',error=>finish({reachable:false,error:safeCode(error)}));
  });
}
function cliAuthentication() {
  return new Promise(resolve=>{
    const started=Date.now();
    const child=execFile(cli,['projects','list','--output','json'],{timeout:20000,maxBuffer:300000,windowsHide:true},(error,stdout,stderr)=>{
      if(error){const text=(stderr??'').toLowerCase();const category=error.killed?'bounded_timeout':/access token not provided|not logged in|no access token/.test(text)?'missing_cli_authentication':/unauthorized|invalid.*token|401/.test(text)?'cli_authentication_rejected':/403|forbidden/.test(text)?'cli_access_denied':/lookup|no such host/.test(text)?'dns':/timeout|deadline/.test(text)?'network_timeout':'unclassified_cli_failure';resolve({elapsedMs:Date.now()-started,authenticatedProjectList:false,category});return;}
      try{const parsed=JSON.parse(stdout);const rows=Array.isArray(parsed)?parsed:parsed.projects;resolve({elapsedMs:Date.now()-started,authenticatedProjectList:true,expectedProjectVisible:Array.isArray(rows)&&rows.some(p=>p.id===ref||p.ref===ref)});}
      catch{resolve({elapsedMs:Date.now()-started,authenticatedProjectList:'response_unclassified'});}
    });
    child.stdin?.end();
  });
}
const source=readFileSync('.env.local','utf8');
function publicValue(name){return source.split(/\r?\n/).find(l=>l.startsWith(name+'='))?.slice(name.length+1).trim().replace(/^(["'])(.*)\1$/,'$2');}
if(publicValue('NEXT_PUBLIC_SUPABASE_URL')!==`https://${ref}.supabase.co`) throw new Error('Wrong public project URL');
const key=publicValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if(!key?.startsWith('sb_publishable_'))throw new Error('Publishable configuration unavailable');

emit({project:ref,operation:'read_only_connectivity_diagnostics',backupAttempted:false});
const tasks=[...['api.supabase.com',`${ref}.supabase.co`,pool.hostname,`db.${ref}.supabase.co`].map(async hostname=>{
  const [v4,v6]=await Promise.all([addresses(hostname,'resolve4'),addresses(hostname,'resolve6')]);
  const system=await systemAddresses(hostname);
  const port=hostname.endsWith('.supabase.co')&&hostname.startsWith('db.')||hostname===pool.hostname?5432:443;
  emit({probe:'dns',hostname,ipv4Count:v4.addresses.length,ipv6Count:v6.addresses.length,ipv4Error:v4.error,ipv6Error:v6.error});
  emit({probe:'system_dns',hostname,ipv4Count:system.addresses.filter(a=>a.family===4).length,ipv6Count:system.addresses.filter(a=>a.family===6).length,error:system.error});
  const first4=system.addresses.find(a=>a.family===4)?.address??v4.addresses[0],first6=system.addresses.find(a=>a.family===6)?.address??v6.addresses[0];
  const connections=await Promise.all([first4&&socketProbe(hostname,first4,port,4,port===5432),first6&&socketProbe(hostname,first6,port,6,port===5432)].filter(Boolean));
  emit({probe:port===5432?'postgres_tcp_tls':'https_tcp_tls',hostname,port,connections});
}),cliAuthentication().then(result=>emit({probe:'cli_authentication',...result})),
...[
  ['management_default','https://api.supabase.com/v1/projects',{},undefined],
  ['management_ipv4','https://api.supabase.com/v1/projects',{},4],
  ['project_rest',`https://${ref}.supabase.co/rest/v1/`,{apikey:key},undefined],
  ['project_auth_health',`https://${ref}.supabase.co/auth/v1/health`,{apikey:key},undefined],
].map(args=>httpProbe(...args).then(result=>emit({probe:'http',...result})))];
await Promise.allSettled(tasks);
emit({operation:'diagnostics_complete',writesAttempted:false});
