// Real LOCAL Supabase Auth/REST/Storage only. Synthetic records; no email sent.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
import { rename } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localSql, localScalar } from "./local-database.mjs";
import { BusinessConflictError, servicesRepository } from "../src/features/services/server";
import { localRequestIngress, submitRequestHttp } from "../src/features/services/submission";
import { quotationsRepository } from "../src/features/quotations/server";
import { quotationHttp } from "../src/features/quotations/http";
import { deliveryRepository } from "../src/features/delivery/server";
import { renderQuotationPdf } from "../src/features/quotations/pdf";
import { preserveQuotationPdf,pdfHash } from "../src/features/quotations/artifacts";
const env: Record<string, string> = {};
for (const line of readFileSync(".env.integration.local", "utf8").split(/\r?\n/)) {
  const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/,"$2");
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:65421");
process.env.BUSINESS_BACKEND_ENABLED="local";process.env.NEXT_PUBLIC_SUPABASE_URL=env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_BUSINESS_INGRESS_SECRET_KEY=env.SUPABASE_AUTH_STORE_SECRET_KEY;
process.env.BUSINESS_SUBMISSION_SECRET=randomBytes(32).toString("hex");
const api=env.NEXT_PUBLIC_SUPABASE_URL, options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(api,env.SUPABASE_AUTH_STORE_SECRET_KEY,options),anonymous=createClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
const ids:string[]=[],serviceId=randomUUID(),docId=randomUUID(),testSlug='integration-'+randomUUID();
const email=`${randomUUID()}@example.invalid`,key=randomUUID();
let requestId:string|undefined,objectKey:string|undefined,checks=0,phase="local prerequisites";
const quotationRevisionIds:string[]=[];
const eq=(a:unknown,b:unknown)=>{assert.deepEqual(a,b);checks++;};
const ok=(v:unknown)=>{assert.ok(v);checks++;};
function code(secret:string){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,value=0;const bytes=[];for(const c of secret.toUpperCase().replace(/=+$/,"")){value=(value<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}value&=(1<<bits)-1;}const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest(),offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");}
async function staff(role:string){const password='Local!'+randomBytes(24).toString('base64url'),mail=`${randomUUID()}@example.invalid`;const made=await admin.auth.admin.createUser({email:mail,password,email_confirm:true});ok(!made.error&&made.data.user);const id=made.data.user!.id;ids.push(id);await localSql(`insert into public.team_profiles(id,full_name) values('${id}','Synthetic integration staff');insert into public.team_role_assignments select '${id}',id from public.roles where code='${role}';`);const client=createClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);ok(!(await client.auth.signInWithPassword({email:mail,password})).error);return {id,client};}
async function mfa(client:SupabaseClient){const e=await client.auth.mfa.enroll({factorType:'totp'});ok(!e.error&&e.data);ok(!(await client.auth.mfa.challengeAndVerify({factorId:e.data!.id,code:code(e.data!.totp.secret)})).error);}
async function main(){
 eq(await localScalar('select count(*) from public.team_profiles;'),'0');
 await localSql(`insert into public.services(id,slug,title,description,status,accepting_requests) values('${serviceId}','${testSlug}','Synthetic published service','Test only description','published',true);`);
 ok((await servicesRepository(anonymous).publishedCatalog()).some(row=>row.id===serviceId));
 phase='anonymous ingress and replay';
 const payload={serviceId,budgetOptionId:null,fullName:'Synthetic local visitor',email,whatsapp:'+237600000000',requirements:'Real local API test; no customer records.',preferredDeadline:null,consentVersion:'local-v1'};
 const ingress=localRequestIngress();const receipt=await ingress(payload,key);eq(await ingress(payload,key),receipt);ok(/^BWR-[a-f0-9]{32}$/.test(receipt));
 requestId=await localScalar(`select id from business_private.project_requests where service_id='${serviceId}';`);ok(requestId);
 ok((await anonymous.rpc('submit_project_request',{p_payload:payload,p_idempotency_hex:'a'.repeat(64),p_email_hex:'b'.repeat(64),p_global_hex:'c'.repeat(64)})).error);
 ok((await anonymous.rpc('get_project_request',{p_id:requestId})).error);
 const hidden=await fetch(api+'/rest/v1/project_requests?select=id',{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'accept-profile':'business_private'},signal:AbortSignal.timeout(10000)});eq(hidden.status,406);
 phase='real AAL1 and AAL2 operations';
 const ops=await staff('operations_lead');const repo=servicesRepository(ops.client);
 await assert.rejects(repo.getRequest(requestId!));checks++;
 await assert.rejects(quotationsRepository(ops.client).history(requestId!));checks++;
 await assert.rejects(deliveryRepository(ops.client).history(requestId!));checks++;
 await mfa(ops.client);const got=await repo.getRequest(requestId!);eq(got.reference,receipt);eq(got.email,email);ok(!('payload_hash' in got));
 ok((await repo.staffCatalog()).some(row=>row.id===serviceId));
 const changed=await repo.changeRequestStatus({id:requestId,version:1,status:'triaging'});eq(changed.status,'triaging');
 eq((await repo.listRequests(100,receipt)).length,1);
 eq((await repo.listRequests(100,'BWR-'+'0'.repeat(32))).length,0);
 await assert.rejects(repo.listRequests(100,'not-a-reference'));checks++;
 const staleResult = await ops.client.rpc('set_project_request_status',{p_id:requestId,p_version:1,p_status:'discussing'}).abortSignal(AbortSignal.timeout(10000));
 eq(staleResult.error?.code,'PT409');
 await assert.rejects(repo.changeRequestStatus({id:requestId,version:1,status:'discussing'}), BusinessConflictError);checks++;
 const competing = await Promise.allSettled([1,2].map(() => repo.changeRequestStatus({id:requestId,version:2,status:'discussing'})));
 eq(competing.filter(r => r.status === 'fulfilled').length,1);
 eq(competing.filter(r => r.status === 'rejected').length,1);
 phase='content/private boundary';
 const content=await staff('content_community_lead');await mfa(content.client);await assert.rejects(servicesRepository(content.client).getRequest(requestId!));checks++;
 ok((await content.client.rpc('get_project_request',{p_id:requestId})).error);
 await assert.rejects(servicesRepository(content.client).saveBudget({serviceId,label:'Unsure',currency:null,minMinor:null,maxMinor:null,unsure:true,active:true,sort:0}));checks++;
 const saved=await servicesRepository(content.client).saveService({id:serviceId,version:1,slug:testSlug,title:'Revised synthetic service',description:'Plain description',status:'published',acceptingRequests:true});eq(saved.version,2);
 await assert.rejects(servicesRepository(content.client).saveService({id:serviceId,version:1,slug:testSlug,title:'Stale synthetic service',description:'Plain description',status:'published',acceptingRequests:true}),BusinessConflictError);checks++;
 const budget=await repo.saveBudget({serviceId,label:'Unsure',currency:null,minMinor:null,maxMinor:null,unsure:true,active:true,sort:0});eq(budget.service_id,serviceId);
 await repo.saveBudget({id:budget.id,version:1,serviceId,label:'Unsure',currency:null,minMinor:null,maxMinor:null,unsure:true,active:true,sort:10});
 await assert.rejects(repo.saveBudget({id:budget.id,version:1,serviceId,label:'Stale budget',currency:null,minMinor:null,maxMinor:null,unsure:true,active:true,sort:20}),BusinessConflictError);checks++;
 phase='real private Storage policy';
 phase='storage upload'; objectKey=requestId+'/'+docId;
 const bytes=Buffer.from('%PDF-1.4\n% synthetic test bytes only\n');ok(!(await admin.storage.from('project-request-documents').upload(objectKey,bytes,{contentType:'application/pdf'})).error);
 await localSql(`insert into business_private.request_attachments(id,request_id,object_key,display_name,mime_type,byte_size,sha256_hex) values('${docId}','${requestId}','${objectKey}','local.pdf','application/pdf',${bytes.length},repeat('a',64));`);
 phase='quarantined download rejection'; await assert.rejects(repo.attachmentDownload(docId));checks++;
 const metadata=await repo.attachments(requestId!);eq(metadata.length,1);eq(metadata[0].scan_status,'quarantined');ok(!('object_key' in metadata[0]));
 await assert.rejects(servicesRepository(content.client).attachments(requestId!));checks++;
 ok((await ops.client.storage.from('project-request-documents').createSignedUrl(objectKey,60)).error);
 // Synthetic LOCAL scanner result only; this does not implement a malware scanner.
 await localSql(`update business_private.request_attachments set scan_status='clean',scanned_at=now() where id='${docId}';`);
 phase='clean signed download'; const signed=await repo.attachmentDownload(docId);eq(new URL(signed).origin,api);
 const downloaded=await fetch(signed,{signal:AbortSignal.timeout(10000)});eq(downloaded.status,200);eq((await downloaded.arrayBuffer()).byteLength,bytes.length);
 ok((await content.client.storage.from('project-request-documents').createSignedUrl(objectKey,60)).error);
 await localSql(`update public.team_profiles set is_active=false where id='${ops.id}';`);
 await assert.rejects(repo.getRequest(requestId!));checks++;
 await assert.rejects(quotationsRepository(ops.client).history(requestId!));checks++;
 ok((await ops.client.rpc('get_project_request',{p_id:requestId})).error);
 phase='HTTP contract with real local ingress';
 const req=new Request('http://localhost:3000/api/project-requests',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000','content-type':'application/json','idempotency-key':key},body:JSON.stringify(payload)});
 const response=await submitRequestHttp(req,{env:{...process.env,NODE_ENV:'development',AUTH_TRUSTED_ORIGIN:'http://localhost:3000'},ingress});eq(response.status,202);eq((await response.json()).reference,receipt);
 eq(await localScalar(`select count(*) from business_private.project_requests where service_id='${serviceId}';`),'1');
 phase='real quotation permissions and draft creation';
 await localSql(`update public.team_profiles set is_active=true where id='${ops.id}';`);
 const quotes=quotationsRepository(ops.client);
 await assert.rejects(quotationsRepository(anonymous).create({requestId}));checks++;
 await assert.rejects(quotationsRepository(content.client).history(requestId!));checks++;
 await assert.rejects(quotationsRepository(content.client).requestPdf(requestId!));checks++;
 const drafts=await Promise.all([quotes.create({requestId}),quotes.create({requestId})]);eq(drafts[0].id,drafts[1].id);
 const draft=drafts[0];quotationRevisionIds.push(draft.id);eq(draft.document.total,0);
 await assert.rejects(quotes.finalize({id:draft.id,version:1}));checks++;
 const quoteContent={...draft.document.content,scope:'Approved local test scope',deliverables:'A tested local deliverable',timeline:'Three weeks after agreed start',paymentTerms:'Terms entered by Operations for testing only',validUntil:new Date(Date.now()+30*86400000).toISOString().slice(0,10),exclusions:'Hosting excluded',teamAgreement:true,items:[{description:'Explicit implementation item',quantity:2,unitAmount:50000}]};
 const savedQuote=await quotes.save({id:draft.id,version:1,content:quoteContent});eq(savedQuote.document.total,100000);
 await assert.rejects(quotes.save({id:draft.id,version:1,content:quoteContent}),BusinessConflictError);checks++;
 phase='real concurrent quotation finalization and immutable PDF';
 const finalized=await Promise.allSettled([1,2].map(()=>quotes.finalize({id:draft.id,version:2})));
 eq(finalized.filter(x=>x.status==='fulfilled').length,1);eq(finalized.filter(x=>x.status==='rejected').length,1);
 eq((await quotes.get(draft.id)).state,'finalized');
 eq(await localScalar(`select count(*) from public.audit_logs where action='quotation.finalized' and resource_id='${draft.id}';`),'1');
 const pdf=await quotes.quotationPdf(draft.id);ok(pdf.length>1000);ok((await PDFDocument.load(pdf)).getPageCount()>=1);
 const reqPdf=await quotes.requestPdf(requestId!);ok(reqPdf.length>1000);
 mkdirSync('.supabase/pdf-review',{recursive:true});writeFileSync('.supabase/pdf-review/quotation.pdf',pdf);writeFileSync('.supabase/pdf-review/request.pdf',reqPdf);
 await assert.rejects(quotationsRepository(content.client).quotationPdf(draft.id));checks++;
 await assert.rejects(quotes.save({id:draft.id,version:3,content:quoteContent}),BusinessConflictError);checks++;
 phase='new quotation revision and HTTP export';
 const next=await quotes.create({requestId,baseId:draft.id});quotationRevisionIds.push(next.id);eq(next.revision,2);eq(next.document.content.teamAgreement,false);
 const savedNext=await quotes.save({id:next.id,version:1,content:{...quoteContent,items:[{description:'Explicit revised amount',quantity:1,unitAmount:150000}]}});eq(savedNext.document.total,150000);
 await quotes.finalize({id:next.id,version:2});eq((await quotes.history(requestId!)).length,2);
 eq((await quotes.get(draft.id)).document.total,100000);eq(await quotes.quotationPdf(draft.id),pdf);
 process.env.AUTH_TRUSTED_ORIGIN='http://localhost:3022';process.env['NODE'+'_ENV']='development';
 const http=await quotationHttp(new Request('http://localhost:3022/internal/quotation-api',{method:'POST',headers:{host:'localhost:3022',origin:'http://localhost:3022','content-type':'application/json'},body:JSON.stringify({operation:'quotation-pdf',input:{id:draft.id}})}),async()=>quotes);
 eq(http.status,200);eq(http.headers.get('content-type'),'application/pdf');eq(new Uint8Array(await http.arrayBuffer()),new Uint8Array(pdf));
 phase='genuine caller delivery preparation and exact revision binding';
 const dispatch=deliveryRepository(ops.client);
 await assert.rejects(deliveryRepository(content.client).history(requestId!));checks++;
 await assert.rejects(deliveryRepository(anonymous).prepare({revisionId:draft.id,channel:'email'}));checks++;
 const wa=await dispatch.prepare({revisionId:draft.id,channel:'whatsapp'});eq(wa.recipient,payload.whatsapp);eq(wa.status,'READY');
 eq((await dispatch.prepare({revisionId:draft.id,channel:'whatsapp'})).id,wa.id);
 const waPreview=await dispatch.preview(wa.id);eq(waPreview.sendingEnabled,false);eq(waPreview.attachment.sha256,pdfHash(pdf));eq(waPreview.attachmentAvailable,true);
 eq((await dispatch.attachment(wa.id)).bytes,pdf);
 const confirmation={id:wa.id,version:1,eventKey:randomUUID(),status:'MANUALLY_SENT',notes:'Synthetic manually confirmed dispatch; no actual message.',attested:true};
 const sameConfirmation=await Promise.all([dispatch.confirm(confirmation),dispatch.confirm(confirmation)]);eq(sameConfirmation[0].version,2);eq(sameConfirmation[1].version,2);eq(sameConfirmation[0].events.length,2);
 await assert.rejects(dispatch.confirm({...confirmation,notes:'Changed payload'}),BusinessConflictError);checks++;
 eq(await localScalar(`select count(*) from public.audit_logs where action='quotation.dispatch_recorded' and resource_id='${wa.id}';`),'1');
 phase='email package disabled and missing artifact follow-up';
 const emailDispatch=await dispatch.prepare({revisionId:next.id,channel:'email'}),emailPackage=await dispatch.emailPackage(emailDispatch.id);
 eq(emailPackage.to,payload.email);eq(emailPackage.sendingEnabled,false);eq(emailPackage.attachments[0].sha256,(await quotes.get(next.id)).pdf_sha256);eq(emailPackage.attachments[1].cid,'bewise-official-logo@bewiseinnovation.com');
 ok(!emailPackage.html.includes('localhost'));ok(emailPackage.html.includes('cid:'));eq(pdfHash(emailPackage.attachments[0].content),emailPackage.attachments[0].sha256);
 const finalNext=await quotes.get(next.id),file=resolve('.supabase/documents/quotations',next.id+'-'+finalNext.pdf_sha256+'.pdf'),missingArtifactPath=file+'.synthetic-missing';
 await rename(file,missingArtifactPath);
 try {
  eq((await dispatch.preview(emailDispatch.id)).attachmentAvailable,false);
  await assert.rejects(dispatch.prepare({revisionId:next.id,channel:'email'}));checks++;
  await assert.rejects(dispatch.confirm({id:emailDispatch.id,version:1,eventKey:randomUUID(),status:'MANUALLY_SENT',notes:'',attested:true}));checks++;
  const needs=await dispatch.confirm({id:emailDispatch.id,version:1,eventKey:randomUUID(),status:'NEEDS_FOLLOW_UP',notes:'Synthetic missing document',attested:false});eq(needs.status,'NEEDS_FOLLOW_UP');
 }finally{await rename(missingArtifactPath,file);}
 eq((await dispatch.preview(emailDispatch.id)).attachmentAvailable,true);
 phase='historical v1 artifact remains exact during branded delivery';
 const legacyId=randomUUID();quotationRevisionIds.push(legacyId);
 await localSql(`insert into business_private.quotation_revisions(id,quotation_id,revision,client_snapshot,request_snapshot,content,template_version) select '${legacyId}',quotation_id,3,client_snapshot,request_snapshot,content,1 from business_private.quotation_revisions where id='${next.id}';`);
 const legacy=await quotes.get(legacyId);eq(legacy.document.templateVersion,1);
 const legacyBytes=await renderQuotationPdf(legacy.document),legacyHash=await preserveQuotationPdf(legacyId,legacyBytes);
 // Synthetic historical fixture only: normal finalization now requires template v2.
 await localSql(`update business_private.quotation_revisions set state='finalized',pdf_sha256='${legacyHash}',finalized_at=now() where id='${legacyId}';`);
 const legacyDispatch=await dispatch.prepare({revisionId:legacyId,channel:'email'});eq((await dispatch.attachment(legacyDispatch.id)).bytes,Buffer.from(legacyBytes));eq(pdfHash(await quotes.quotationPdf(legacyId)),legacyHash);
 eq((await quotes.get(draft.id)).document.templateVersion,2);eq(await quotes.quotationPdf(draft.id),pdf);
 console.log(`PASS: ${checks} real LOCAL Auth/REST/Storage and HTTP-handler checks. No hosted services or real email.`);
}
void main().catch(()=>{console.error('Local services integration failed at '+phase+'; secrets, provider errors and records suppressed.');process.exitCode=1;}).finally(async()=>{
 if(objectKey)await admin.storage.from('project-request-documents').remove([objectKey]);
 if(requestId){
  await localSql(`begin;lock table business_private.quotation_delivery_events in access exclusive mode;alter table business_private.quotation_delivery_events disable trigger freeze_delivery_event;
   delete from public.audit_logs where resource_type='quotation_delivery' and resource_id in (select id::text from business_private.quotation_deliveries where request_id='${requestId}');
   delete from business_private.quotation_delivery_events where delivery_id in (select id from business_private.quotation_deliveries where request_id='${requestId}');alter table business_private.quotation_delivery_events enable trigger freeze_delivery_event;
   delete from business_private.quotation_deliveries where request_id='${requestId}';commit;`);
  // Test-only administrative teardown: lock before disabling the immutability
  // trigger, delete exact synthetic revisions, re-enable before commit. Not an app API.
  await localSql(`begin;lock table business_private.quotation_revisions in access exclusive mode;alter table business_private.quotation_revisions disable trigger freeze_final_quotation;
   delete from public.audit_logs where resource_type='quotation_revision' and resource_id in (select r.id::text from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where q.request_id='${requestId}');
   delete from business_private.quotation_revisions where quotation_id in (select id from business_private.quotations where request_id='${requestId}');alter table business_private.quotation_revisions enable trigger freeze_final_quotation;delete from business_private.quotations where request_id='${requestId}';commit;`);
 }
 const directory=resolve('.supabase/documents/quotations');
 try{for(const file of readdirSync(directory)){if(quotationRevisionIds.some(id=>new RegExp('^'+id+'-[a-f0-9]{64}\\.pdf$').test(file))){const path=resolve(directory,file);if(!path.startsWith(directory+sep))throw new Error();unlinkSync(path);}}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(requestId)await localSql(`delete from public.audit_logs where (resource_type='project_request' and resource_id='${requestId}') or (resource_type='request_attachment' and resource_id='${docId}');delete from business_private.request_attachments where request_id='${requestId}';delete from business_private.project_requests where id='${requestId}';`);
 await localSql(`delete from public.audit_logs where actor_id in (${ids.length?ids.map(id=>`'${id}'`).join(','):'null'});delete from public.service_budget_options where service_id='${serviceId}';delete from public.services where id='${serviceId}';`);
 for(const id of ids){const deleted=await admin.auth.admin.deleteUser(id);if(deleted.error)process.exitCode=1;}
 const hash=(v:string)=>createHmac('sha256',process.env.BUSINESS_SUBMISSION_SECRET!).update(v).digest('hex');
 await localSql(`delete from business_private.submission_buckets where key_hash in (decode('${hash('request-email:'+email)}','hex'),decode('${hash('request-global:v1')}','hex'));`);
});
