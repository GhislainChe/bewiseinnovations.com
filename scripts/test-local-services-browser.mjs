// Real headless Edge + LOCAL Next/API/PostgreSQL. All fixtures are synthetic.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync,readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {localSql,localScalar} from './local-database.mjs';
const require=createRequire(import.meta.url),WebSocket=require('next/dist/compiled/ws');
const app='http://localhost:3022',sid=randomUUID(),other=randomUUID(),draft=randomUUID(),paused=randomUUID(),budget=randomUUID(),otherBudget=randomUUID();
const browserPath=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let browser,socket,phase='setup',created=false,checks=0,posts=0,apiReads=0,networkFailures=0;const exceptionTypes=[];
const calls=new Map();let seq=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const ok=v=>{assert.ok(v);checks++;};const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{calls.delete(id);reject(new Error());},15000);calls.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function js(expression){const result=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error('Browser script '+(result.exceptionDetails.exception?.className??'exception'));return result.result.value;}
async function until(expression){const end=Date.now()+40000;while(Date.now()<end){try{if(await js(expression))return;}catch{}await delay(200);}throw new Error('Browser wait failed');}
async function visit(path){await cdp('Page.navigate',{url:app+path});await until('document.readyState === "complete"');}
async function fill(id,value){await js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);}
try{
 assert.ok(browserPath);const response=await fetch(app+'/api/services',{signal:AbortSignal.timeout(15000)});eq(response.status,200);
 await localSql(`insert into public.services(id,slug,title,description,status,accepting_requests) values
 ('${sid}','test-${sid}','LOCAL TEST — Service Alpha','A synthetic backend description for UI testing.','published',true),
 ('${other}','test-${other}','LOCAL TEST — Service Beta','Another synthetic backend description.','published',true),
 ('${draft}','test-${draft}','LOCAL TEST — Hidden Draft','Must not appear.','draft',false),
 ('${paused}','test-${paused}','LOCAL TEST — Paused','Intake is paused.','published',false);
 insert into public.service_budget_options(id,service_id,label,is_unsure) values
 ('${budget}','${sid}','LOCAL TEST — Alpha discussion',true),('${otherBudget}','${other}','LOCAL TEST — Beta discussion',true);`);created=true;
 mkdirSync('.supabase/browser-tests',{recursive:true});
 // Keep mutable Chromium cache files outside the source watcher to avoid dev reload churn.
 const profile=mkdtempSync(resolve(tmpdir(),'bewise-services-browser-'));
 browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--disable-sync','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error()),15000);browser.stderr.on('data',b=>{output+=b;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const port=new URL(endpoint).port;const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.once('open',r));
 socket.on('message',b=>{const m=JSON.parse(String(b));if(m.method==='Network.loadingFailed')networkFailures++;if(m.method==='Runtime.exceptionThrown')exceptionTypes.push(m.params.exceptionDetails.exception?.className??'unknown');if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='GET'&&new URL(m.params.request.url).pathname==='/api/services')apiReads++;if(m.id){const c=calls.get(m.id);if(c){clearTimeout(c.timer);calls.delete(m.id);if(m.error)c.reject(new Error());else c.resolve(m.result);}}if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='POST'&&new URL(m.params.request.url).pathname==='/api/project-requests')posts++;});
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 phase='desktop catalog';await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await visit('/services');await until('document.querySelectorAll("article").length>=3 || document.body.innerText.includes("We couldn’t load our services.")');
 const body=await js('document.body.innerText');ok(body.includes('LOCAL TEST — Service Alpha'));ok(!body.includes('Hidden Draft'));ok(!body.includes('starting price'));ok(body.includes('New requests are currently paused.'));
 eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);
 writeFileSync('.supabase/browser-tests/services-desktop.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 phase='selection and validation';await visit('/request-a-quote?service='+sid);await until('!!document.getElementById("serviceId") && !document.querySelector("button[type=submit]").disabled');
 eq(await js('document.getElementById("serviceId").value'),sid);ok(await js('document.getElementById("budgetOptionId").innerText.includes("Alpha discussion")'));
 await fill('budgetOptionId',budget);await fill('serviceId',other);
 eq(await js('document.getElementById("budgetOptionId").value'),'');ok(await js('!document.getElementById("budgetOptionId").innerText.includes("Alpha discussion")'));
 eq(await js('document.querySelectorAll("input[type=file]").length'),0);eq(await js('document.querySelector("form").getAttribute("method")'), 'post');
 await js('document.querySelector("form").requestSubmit()');await until('!!document.querySelector("[role=alert]")');eq(posts,0);ok(await js('document.querySelectorAll("[aria-invalid=true]").length>=5'));
 eq(await js('Array.from(document.querySelectorAll("input:not([name=deadline]),select,textarea")).filter(e=>!e.closest("[aria-hidden=true]")).every(e=>!!document.querySelector(`label[for="${e.id}"]`)||e.closest("label"))'),true);
 phase='mobile layout and keyboard';await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
 eq(await js('document.documentElement.scrollWidth<=innerWidth'),true);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});ok(await js('document.activeElement!==document.body'));
 writeFileSync('.supabase/browser-tests/request-mobile.png',Buffer.from((await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
 phase='valid submission and duplicate click';await fill('fullName','Synthetic Browser Visitor');await fill('email','browser-'+sid+'@example.invalid');await fill('whatsapp','+237600000000');await fill('budgetOptionId',otherBudget);await fill('requirements','This is a synthetic local browser project request.');await js('document.getElementById("consent").click()');
 await js('document.querySelector("form").requestSubmit();document.querySelector("form").requestSubmit()');await until('document.body.innerText.toLowerCase().includes("request received")');
 eq(posts,1);ok(await js('/BWR-[a-f0-9]{32}/.test(document.body.innerText)'));eq(await localScalar(`select count(*) from business_private.project_requests where service_id='${other}';`),'1');
 eq(await js('localStorage.length+sessionStorage.length'),0);
 phase='uncertain result and identical retry';await visit('/request-a-quote?service='+sid);await until('!!document.getElementById("fullName") && !document.querySelector("button[type=submit]").disabled');
 for(const [name,value] of Object.entries({fullName:'Second Synthetic Visitor',email:'retry-'+sid+'@example.invalid',whatsapp:'+237600000001',budgetOptionId:budget,requirements:'A synthetic local browser retry test request.'}))await fill(name,value);await js('document.getElementById("consent").click()');
 await js(`window.__originalFetch=window.fetch;window.__dropOnce=true;window.fetch=async(...args)=>{const r=await window.__originalFetch(...args);if(String(args[0])==='/api/project-requests'&&window.__dropOnce){window.__dropOnce=false;throw new Error('Synthetic lost response');}return r;};document.querySelector('form').requestSubmit();`);
 await until('document.body.innerText.includes("Retry the same request")');eq(await js('document.getElementById("fullName").disabled||document.getElementById("fullName").closest("fieldset").disabled'),true);
 await js('document.querySelector("form").requestSubmit()');await until('document.body.innerText.toLowerCase().includes("request received")');eq(await localScalar(`select count(*) from business_private.project_requests where service_id='${sid}';`),'1');
 phase='catalog failure';await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`{const original=window.fetch;window.fetch=(...args)=>String(args[0])==='/api/services'?Promise.resolve(new Response('unavailable',{status:503})):original(...args);}`});await visit('/services');await until('document.body.innerText.includes("We couldn’t load our services.")');ok(await js('document.body.innerText.includes("Try loading again")'));
 console.log(`PASS: ${checks} real Edge/Next/local database UI checks; catalog, scoped budgets, validation, keyboard/mobile, one POST for double submit, lost-response retry yields one DB record. No hosted calls or messages.`);
}catch(error){console.error('Local services browser test failed at '+phase+'; reason category: '+(/^Browser (script [A-Za-z]+|wait failed)$/.test(error.message)?error.message:'check or transport failure')+'; raw browser data and request bodies suppressed.');console.log(JSON.stringify({apiReads,networkFailures,exceptionTypes}));if(socket){try{const image=await cdp('Page.captureScreenshot',{format:'png'});writeFileSync('.supabase/browser-tests/services-failure.png',Buffer.from(image.data,'base64'));console.log('Private synthetic-page failure screenshot saved.');}catch{}}process.exitCode=1;}
finally{
 if(socket){try{await cdp('Browser.close');}catch{}socket.close();}if(browser&&!browser.killed)browser.kill();
 if(created){await localSql(`delete from business_private.project_requests where service_id in ('${sid}','${other}');delete from public.service_budget_options where service_id in ('${sid}','${other}');delete from public.services where id in ('${sid}','${other}','${draft}','${paused}');`);
 // Delete only the synthetic test's email counters; preserve the shared development global quota.
 const local=readFileSync('.env.integration.local','utf8');assert.match(local,/NEXT_PUBLIC_SUPABASE_URL=["']?http:\/\/127\.0\.0\.1:65421/);
 const secret=local.match(/^AUTH_FLOW_SIGNING_SECRET=(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/,'$2');assert.ok(secret);
 const key=createHmac('sha256',secret).update('bewise-local-business-v1').digest('hex');
 const hashes=['browser-','retry-'].map(prefix=>createHmac('sha256',key).update('request-email:'+prefix+sid+'@example.invalid').digest('hex'));
 await localSql(`delete from business_private.submission_buckets where scope='email' and key_hash in (${hashes.map(h=>`decode('${h}','hex')`).join(',')});`);
 }
}
