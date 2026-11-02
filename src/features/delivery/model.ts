import { brand } from "../brand/identity";
export type Delivery = {id:string;request_id:string;revision_id:string;channel:"whatsapp"|"email";recipient:string;recipient_source:"submitted";pdf_sha256:string;status:"READY"|"MANUALLY_SENT"|"NEEDS_FOLLOW_UP";version:number;notes:string;confirmed_at:string|null;created_at:string;quotation_number:string;revision:number|string;client_name:string;service_name:string;events:{id:string;status:string;created_at:string;notes:string}[]};
export function normalizePhone(input:string) {
 if(typeof input!=="string"||/[\u0000-\u001f\u007f]/.test(input)||!/^[+0-9() .-]+$/.test(input))throw new Error("Use an international phone number.");
 const value=input.trim().replace(/[() .-]/g,"");
 if(!/^\+[1-9][0-9]{6,14}$/.test(value))throw new Error("Use an international phone number.");return value;
}
export function normalizeEmail(input:string) {
 if(typeof input!=="string"||/[\u0000-\u001f\u007f]/.test(input)||/\s/.test(input.trim()))throw new Error("Check the submitted email.");
 const value=input.trim().toLowerCase(),local=value.split("@")[0];
 if(value.length>254||local.length>64||/(^\.|\.$|\.\.)/.test(local)||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value))throw new Error("Check the submitted email.");return value;
}
export function whatsappUrl(phone:string) {
 const url=new URL("https://wa.me/"+normalizePhone(phone).slice(1));
 // No client name, project scope, amount, reference, artifact URL or financial data.
 url.searchParams.set("text",`Hello, thank you for choosing ${brand.name}. Please review the quotation PDF I will attach manually. ${brand.tagline}`);
 return url.href;
}
export function whatsappMessage(d:Pick<Delivery,"client_name"|"service_name">) {
 return `Hello ${d.client_name},\n\nThank you for choosing ${brand.name}.\n\nFollowing our review of your project requirements, we are pleased to share our official quotation for ${d.service_name}.\n\nPlease review the attached document, which contains the proposed scope of work, pricing and estimated delivery timeline.\n\nIf you have any questions or would like to discuss any details, please let us know.\n\n${brand.name}\n${brand.tagline}`;
}
export function attachmentName(d:Pick<Delivery,"quotation_number"|"revision">) {
 if(!/^BWQ-[a-f0-9]{32}$/.test(d.quotation_number)||!Number.isInteger(Number(d.revision))||Number(d.revision)<1||Number(d.revision)>100)throw new Error("Invalid revision.");
 return d.quotation_number+"-r"+d.revision+".pdf";
}
export const EMAIL_SUBJECT="Your Project Quotation | BE WISE INNOVATIONS";
export const LOGO_CID="bewise-official-logo@bewiseinnovation.com";
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function emailTemplate(d:Pick<Delivery,"client_name"|"service_name"|"quotation_number"|"revision">) {
 const p=brand.palette;
 return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Project quotation</title></head><body style="margin:0;background:${p.light};color:${p.text};font-family:Quicksand,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;max-width:640px;background:white;border:1px solid ${p.border};border-radius:12px;overflow:hidden"><tr><td style="background:${p.navy};padding:28px"><div style="max-width:284px;box-sizing:border-box;background:white;padding:12px;border-radius:8px"><img src="cid:${LOGO_CID}" width="260" alt="BE WISE INNOVATIONS" style="display:block;width:100%;height:auto;border:0"></div><p style="color:white;margin:18px 0 0;font-size:15px">${brand.tagline}</p></td></tr><tr><td style="padding:28px;font-size:16px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word"><p>Hello ${escape(d.client_name)},</p><p>Thank you for choosing ${brand.name}.</p><p>Following our review of your project requirements, we are pleased to share our official quotation for <strong>${escape(d.service_name)}</strong>.</p><p style="background:${p.light};padding:16px;border-left:4px solid ${p.primary}">Quotation ${escape(d.quotation_number)}<br>Revision ${escape(String(d.revision))}</p><p>Please review the attached PDF for the proposed scope of work, pricing and estimated delivery timeline.</p><p>If you have any questions or would like to discuss any details, please let us know.</p><p>Kind regards,<br><strong>${brand.name}</strong></p></td></tr><tr><td style="padding:24px 28px;border-top:1px solid ${p.border};color:${p.secondary};font-size:13px;line-height:1.8">${brand.name}<br>${brand.tagline}<br>${brand.email}<br>${brand.website}</td></tr></table></td></tr></table></body></html>`;
}
