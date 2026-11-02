import test from "node:test";
import assert from "node:assert/strict";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { brand } from "../brand/identity";
import { officialLogo } from "../brand/assets";
import { renderQuotationPdf,renderRequestPdf } from "../quotations/pdf";
import type { QuoteDocument } from "../quotations/model";
import { attachmentName,emailTemplate,EMAIL_SUBJECT,LOGO_CID,normalizeEmail,normalizePhone,whatsappUrl,whatsappMessage } from "./model";
import { deliveryHttp } from "./http";
import { EMAIL_SENDING_ENABLED,type getDeliveryRepository } from "./server";
import { AuthorizationError } from "@/lib/auth/core";
import { BusinessConflictError } from "../services/server";
const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
const baseline=JSON.parse(readFileSync("src/features/delivery/legacy-pdf-baseline.json","utf8")) as {document:QuoteDocument;sha256:string};
test("original supplied assets retain their exact hashes and dimensions",async()=>{
 const manifest=JSON.parse(await readFile("public/brand/manifest.json","utf8"));assert.equal(Object.keys(manifest).length,5);
 for(const [name,value]of Object.entries(manifest)){const data=await readFile("public/brand/original/"+name);assert.equal(hash(data),(value as {sha256:string}).sha256);}
 const logo=await(await PDFDocument.create()).embedPng(await officialLogo());assert.equal(logo.width/ logo.height,2212/624);assert.equal(brand.palette.primary,"#2563EB");assert.equal(brand.palette.navy,"#103B92");
});
test("legacy quotation bytes match the pre-branding golden SHA-256",async()=>{
 assert.equal(hash(await renderQuotationPdf(baseline.document)),baseline.sha256);
});
test("new branded documents embed the original image and preserve multipage layout",async()=>{
 const doc:QuoteDocument={...baseline.document,templateVersion:2,content:{...baseline.document.content,scope:("Reviewed scope and explicit deliverables. ").repeat(70),deliverables:("A tested deliverable. ").repeat(60)}};
 const quote=await renderQuotationPdf(doc),pdf=await PDFDocument.load(quote,{updateMetadata:false});assert.ok(pdf.getPageCount()>1);assert.equal(pdf.getProducer(),"BE WISE document renderer v2");assert.ok(Buffer.from(quote).includes(Buffer.from('/Subtype /Image')));assert.ok(!Buffer.from(quote).includes(Buffer.from('/JavaScript')));
 const request=await renderRequestPdf({request:{id:"test",reference:"BWR-"+"b".repeat(32),full_name:"Synthetic Brand Review",email:"brand-review@example.invalid",whatsapp:"+237600000000",created_at:"2026-11-01T00:00:00Z",version:1,status:"received",requirements:"A synthetic request to review official document branding.",preferred_deadline:null,service_snapshot:{title:"Website Development"},budget_snapshot:{label:"50,000–100,000 FCFA",currency:"XAF",minMinor:50000,maxMinor:100000}},attachments:[]});
 assert.ok(Buffer.from(request).includes(Buffer.from('/Subtype /Image')));
 await mkdir('.supabase/brand-review',{recursive:true});await writeFile('.supabase/brand-review/quotation.pdf',quote);await writeFile('.supabase/brand-review/request.pdf',request);
});
test("phone normalization rejects redirect/header injection and assumes no country",()=>{
 assert.equal(normalizePhone('+237 (600) 000-000'),'+237600000000');
 for(const v of ['600000000','+0 60000000','+237600000000/evil','+237600000000?text=price','+237600000000\r\nX:bad'])assert.throws(()=>normalizePhone(v));
});
test("WhatsApp URL uses only wa.me and generic text without private content",()=>{
 const u=new URL(whatsappUrl('+237600000000'));assert.equal(u.origin,'https://wa.me');assert.equal(u.pathname,'/237600000000');
 assert.equal([...u.searchParams.keys()].join(','),'text');const text=u.searchParams.get('text')!;assert.ok(text.includes(brand.tagline));for(const forbidden of ['XAF','FCFA','BWQ-','BWR-','localhost','quotation-api','100,000'])assert.ok(!u.href.includes(forbidden));
 assert.ok(whatsappMessage({client_name:'Synthetic Client',service_name:'Website'}).includes('Synthetic Client'));
});
test("email recipients are normalized but never claimed independently verified",()=>{
 assert.equal(normalizeEmail(' Person+Quote@Example.Invalid '),'person+quote@example.invalid');
 for(const v of ['x@example.invalid\r\nBcc:x@evil.invalid','x@example.invalid\r\n','a..b@example.invalid','<x>@example.invalid','x@evil.invalid/?cc=z','x@bad-.invalid'])assert.throws(()=>normalizeEmail(v));
});
test("email HTML escapes user text, uses CID branding and has no local/private URLs",async()=>{
 const html=emailTemplate({client_name:'<img src=x onerror=alert(1)>',service_name:'<script>bad</script>',quotation_number:'BWQ-'+ 'a'.repeat(32),revision:2});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('cid:'+LOGO_CID));assert.ok(html.includes('#103B92'));assert.ok(html.includes(brand.tagline));
 for(const forbidden of ['http://localhost','127.0.0.1','file://','C:/','.supabase','100,000 FCFA'])assert.ok(!html.includes(forbidden));
 assert.equal(EMAIL_SUBJECT,'Your Project Quotation | BE WISE INNOVATIONS');assert.equal(EMAIL_SENDING_ENABLED,false);
 await mkdir('.supabase/brand-review',{recursive:true});await writeFile('.supabase/brand-review/email.html',html.replace('cid:'+LOGO_CID,'data:image/png;base64,'+(await officialLogo()).toString('base64')));
});
test("attachment filenames bind the exact quotation and revision without client names",()=>{
 assert.equal(attachmentName({quotation_number:'BWQ-'+ 'a'.repeat(32),revision:2}),'BWQ-'+ 'a'.repeat(32)+'-r2.pdf');
 for(const revision of [0,101,1.5])assert.throws(()=>attachmentName({quotation_number:'BWQ-'+ 'a'.repeat(32),revision}));assert.throws(()=>attachmentName({quotation_number:'../../private',revision:1}));
});
type Repo=Awaited<ReturnType<typeof getDeliveryRepository>>;
const post=(operation:string,origin='http://localhost:3022')=>new Request('http://localhost:3022/internal/delivery-api',{method:'POST',headers:{host:'localhost:3022',origin,'content-type':'application/json'},body:JSON.stringify({operation,input:{id:'10000000-0000-4000-8000-000000000001'}})});
test("delivery HTTP rejects bad Origin, real-send commands and sensitive errors",async()=>{
 for(const[k,v]of Object.entries({NODE_ENV:'development',BUSINESS_BACKEND_ENABLED:'local',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:65421',AUTH_TRUSTED_ORIGIN:'http://localhost:3022'}))process.env[k]=v;
 let calls=0;const repo=async()=>({prepare:async()=>{calls++;return {};}}) as unknown as Repo;
 assert.equal((await deliveryHttp(post('prepare','https://evil.invalid'),repo)).status,403);assert.equal(calls,0);
 assert.equal((await deliveryHttp(post('send-email'),repo)).status,400);assert.equal(calls,0);
 for(const[e,status]of [[new AuthorizationError(),403],[new BusinessConflictError(),409],[new Error('secret provider details'),400]]as const){const r=await deliveryHttp(post('prepare'),async()=>({prepare:async()=>{throw e;}})as unknown as Repo);assert.equal(r.status,status);assert.ok(!(await r.text()).includes('secret provider'));}
});
