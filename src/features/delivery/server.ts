import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";
import { AuthorizationError,requireTeamMember } from "@/lib/auth/core";
import { BusinessConflictError } from "../services/server";
import { identifier,record } from "../services/validation";
import { assertLocalBusinessRuntime } from "../services/runtime";
import { quotationsRepository } from "../quotations/server";
import { pdfHash,readQuotationPdf } from "../quotations/artifacts";
import { officialLogo } from "../brand/assets";
import { brand } from "../brand/identity";
import { attachmentName,emailTemplate,EMAIL_SUBJECT,LOGO_CID,normalizeEmail,normalizePhone,whatsappMessage,whatsappUrl,type Delivery } from "./model";
export const EMAIL_SENDING_ENABLED=false;
export function deliveryRepository(client:SupabaseClient) {
 const quotes=quotationsRepository(client);
 async function authorize(exporting=false) {
  const member=await requireTeamMember(createSupabaseAuthGateway(client));
  if(["inquiries.read","quotations.read","quotations.send",...(exporting?["documents.export"]:[])].some(p=>!member.permissionCodes.includes(p)))throw new AuthorizationError();
 }
 async function rpc(name:string,args:Record<string,unknown>) {
  const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(10000));
  if(r.error?.code==="PT409")throw new BusinessConflictError();if(r.error)throw new Error("Dispatch unavailable.");return r.data;
 }
 async function get(id:string):Promise<Delivery> {identifier(id);await authorize();const d=await rpc("get_quotation_delivery",{p_id:id});if(d.channel==="email")normalizeEmail(d.recipient);else normalizePhone(d.recipient);return d;}
 async function attachment(d:Delivery,audited=true) {
  await authorize(true);
  const revision=await quotes.get(d.revision_id);
  if(revision.state!=="finalized"||revision.pdf_sha256!==d.pdf_sha256)throw new Error("Revision mismatch.");
  const bytes=audited?await quotes.quotationPdf(d.revision_id):await readQuotationPdf(d.revision_id,d.pdf_sha256);
  if(pdfHash(bytes)!==d.pdf_sha256)throw new Error("Attachment does not match the selected revision.");
  return {bytes,filename:attachmentName(d),sha256:d.pdf_sha256,contentType:"application/pdf"};
 }
 return {
  get,
  async history(requestId:string) {identifier(requestId);await authorize();return rpc("list_quotation_deliveries",{p_request_id:requestId});},
  async prepare(input:unknown) {
   const v=record(input);if(Object.keys(v).some(k=>!["revisionId","channel"].includes(k))||!["email","whatsapp"].includes(v.channel as string))throw new Error();
   const id=identifier(v.revisionId);await authorize(true);
   const revision=await quotes.get(id);if(revision.state!=="finalized")throw new Error("Finalize first.");
   if(v.channel==="email")normalizeEmail(revision.document.client.email);else normalizePhone(revision.document.client.whatsapp);
   // Fail before recording READY when the exact immutable artifact is unavailable.
   await quotes.quotationPdf(id);
   return rpc("prepare_quotation_delivery",{p_revision_id:id,p_channel:v.channel});
  },
  async preview(id:string) {
   const d=await get(id);await authorize(true);let file:Awaited<ReturnType<typeof attachment>>|null=null;
   try {file=await attachment(d,false);}catch(e){if(e instanceof AuthorizationError)throw e;}
   const logo=await officialLogo();
   const html=d.channel==="email"?emailTemplate(d):null;
   return {delivery:d,sendingEnabled:EMAIL_SENDING_ENABLED,message:whatsappMessage(d),whatsappUrl:d.channel==="whatsapp"?whatsappUrl(d.recipient):null,
    email:d.channel==="email"?{to:normalizeEmail(d.recipient),subject:EMAIL_SUBJECT,html,previewHtml:html!.replace("cid:"+LOGO_CID,"data:image/png;base64,"+logo.toString("base64")),inlineLogo:{cid:LOGO_CID,filename:"bewise-official-logo.png",sha256:brand.logoSha256,contentType:"image/png"}}:null,
    attachmentAvailable:Boolean(file),attachment:{filename:attachmentName(d),sha256:d.pdf_sha256,byteSize:file?.bytes.length??null,contentType:"application/pdf",revisionId:d.revision_id}};
  },
  async attachment(id:string) {return attachment(await get(id));},
  async confirm(input:unknown) {
   const v=record(input);if(Object.keys(v).some(k=>!["id","version","eventKey","status","notes","attested"].includes(k)))throw new Error();
   const id=identifier(v.id),eventKey=identifier(v.eventKey);
   if(!Number.isInteger(v.version)||(v.version as number)<1||!["MANUALLY_SENT","NEEDS_FOLLOW_UP"].includes(v.status as string)||typeof v.notes!=="string"||v.notes.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.notes)||typeof v.attested!=="boolean"||(v.status==="MANUALLY_SENT"&&!v.attested))throw new Error();
   const d=await get(id);if(v.status==="MANUALLY_SENT")await attachment(d);
   return rpc("record_quotation_dispatch",{p_id:id,p_version:v.version,p_event_key:eventKey,p_status:v.status,p_notes:v.notes,p_attested:v.attested});
  },
  // Transport-ready data, deliberately no provider/SMTP invocation. Server-only.
  async emailPackage(id:string) {
   const d=await get(id);if(d.channel!=="email")throw new Error();const file=await attachment(d),logo=await officialLogo();
   return {sendingEnabled:EMAIL_SENDING_ENABLED,to:normalizeEmail(d.recipient),subject:EMAIL_SUBJECT,html:emailTemplate(d),text:whatsappMessage(d),attachments:[{filename:file.filename,content:file.bytes,contentType:"application/pdf",sha256:file.sha256},{filename:"bewise-official-logo.png",content:logo,contentType:"image/png",cid:LOGO_CID,sha256:brand.logoSha256}]};
  },
 };
}
export async function getDeliveryRepository(){assertLocalBusinessRuntime();return deliveryRepository(await createClient());}
