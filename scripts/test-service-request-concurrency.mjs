// Real LOCAL DB only; independent fixed-scope quota fixtures, no remote URL accepted.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {localSql,localScalar} from './local-database.mjs';
const sid=randomUUID(),key=randomBytes(32).toString('hex'),emailHash=randomBytes(32).toString('hex'),globalHash=randomBytes(32).toString('hex');
const hashes=[key,emailHash,globalHash];let created=false;
const payload=JSON.stringify({serviceId:sid,budgetOptionId:null,fullName:'Synthetic local visitor',email:'test@example.invalid',whatsapp:'+237600000000',requirements:'Synthetic local concurrency requirement.',preferredDeadline:null,consentVersion:'local-v1'});
const submit=(k,e=emailHash)=>localScalar(`set role service_role;select public.submit_project_request('${payload}'::jsonb,'${k}','${e}','${globalHash}');`);
try{
 await localSql(`insert into public.services(id,slug,title,description,status,accepting_requests) values('${sid}','test-${sid}','Test service','Local concurrency','published',true);`);created=true;
 const same=await Promise.all(Array.from({length:12},()=>submit(key)));
 assert.equal(new Set(same).size,1);assert.equal(await localScalar(`select count(*) from business_private.project_requests where service_id='${sid}';`),'1');
 const keys=Array.from({length:10},()=>randomBytes(32).toString('hex'));hashes.push(...keys);
 const quota=await Promise.allSettled(keys.map(k=>submit(k)));
 assert.equal(quota.filter(x=>x.status==='fulfilled').length,2); // First request used one of three slots.
 const globalKeys=Array.from({length:34},()=>[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')]);hashes.push(...globalKeys.flat());
 const global=await Promise.allSettled(globalKeys.map(([k,e])=>submit(k,e)));
 assert.equal(global.filter(x=>x.status==='fulfilled').length,27); // Exactly 30 global accepted in total.
 assert.equal(await localScalar(`select count(*) from business_private.project_requests where service_id='${sid}';`),'30');
 console.log('PASS: real local concurrency; 12 identical submissions yield one receipt, per-email accepted total 3, global accepted total 30; no overrun.');
}catch{console.error('Local request concurrency failed; raw errors and records suppressed.');process.exitCode=1;}
finally{if(created){await localSql(`delete from business_private.project_requests where service_id='${sid}';delete from public.services where id='${sid}';delete from business_private.submission_buckets where key_hash in (${hashes.map(h=>`decode('${h}','hex')`).join(',')});`);}}
