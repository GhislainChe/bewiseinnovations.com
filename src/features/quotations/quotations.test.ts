import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { parseQuotation,quoteTotal,type QuoteContent,type QuoteDocument } from "./model";
import { renderQuotationPdf,renderRequestPdf } from "./pdf";
import { quotationHttp } from "./http";
import { AuthorizationError } from "@/lib/auth/core";
import { BusinessConflictError } from "../services/server";
import type { getQuotationsRepository } from "./server";
import { preserveQuotationPdf,readQuotationPdf } from "./artifacts";
import { randomUUID } from "node:crypto";
import { resolve,sep } from "node:path";
import { writeFile,unlink } from "node:fs/promises";
const content:QuoteContent={projectDescription:"A client project",scope:"Agreed scope",deliverables:"A tested deliverable",timeline:"Three weeks after agreed start",paymentTerms:"Terms entered by Operations",validUntil:"2027-01-01",notes:"",exclusions:"Hosting excluded",teamAgreement:true,currency:"XAF",items:[{description:"Explicit item",quantity:2,unitAmount:50000}]};
const now=new Date("2026-11-01T00:00:00Z");
const document:QuoteDocument={company:{name:"BE WISE INNOVATIONS",email:"contact@bewiseinnovation.com",website:"bewiseinnovation.com"},number:"BWQ-"+"a".repeat(32),revision:1,date:"2026-11-01",client:{name:"Synthetic Client Élodie",email:"synthetic@example.invalid",whatsapp:"+237600000000"},request:{reference:"BWR-"+"b".repeat(32),service:"Website Development"},content,total:100000,templateVersion:1};
test("XAF totals use explicit integers, never the client budget",()=>{assert.equal(quoteTotal(content.items),100000);assert.equal(quoteTotal([{description:"Deliberately no charge",quantity:1,unitAmount:0}]),0);assert.equal(parseQuotation(content,true,now).currency,"XAF");});
test("missing amounts, fractional quantities, overflow and invented totals fail",()=>{
 for(const change of [{unitAmount:null},{unitAmount:-1},{quantity:1.5},{quantity:100001},{unitAmount:1000000000001}])assert.throws(()=>quoteTotal([{...content.items[0],...change}]));
 assert.throws(()=>quoteTotal([{description:"Too large",quantity:100000,unitAmount:1000000000000}]));
 for(const key of ["total","client","role","taxRate"])assert.throws(()=>parseQuotation({...content,[key]:"forged"}));
});
test("finalization requires current validity, agreement and all required terms",()=>{
 for(const override of [{teamAgreement:false},{items:[]},{scope:""},{paymentTerms:""},{validUntil:null},{validUntil:"2026-01-01"},{validUntil:"2100-01-01"}])assert.throws(()=>parseQuotation({...content,...override},true,now));
 assert.doesNotThrow(()=>parseQuotation({...content,scope:"",items:[],teamAgreement:false},false,now));
});
test("invalid dates, fields, controls and oversized documents fail",()=>{
 for(const override of [{validUntil:"2026-02-30"},{currency:"USD"},{notes:"bad\u0000"},{scope:"x".repeat(3001)},{items:[{...content.items[0],hidden:true}]}])assert.throws(()=>parseQuotation({...content,...override}));
});
test("quotation renderer creates stable private static PDFs without active content",async()=>{
 const a=await renderQuotationPdf(document),b=await renderQuotationPdf(document);assert.deepEqual(a,b);
 const pdf=await PDFDocument.load(a);assert.ok(pdf.getPageCount()>=1);assert.equal(pdf.getTitle(),"Quotation");
 const text=Buffer.from(a).toString("latin1");for(const forbidden of ["/JavaScript","/OpenAction","/Launch","/EmbeddedFiles","/URI"])assert.ok(!text.includes(forbidden));
 assert.ok(a.length<2000000);
});
test("request renderer wraps long plain text and inventories files without fetching them",async()=>{
 const bytes=await renderRequestPdf({request:{id:"x",reference:"BWR-"+"c".repeat(32),full_name:"Synthetic Client",email:"client@example.invalid",whatsapp:"+237600000000",created_at:"2026-11-01T00:00:00Z",status:"received",version:1,requirements:("A long project paragraph. ".repeat(250))+"<script>https://external.invalid</script>",preferred_deadline:"2027-01-15",service_snapshot:{title:"Website"},budget_snapshot:{label:"50,000–100,000 FCFA",currency:"XAF",minMinor:50000,maxMinor:100000,unsure:false}},attachments:[{id:"x",display_name:"example.pdf",mime_type:"application/pdf",byte_size:100,scan_status:"quarantined"}]});
 const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>1);assert.ok(!Buffer.from(bytes).toString("latin1").includes("/URI"));
 await assert.rejects(renderQuotationPdf({...document,templateVersion:3}));
});
type Repo=Awaited<ReturnType<typeof getQuotationsRepository>>;
const post=(operation:string,origin="http://localhost:3022")=>new Request("http://localhost:3022/internal/quotation-api",{method:"POST",headers:{host:"localhost:3022",origin,"content-type":"application/json"},body:JSON.stringify({operation,input:{id:"10000000-0000-4000-8000-000000000001"}})});
test("private PDF operations require same-origin POST and emit no-store attachments",async()=>{
 for(const[k,v] of Object.entries({BUSINESS_BACKEND_ENABLED:"local",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:65421",AUTH_TRUSTED_ORIGIN:"http://localhost:3022",NODE_ENV:"development"}))process.env[k]=v;
 let called=0;const repo=async()=>({requestPdf:async()=>{called++;return new TextEncoder().encode("%PDF-test");}}) as unknown as Repo;
 assert.equal((await quotationHttp(post("request-pdf","https://evil.invalid"),repo)).status,403);assert.equal(called,0);
 const r=await quotationHttp(post("request-pdf"),repo);assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),"application/pdf");assert.match(r.headers.get("cache-control")!,/no-store/);assert.match(r.headers.get("content-disposition")!,/^attachment/);
 assert.equal((await quotationHttp(new Request("http://localhost:3022/internal/quotation-api?view=request-pdf&id=10000000-0000-4000-8000-000000000001"),repo)).status,400);assert.equal(called,1);
});
test("access denial, conflicts and provider errors have safe responses",async()=>{
 for(const [error,status] of [[new AuthorizationError(),403],[new BusinessConflictError(),409],[new Error("sensitive-provider-payload"),400]] as const){const r=await quotationHttp(post("finalize"),async()=>({finalize:async()=>{throw error;}}) as unknown as Repo);assert.equal(r.status,status);assert.ok(!(await r.text()).includes("sensitive-provider"));}
});
test("private artifacts never overwrite different bytes and corruption fails closed",async()=>{
 const id=randomUUID(),bytes=await renderQuotationPdf(document),hash=await preserveQuotationPdf(id,bytes);
 const directory=resolve('.supabase/documents/quotations'),file=resolve(directory,id+'-'+hash+'.pdf');assert.ok(file.startsWith(directory+sep));
 try {
  assert.equal(await preserveQuotationPdf(id,bytes),hash);assert.deepEqual(new Uint8Array(await readQuotationPdf(id,hash)),bytes);
  await writeFile(file,Buffer.from('Corrupted synthetic test file'));
  await assert.rejects(readQuotationPdf(id,hash));await assert.rejects(preserveQuotationPdf(id,bytes));
  await assert.rejects(readQuotationPdf('../escape',hash));
 } finally { await unlink(file); }
});
