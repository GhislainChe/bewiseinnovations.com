// Real LOCAL Auth/TOTP/JWT/DB and Edge. Never accepts a remote database target.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID,randomBytes,createHmac} from "node:crypto";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {createServerClient} from "@supabase/ssr";
import {localSql,localScalar} from "./local-database.mjs";
import {projectsRepository} from "../src/features/projects/server";
import {BusinessConflictError} from "../src/features/services/server";
import {testProjectsBrowser} from "./test-projects-browser.mjs";
const env:Record<string,string>={};for(const line of readFileSync('.env.integration.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/,'$2');}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:65421');Object.assign(process.env,{BUSINESS_BACKEND_ENABLED:'local',NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL});
const api=env.NEXT_PUBLIC_SUPABASE_URL,admin=createClient(api,env.SUPABASE_AUTH_STORE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ids:string[]=[],sid=randomUUID(),rid=randomUUID(),prefix='LOCAL PROJECT '+randomUUID();let checks=0,phase='local setup',created=false;
const ok=(v:unknown)=>{assert.ok(v);checks++;},eq=(a:unknown,b:unknown)=>{assert.deepEqual(a,b);checks++;};
function totp(secret:string){const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0;const bytes=[];for(const c of secret.toUpperCase().replace(/=+$/,'')){value=(value<<5)|abc.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}value&=(1<<bits)-1;}const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),o=d[19]&15;return String((d.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
async function identity(role:string|null,active=true){const email=randomUUID()+'@example.invalid',password='Local1!'+randomBytes(24).toString('base64url');const made=await admin.auth.admin.createUser({email,password,email_confirm:true});if(made.error)throw new Error("LOCAL Identity API "+made.error.status+" "+made.error.code);ok(made.data.user);const id=made.data.user!.id;ids.push(id);
 if(role)await localSql(`insert into public.team_profiles(id,full_name,is_active) values('${id}','Synthetic projects staff',${active});insert into public.team_role_assignments select '${id}',id from public.roles where code='${role}';`);
 const cookies=new Map<string,{value:string;options?:{path?:string}}>();const client=createServerClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies].map(([name,c])=>({name,value:c.value})),setAll:values=>{for(const c of values)cookies.set(c.name,c);}}});const login=await client.auth.signInWithPassword({email,password});if(login.error)throw new Error("LOCAL Login API "+login.error.status+" "+login.error.code);ok(!login.error);return {id,client,cookies};}
async function mfa(client:SupabaseClient){const e=await client.auth.mfa.enroll({factorType:'totp'});ok(!e.error&&e.data);ok(!(await client.auth.mfa.challengeAndVerify({factorId:e.data!.id,code:totp(e.data!.totp.secret)})).error);}
async function main(){
 await localSql(`insert into public.services(id,slug,title,description,status,accepting_requests) values('${sid}','projects-${sid}','Synthetic projects service','Local only','published',true);insert into business_private.project_requests(id,service_id,service_snapshot,full_name,email,whatsapp,requirements,status,consent_version,idempotency_hash,payload_hash) values('${rid}','${sid}','{"title":"Test service"}','Private synthetic client','private-client@example.invalid','+237600000000','A synthetic approved project request.','discussing','local-test',decode('${randomBytes(32).toString('hex')}','hex'),decode('${randomBytes(32).toString('hex')}','hex'));`);created=true;
 phase='disposable LOCAL identity creation';const tech=await identity('technical_lead'),ops=await identity('operations_lead'),content=await identity('content_community_lead'),owner=await identity('platform_owner'),unassigned=await identity(null),inactive=await identity('technical_lead',false);
 const tr=projectsRepository(tech.client),or=projectsRepository(ops.client),cr=projectsRepository(content.client);
 phase='real password-only AAL1 denial';await assert.rejects(tr.list());checks++;ok((await tech.client.rpc('list_staff_projects')).error);
 const original=(await tech.client.auth.getSession()).data.session!.access_token;const parts=original.split('.');parts[1]=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(parts[1],'base64url').toString()),aal:'aal2'})).toString('base64url');
 const forged=await fetch(api+'/rest/v1/rpc/list_staff_projects',{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+parts.join('.'),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});eq(forged.status,401);
 phase='real verified AAL2 and request release';for(const who of [tech,ops,content,owner,unassigned,inactive])await mfa(who.client);
 await assert.rejects(projectsRepository(unassigned.client).overview());checks++;await assert.rejects(projectsRepository(inactive.client).list());checks++;
 await assert.rejects(cr.list());checks++;
 const project={id:null,version:0,kind:'client',requestId:rid,name:prefix+' Confidential client title',description:'Approved technical details only',status:'active',startsOn:null,endsOn:null};
 await assert.rejects(tr.save(project));checks++;
 const release={requestId:rid,requestVersion:1,releaseVersion:0,scope:'Approved limited engineering scope',evidence:'Synthetic independently verified client reply',agreement:'Synthetic agreed request',attested:true,active:true};
 await assert.rejects(tr.release(release));checks++;await assert.rejects(or.release({...release,attested:false}));checks++;
 const intake=await or.release(release);eq(intake.contact_email,'private-client@example.invalid');eq(await localScalar(`select status||':'||version from business_private.project_requests where id='${rid}';`),'approved:2');
 const safeIntakes=await tr.intakes();ok(safeIntakes.some(i=>i.requestId===rid));ok(!JSON.stringify(safeIntakes).includes('private-client'));
 phase='concurrent project create';const made=await Promise.allSettled([tr.save(project),tr.save(project)]);eq(made.filter(r=>r.status==='fulfilled').length,1);eq(made.filter(r=>r.status==='rejected').length,1);
 const pid=await localScalar(`select id from business_private.projects where request_id='${rid}';`);assert.ok(pid);let p=await tr.detail(pid);eq(p.progress.percent,null);
 const internal=await tr.save({...project,kind:'internal',requestId:null,name:prefix+' Internal'});eq(internal.kind,'internal');
 phase='milestone concurrency and idempotent notification';const milestone={projectId:pid,version:p.version,id:null,title:'Technical implementation',internalNotes:'Do not send internal notes',clientSummary:'Your first reviewed deliverable is complete.',state:'completed',exclusionReason:''};
 const saved=await Promise.allSettled([tr.milestone(milestone),tr.milestone(milestone)]);eq(saved.filter(r=>r.status==='fulfilled').length,1);p=await tr.detail(pid);eq(p.milestones.length,1);eq(p.progress.percent,100);eq(p.notifications.length,0);
 const notify={projectId:pid,version:p.version,milestoneId:p.milestones[0].id,attested:true};const both=await Promise.all([tr.notify(notify),tr.notify(notify)]);eq(both[0].notifications.length,1);eq(both[1].notifications.length,1);p=await tr.detail(pid);
 eq(await localScalar(`select count(*) from public.audit_logs where resource_id='${pid}' and action='project.progress_prepared';`),'1');
 const preview=await tr.preview(pid,p.notifications[0].id);eq(preview.sendingEnabled,false);ok(!preview.html.includes('Do not send internal notes'));ok(preview.html.includes('first reviewed deliverable'));
 await assert.rejects(tr.notify({...notify,projectId:internal.id,version:internal.version}));checks++;
 await assert.rejects(or.save(project));checks++;ok((await or.detail(pid)).milestones.length===1);await assert.rejects(cr.detail(pid));checks++;
 ok(!JSON.stringify(await cr.overview()).includes('Confidential client title'));ok(!JSON.stringify(await cr.overview()).includes('private-client'));
 eq((await projectsRepository(owner.client).detail(pid)).id,pid);
 phase='invalid linkage and stale writes';await assert.rejects(tr.save({...project,id:pid,version:1,name:'Stale'}),BusinessConflictError);checks++;
 await assert.rejects(tr.reorder({projectId:pid,version:p.version,ids:[]}));checks++;
 const raw=await tech.client.schema('business_private').from('projects').select('id');ok(raw.error); // Schema remains outside Data API.
 phase='actual local protected browser UI';const browserChecks=await testProjectsBrowser({tech,ops,content,clientId:pid,prefix});console.log(`PASS: ${browserChecks} real LOCAL Chromium project UI, mobile and role-boundary checks.`);
 phase='post-browser exact contact and no-sender checks';eq(await localScalar(`select count(*) from business_private.project_notification_intents where project_id='${pid}';`),'2');
 eq(await localScalar(`select count(*) from business_private.project_notification_intents n join business_private.projects p on p.id=n.project_id where p.created_by='${tech.id}' and p.kind='internal';`),'0');
 await or.release({...release,requestVersion:2,releaseVersion:1,active:false,attested:false});await assert.rejects(tr.notify({...notify,version:(await tr.detail(pid)).version}));checks++;
 console.log(`PASS: ${checks} real LOCAL Auth/TOTP/JWT/project RPC, concurrency and contact-isolation checks. No emails sent.`);
}
void main().catch((error)=>{if(/^Local SQL rejected \([A-Z0-9]{5}\)$/.test(error?.message??""))console.error(error.message);if(/^LOCAL (Identity|Login) API [0-9]+ [a-z_]+$/.test(error?.message??""))console.error(error.message);console.error('Local projects integration failed at '+phase+'; provider details, credentials and records suppressed.');process.exitCode=1;}).finally(async()=>{
 if(created){const actors=ids.length?ids.map(id=>`'${id}'`).join(','):'null';await localSql(`begin;set local lock_timeout='10s';
 select id from business_private.projects where created_by in (${actors}) for update;
 delete from business_private.project_notification_intents where project_id in(select id from business_private.projects where created_by in (${actors}));
 delete from business_private.project_milestones where project_id in(select id from business_private.projects where created_by in (${actors}));
 delete from public.audit_logs where actor_id in (${actors});
 delete from business_private.projects where created_by in (${actors});delete from business_private.project_intakes where request_id='${rid}';
 delete from business_private.project_requests where id='${rid}' and service_id='${sid}';delete from public.services where id='${sid}' and slug='projects-${sid}';commit;`);}
 for(const id of ids){const r=await admin.auth.admin.deleteUser(id);if(r.error)process.exitCode=1;}
});
