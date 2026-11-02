import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {cleanupStaffFixture} from './local-staff-fixture-cleanup.mjs';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {localSql,localScalar} from './local-database.mjs';
const require=createRequire(import.meta.url),WebSocket=require('next/dist/compiled/ws');
const env={};for(const line of readFileSync('.env.integration.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/,'$2');}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:65421');
const app='http://localhost:3022',api=env.NEXT_PUBLIC_SUPABASE_URL;
const admin=createClient(api,env.SUPABASE_AUTH_STORE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const sid=randomUUID(),bid=randomUUID(),rid=randomUUID(),aid=randomUUID(),ref='BWR-'+randomUUID().replaceAll('-',''),ids=[];
const browserPath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let emailHtml='';
let browser,socket,phase='local prerequisites',checks=0,seq=0,created=false;const calls=new Map();
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert.ok(v);checks++;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFile(path){const end=Date.now()+10000;while(!existsSync(path)&&Date.now()<end)await delay(100);assert.ok(existsSync(path),'Browser download not saved');}
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{calls.delete(id);reject(new Error('Browser timeout'));},15000);calls.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function js(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Browser script failed');return r.result.value;}
async function clickButton(label){
 const selector='Array.from(document.querySelectorAll("button")).find(b=>b.innerText==='+JSON.stringify(label)+')';
 await until('!!('+selector+') && !('+selector+').disabled');
 await js('('+selector+').click()');
}
async function until(expression){const end=Date.now()+35000;while(Date.now()<end){if(await js(expression))return;await delay(200);}throw new Error('Browser condition timeout');}
async function visit(path){
 // A same-path reload must replace the old document before assertions continue.
 await js('window.__bewiseNavigationSentinel=true');
 await cdp('Page.navigate',{url:app+path});
 await until('typeof window.__bewiseNavigationSentinel==="undefined" && location.pathname==='+JSON.stringify(path.split('?')[0])+' && document.readyState==="complete"');
}
function totp(secret){const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0;const bytes=[];for(const c of secret.toUpperCase().replace(/=+$/,'')){value=(value<<5)|abc.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}value&=(1<<bits)-1;}const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const d=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),o=d[19]&15;return String((d.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
async function identity(role){const email=randomUUID()+'@example.invalid',password='Local!'+randomBytes(24).toString('base64url');const made=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ok(!made.error);const id=made.data.user.id;ids.push(id);await localSql(`insert into public.team_profiles(id,full_name) values('${id}','Synthetic dashboard staff');insert into public.team_role_assignments select '${id}',id from public.roles where code='${role}';`);
const cookies=new Map(),client=createServerClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies].map(([name,c])=>({name,value:c.value})),setAll:values=>{for(const c of values)cookies.set(c.name,c);}}});assert.ok(!(await client.auth.signInWithPassword({email,password})).error);return {id,client,cookies};}
async function browserIdentity(who){await cdp('Network.clearBrowserCookies');await cdp('Network.setCookies',{cookies:[...who.cookies].filter(([,c])=>c.value).map(([name,c])=>({name,value:c.value,domain:'localhost',path:c.options?.path??'/',secure:false,sameSite:'Lax'}))});}
async function mfa(who){const e=await who.client.auth.mfa.enroll({factorType:'totp'});assert.ok(!e.error);assert.ok(!(await who.client.auth.mfa.challengeAndVerify({factorId:e.data.id,code:totp(e.data.totp.secret)})).error);}
async function browserApi(query,body){return js(`(async()=>{const r=await fetch('/internal/business-api'+${JSON.stringify(query)},{${body?`method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))},`:''}cache:'no-store',credentials:'same-origin',mode:'cors'});return {status:r.status,data:await r.json()};})()`);}
try{
 eq((await fetch(app+'/api/services',{signal:AbortSignal.timeout(45000)})).status,200);
 await localSql(`insert into public.services(id,slug,title,description,status,accepting_requests) values('${sid}','dashboard-${sid}','LOCAL TEST Dashboard Service','Synthetic dashboard description','published',true);
 insert into public.service_budget_options(id,service_id,label,currency,min_minor,max_minor,sort_order) values('${bid}','${sid}','LOCAL TEST Budget','XAF',50,100,10);
 insert into business_private.project_requests(id,reference,service_id,service_snapshot,budget_snapshot,full_name,email,whatsapp,requirements,consent_version,idempotency_hash,payload_hash) values('${rid}','${ref}','${sid}','{"title":"LOCAL TEST Dashboard Service"}','{"label":"LOCAL TEST Budget","currency":"XAF"}','Synthetic Dashboard Visitor','dashboard@example.invalid','+237600000000','Synthetic local dashboard request requirements.','local-test',decode('${randomBytes(32).toString('hex')}','hex'),decode('${randomBytes(32).toString('hex')}','hex'));
 insert into business_private.request_attachments(id,request_id,object_key,display_name,mime_type,byte_size,sha256_hex) values('${aid}','${rid}','${rid}/${aid}','local-test.pdf','application/pdf',50,repeat('d',64));`);created=true;
 const profile=mkdtempSync(resolve(tmpdir(),'bewise-dashboard-browser-'));browser=spawn(browserPath,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error()),15000);browser.stderr.on('data',b=>{output+=b;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const port=new URL(endpoint).port,tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));socket.on('message',b=>{const m=JSON.parse(String(b));if(m.id){const c=calls.get(m.id);if(c){clearTimeout(c.timer);calls.delete(m.id);if(m.error)c.reject(new Error('Browser protocol failure'));else c.resolve(m.result);}}});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 phase='anonymous page and API denial';await visit('/internal/requests');ok(await js('document.body.innerText.includes("Staff access required")'));eq((await browserApi('?view=requests')).status,403);
 const ops=await identity('operations_lead');await browserIdentity(ops);phase='real AAL1 denial';await visit('/internal/requests');ok(await js('document.body.innerText.includes("Staff access required")'));eq((await browserApi('?view=requests')).status,403);
 await mfa(ops);await browserIdentity(ops);phase='AAL2 inbox';await visit('/internal/requests');await until('document.body.innerText.includes("Synthetic Dashboard Visitor")');
 phase='exact reference search';await js(`(()=>{const e=document.getElementById('reference');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(ref)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(150);await js('document.querySelector("form").requestSubmit()');await until('document.body.innerText.includes("Search complete.")');
 phase='request detail';eq(await js('document.querySelectorAll("button strong").length'),1);await js('Array.from(document.querySelectorAll("button")).find(b=>b.innerText.includes("Synthetic Dashboard Visitor")).click()');await until('document.body.innerText.includes("dashboard@example.invalid")');
 ok(await js('document.body.innerText.includes("local-test.pdf")'));ok(await js('!document.body.innerText.includes("Download clean file")'));ok(await js('document.body.innerText.includes("Not sure yet")'));
 phase='request status';await clickButton('Update request status');await until('document.body.innerText.includes("Workspace up to date.")');eq(await localScalar(`select status from business_private.project_requests where id='${rid}';`),'triaging');
 phase='stale version rejection';const stale=await browserApi('',{operation:'status',input:{id:rid,version:1,status:'discussing'}});console.log('Stale request update HTTP '+stale.status);eq(stale.status,409);
 eq(await localScalar(`select count(*) from public.audit_logs where resource_id='${rid}' and action='request.status_changed';`),'1');
 phase='quotation preparation UI';
 await js('Array.from(document.querySelectorAll("button")).find(b=>b.innerText.includes("Synthetic Dashboard Visitor")).click()');await until('document.body.innerText.includes("dashboard@example.invalid")');
 await clickButton('Prepare Quotation');await until('document.body.innerText.includes("Save Draft")');
 const fillQuote=async(label,value)=>js(`(()=>{const l=Array.from(document.querySelectorAll('label')).find(l=>Array.from(l.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('')===${JSON.stringify(label)});const e=l.querySelector('textarea,input');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 phase='quotation field entry';for(const [label,value] of Object.entries({'Scope of work':'Approved browser-test scope','Deliverables':'Reviewed local implementation','Estimated delivery timeline':'Three weeks','Payment terms':'Operations entered test terms','Valid until':new Date(Date.now()+30*86400000).toISOString().slice(0,10)}))await fillQuote(label,value);
 phase='quotation line items';await clickButton('Add line item');await fillQuote('Item 1 description','Explicit browser test item');await fillQuote('Unit amount (FCFA)','50000');
 await js('Array.from(document.querySelectorAll("label")).find(l=>l.textContent.includes("I confirm the founders")).querySelector("input").click()');
 phase='quotation draft save';await clickButton('Save Draft');await until('document.body.innerText.includes("Draft saved. Review before finalizing.")');
 eq(await localScalar(`select (content->'items'->0->>'unitAmount') from business_private.quotation_revisions where quotation_id=(select id from business_private.quotations where request_id='${rid}');`),'50000');
 phase='quotation final review';await clickButton('Review and Finalize');await until('document.body.innerText.includes("Final review")');
 phase='quotation finalization';await clickButton('Finalize this revision');await until('document.body.innerText.includes("Quotation finalized. This revision is immutable.")');
 eq(await localScalar(`select state from business_private.quotation_revisions where quotation_id=(select id from business_private.quotations where request_id='${rid}');`),'finalized');
 eq(await localScalar(`select count(*) from public.audit_logs where action='quotation.finalized' and resource_id in (select r.id::text from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where q.request_id='${rid}');`),'1');
 phase='quotation and request downloads';const downloads=resolve('.supabase/browser-tests/downloads/'+rid);mkdirSync(downloads,{recursive:true});await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await clickButton('Download Quotation PDF');await until('document.body.innerText.includes("Private PDF download prepared.")');await waitFile(resolve(downloads,'bewise-quotation.pdf'));ok(readFileSync(resolve(downloads,'bewise-quotation.pdf')).subarray(0,5).toString()==='%PDF-');
 await clickButton('Download Request PDF');await delay(700);await until('document.body.innerText.includes("Private PDF download prepared.")');await waitFile(resolve(downloads,'bewise-internal-project-request.pdf'));ok(readFileSync(resolve(downloads,'bewise-internal-project-request.pdf')).subarray(0,5).toString()==='%PDF-');
 phase='WhatsApp assisted delivery UI';
 await clickButton('Prepare delivery');await until('document.body.innerText.includes("Preparation ready. Nothing has been sent.")');
 const clickDeliveryLabel=async text=>js("(()=>{const s=Array.from(document.querySelectorAll('section')).find(s=>s.getAttribute('aria-label')==='Quotation delivery');Array.from(s.querySelectorAll('label')).find(l=>l.textContent.includes("+JSON.stringify(text)+")).querySelector('input').click();})()");
 await clickDeliveryLabel('I reviewed this submitted recipient');
 const waHref=await js('Array.from(document.querySelectorAll("a")).find(a=>a.textContent==="Open WhatsApp conversation").href');eq(new URL(waHref).origin,'https://wa.me');ok(!waHref.includes(ref));ok(!waHref.includes('50000')); // Do not navigate externally.
 await clickButton('Download exact attachment');await until('document.body.innerText.includes("Exact finalized revision downloaded.")');
 const quotationNumber=await localScalar("select number from business_private.quotations where request_id='"+rid+"';");await waitFile(resolve(downloads,quotationNumber+'-r1.pdf'));ok(readFileSync(resolve(downloads,quotationNumber+'-r1.pdf')).subarray(0,5).toString()==='%PDF-');
 await clickDeliveryLabel('I manually sent this exact PDF revision');
 await js('(()=>{const b=Array.from(document.querySelectorAll("button")).find(b=>b.innerText==="Record manual dispatch");b.click();b.click();})()');await until('document.body.innerText.includes("Staff-confirmed manual dispatch recorded.")');
 eq(await localScalar("select count(*) from public.audit_logs where action='quotation.dispatch_recorded' and resource_id in (select id::text from business_private.quotation_deliveries where request_id='"+rid+"' and channel='whatsapp');"),'1');
 phase='branded disabled email preview';
 await js('(()=>{const s=Array.from(document.querySelectorAll("section")).find(s=>s.getAttribute("aria-label")==="Quotation delivery");const e=s.querySelector("select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(e,"email");e.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await clickButton('Prepare delivery');await until('!!document.querySelector("iframe")');
 ok(await js('document.body.innerText.includes("Email sending is disabled.")'));eq(await js('document.querySelector("iframe").getAttribute("sandbox")'),'');
 emailHtml=await js('document.querySelector("iframe").srcdoc');ok(emailHtml.includes('data:image/png;base64,'));ok(!emailHtml.includes('http://localhost'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);
 await js('document.querySelector("iframe").scrollIntoView()');writeFileSync('.supabase/browser-tests/email-preview-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await clickButton('Record needs follow-up');await until('document.body.innerText.includes("Follow-up recorded.")');eq(await localScalar("select status from business_private.quotation_deliveries where request_id='"+rid+"' and channel='email';"),'NEEDS_FOLLOW_UP');
 phase='new quotation revision';await clickButton('Prepare new revision');await until('document.body.innerText.includes("Draft · revision 2")');
 eq(await localScalar(`select count(*) from business_private.quotation_revisions where quotation_id=(select id from business_private.quotations where request_id='${rid}');`),'2');
 eq(await js('Array.from(document.querySelectorAll("label")).find(l=>l.textContent.includes("I confirm the founders")).querySelector("input").checked'),false);
 await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);
 phase='quotation mobile layout';await js('Array.from(document.querySelectorAll("section")).find(s=>s.getAttribute("aria-label")==="Request documents and quotations").scrollIntoView()');mkdirSync('.supabase/browser-tests',{recursive:true});writeFileSync('.supabase/browser-tests/quotation-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 phase='budget editing';await visit('/internal/services');await until('document.body.innerText.includes("LOCAL TEST Dashboard Service")');
 await js('Array.from(document.querySelectorAll("section")).find(s=>s.querySelector("h2")?.textContent==="LOCAL TEST Dashboard Service").querySelector("summary").click()');
 ok(await js('Array.from(document.querySelectorAll("section")).find(s=>s.querySelector("h2")?.textContent==="LOCAL TEST Dashboard Service").querySelector("fieldset").disabled'));
 await js(`(()=>{const f=Array.from(document.querySelectorAll('form')).find(f=>f.querySelector('input[name=label]')?.value==='LOCAL TEST Budget');const e=f.querySelector('input[name=min]');e.value='75';f.requestSubmit();})()`);await until('document.body.innerText.includes("Workspace up to date.")');eq(await localScalar(`select min_minor from public.service_budget_options where id='${bid}';`),'75');
 phase='content role boundaries and pause';const content=await identity('content_community_lead');await mfa(content);await browserIdentity(content);await visit('/internal/services');await until('document.body.innerText.includes("LOCAL TEST Dashboard Service")');
 const denied=await browserApi('?view=requests');eq(denied.status,403);
 await js(`(()=>{const s=Array.from(document.querySelectorAll('section')).find(s=>s.querySelector('h2')?.textContent==='LOCAL TEST Dashboard Service');s.querySelector('input[name=accepting]').click();s.querySelector('textarea').value='Locally revised service description';s.querySelector('form').requestSubmit();})()`);await until('document.body.innerText.includes("Workspace up to date.")');eq(await localScalar(`select accepting_requests::text||':'||description from public.services where id='${sid}';`),'false:Locally revised service description');
 eq((await browserApi('',{operation:'budget',input:{id:bid,version:2,serviceId:sid,label:'Forbidden',currency:'XAF',minMinor:75,maxMinor:100,unsure:false,active:true,sort:10}})).status,403);
 await visit('/services');await until('document.body.innerText.includes("Locally revised service description")');ok(await js('document.body.innerText.includes("New requests are currently paused.")'));
 phase='approved public ranges';await visit('/request-a-quote');await until('!!document.getElementById("serviceId")');eq(await js('Array.from(document.getElementById("serviceId").options).filter(o=>o.textContent==="Website Development").length'),1);
 const webId=await localScalar("select id from public.services where slug='website-development';");await js(`(()=>{const e=document.getElementById('serviceId');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(webId)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await until('document.getElementById("budgetOptionId").options.length===7');ok(await js('document.getElementById("budgetOptionId").innerText.includes("50,000")'));ok(await js('document.getElementById("budgetOptionId").innerText.includes("Not sure yet")'));
 phase='technical role denial';const tech=await identity('technical_lead');await mfa(tech);await browserIdentity(tech);await visit('/internal/services');ok(await js('document.body.innerText.includes("Staff access required")'));eq((await browserApi('?view=catalog')).status,403);
 phase='responsive review';await browserIdentity(ops);await visit('/internal/requests');await until('document.body.innerText.includes("Synthetic Dashboard Visitor")');await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);ok(await js('Array.from(document.querySelectorAll("input,select,textarea")).every(e=>e.closest("label")||document.querySelector(`label[for="${e.id}"]`))'));
 await js('Array.from(document.querySelectorAll("button")).filter(b=>b.querySelector("strong")&&!b.innerText.includes("Synthetic Dashboard Visitor")).forEach(b=>b.style.visibility="hidden")');mkdirSync('.supabase/browser-tests',{recursive:true});writeFileSync('.supabase/browser-tests/staff-requests-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await visit('/internal/services');await until('document.body.innerText.includes("Website Development")');writeFileSync('.supabase/browser-tests/staff-services-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 phase='standalone mobile email rendering';
 await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
 const main=await cdp('Page.getFrameTree');await cdp('Page.setDocumentContent',{frameId:main.frameTree.frame.id,html:emailHtml});
 await until('document.images[0]?.complete && document.images[0]?.naturalWidth>0');eq(await js('document.images[0].naturalWidth'),2212);eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);eq(await js('document.scripts.length'),0);
 writeFileSync('.supabase/browser-tests/email-render-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 console.log(`PASS: ${checks} real LOCAL Edge/Next/Auth/MFA/staff RPC and RLS checks. Synthetic identities cleaned; approved catalog preserved.`);
}catch(error){if(error?.code==='ERR_ASSERTION' && [error.actual,error.expected].every(v=>typeof v==='number'||typeof v==='boolean'))console.error(JSON.stringify({actual:error.actual,expected:error.expected}));if(socket){try{console.error(JSON.stringify(await js('({denied:document.body.innerText.includes("Staff access required"),unavailable:document.body.innerText.includes("unavailable"),visitorVisible:document.body.innerText.includes("Synthetic Dashboard Visitor"),searchComplete:document.body.innerText.includes("Search complete."),requestOpened:document.body.innerText.includes("Request opened."),upToDate:document.body.innerText.includes("Workspace up to date."),reviewButtonPresent:Array.from(document.querySelectorAll("button")).some(b=>b.innerText==="Review and Finalize"),reviewDisabled:Array.from(document.querySelectorAll("button")).find(b=>b.innerText==="Review and Finalize")?.disabled,formAlert:!!document.querySelector("form [role=alert]")})')));}catch{}}console.error('Local staff browser checks failed at '+phase+'; credentials and provider output suppressed.');process.exitCode=1;}
finally{if(socket)socket.close();if(browser&&!browser.killed)browser.kill();
 if(created)await cleanupStaffFixture({rid,sid,bid,aid});
 for(const id of ids){await localSql("delete from public.audit_logs where actor_id='"+id+"';");const r=await admin.auth.admin.deleteUser(id);if(r.error)process.exitCode=1;}
}
