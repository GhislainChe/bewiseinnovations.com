import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { officialLogo } from "../brand/assets";
import type { QuoteDocument } from "./model";
import type { Attachment, RequestDetail } from "../services/staff-model";
import { requestBudgetLabel } from "../services/staff-model";

export const PDF_TEMPLATE_VERSION = 2;
const blue = rgb(37/255,99/255,235/255), ink = rgb(17/255,24/255,39/255), gray = rgb(100/255,116/255,139/255);
const money = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits:0 }).format(n)+" FCFA (XAF)";
async function writer(kind: "request" | "quotation", date: string) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const bytes = await readFile(join(process.cwd(),"node_modules/@fontsource/quicksand/files/quicksand-latin-400-normal.woff"));
  const font: PDFFont = await doc.embedFont(bytes, { subset: true });
  const characters = new Set(font.getCharacterSet());
  const fallback=await doc.embedFont(await readFile(join(process.cwd(),"node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff")),{subset:true});
  const fallbackChars=new Set(fallback.getCharacterSet());
  const logo=await doc.embedPng(await officialLogo());
  const created = new Date(date.slice(0,10)+"T00:00:00Z");
  if (!Number.isFinite(created.getTime())) throw new Error("Document date unavailable.");
  doc.setCreationDate(created);doc.setModificationDate(created);doc.setProducer("BE WISE document renderer v2");doc.setCreator("BE WISE INNOVATIONS");
  doc.setTitle(kind === "request" ? "Internal project request - Confidential" : "Quotation");
  let page: PDFPage, y = 0;
  function draw(text: string, x: number, at: number, size: number, color = ink, face=font) { page.drawText(text,{ x,y:at,size,font:face,color }); }
  function newPage() {
    if (doc.getPageCount() >= 60) throw new Error("Document is too long.");
    page=doc.addPage([595.28,841.89]);y=680;
    page.drawImage(logo,{x:48,y:757,width:230,height:230*624/2212});
    draw("Smarter Tech, Greater Impact.",48,735,11,blue);
    draw("contact@bewiseinnovation.com  |  bewiseinnovation.com",48,715,9,gray);
    page.drawLine({start:{x:48,y:700},end:{x:547,y:700},thickness:1,color:blue});
    draw("Smarter Tech, Greater Impact.",48,50,8,blue);
    draw(kind === "request" ? "CONFIDENTIAL - INTERNAL USE ONLY" : "Quotation - not an invoice or proof of payment",48,34,8,gray);
    draw(String(doc.getPageCount()),530,34,8,gray);
  }
  function ensure(height: number) { if(y-height<78)newPage(); }
  function line(text: string,size=10,color=ink,face=font) { ensure(size+5);draw(text,48,y,size,color,face);y-=size+5; }
  function paragraph(value: string, size=10, color=ink) {
    const text=value.replaceAll("\r\n","\n").replaceAll("\r","\n").replaceAll("\t","    ");
    for(const c of text) if(c!=="\n" && !characters.has(c.codePointAt(0)!) && !fallbackChars.has(c.codePointAt(0)!)) throw new Error("A character is not supported by the document font. Review text before export.");
    for(const block of text.split("\n")) {
      const face=[...block].every(c=>characters.has(c.codePointAt(0)!))?font:fallback;
      let current="";
      for(const token of block.match(/\S+\s*|\s+/g)??[]) {
        if(current && face.widthOfTextAtSize(current+token,size)>495) {line(current.trimEnd(),size,color,face);current="";}
        for(const c of token) {
          if(face.widthOfTextAtSize(current+c,size)>495) {line(current,size,color,face);current="";}
          current+=c;
        }
      }
      line(current || " ",size,color,face);
    }
  }
  function section(label: string,value: string) { ensure(48);y-=6;paragraph(label.toUpperCase(),9,blue);paragraph(value || "Not supplied");y-=2; }
  newPage();
  return { paragraph,section,space:()=>{y-=12;}, finish:()=>doc.save({useObjectStreams:false,addDefaultPage:false}) };
}
export async function renderRequestPdf(data: { request: RequestDetail; attachments: Attachment[] }): Promise<Uint8Array> {
  const r=data.request,w=await writer("request",r.created_at);
  w.paragraph("INTERNAL PROJECT REQUEST - CONFIDENTIAL",13,blue);w.space();
  w.section("Request reference",r.reference);w.section("Submitted",new Date(r.created_at).toISOString());
  w.section("Client",r.full_name+"\n"+r.email+"\nWhatsApp: "+r.whatsapp);
  w.section("Requested service",r.service_snapshot.title);
  w.section("Client estimated budget",requestBudgetLabel(r.budget_snapshot));
  w.paragraph("Client estimate only. This is not a service price or quotation.",9,gray);
  w.section("Project description",r.requirements);w.section("Preferred deadline",r.preferred_deadline ?? "Not sure yet");
  w.section("Attachment inventory",data.attachments.length ? data.attachments.map(a=>`${a.display_name} | ${a.mime_type} | ${a.byte_size} bytes | ${a.scan_status}`).join("\n") : "No attachments. Public uploads are disabled.");
  return w.finish();
}
export async function renderQuotationPdf(d: QuoteDocument): Promise<Uint8Array> {
  if(d.templateVersion !== PDF_TEMPLATE_VERSION) throw new Error("Unsupported document template.");
  const w=await writer("quotation",d.date);
  w.paragraph("QUOTATION",22,blue);w.space();
  w.section("Quotation",d.number+" / Revision "+d.revision+"\nPrepared: "+d.date+" | Valid until: "+d.content.validUntil);
  w.section("Prepared for",d.client.name+"\n"+d.client.email+"\nWhatsApp: "+d.client.whatsapp);
  w.section("Request and service",d.request.reference+"\n"+d.request.service);
  w.section("Project",d.content.projectDescription);w.section("Scope of work",d.content.scope);w.section("Deliverables",d.content.deliverables);
  w.section("Proposed amounts","All amounts are in FCFA / XAF.");
  d.content.items.forEach((item,index)=>{w.section(String(index+1).padStart(2,"0")+". "+item.description,`Quantity: ${item.quantity}\nUnit amount: ${money(item.unitAmount!)}\nLine total: ${money(item.quantity*item.unitAmount!)}`);});
  w.section("Total proposed price",money(d.total));
  w.section("Estimated delivery timeline",d.content.timeline);w.section("Payment terms",d.content.paymentTerms);
  if(d.content.notes)w.section("Notes",d.content.notes);
  if(d.content.exclusions)w.section("Exclusions",d.content.exclusions);
  w.space();w.paragraph("This quotation is not an invoice, payment request or proof of payment. No payment is collected through this document.",9,gray);
  return w.finish();
}
