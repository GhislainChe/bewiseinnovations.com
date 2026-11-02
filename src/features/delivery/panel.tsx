"use client";
import { useEffect,useRef,useState } from "react";
import Image from "next/image";
import type { QuoteRevision } from "../quotations/model";
import type { Delivery } from "./model";
import { brand } from "../brand/identity";
import type { deliveryRepository } from "./server";
import styles from "./panel.module.css";
type Preview=Awaited<ReturnType<ReturnType<typeof deliveryRepository>["preview"]>>;
async function api(query:string,operation?:string,input?:unknown) {
 const r=await fetch("/internal/delivery-api"+query,{method:operation?"POST":"GET",body:operation?JSON.stringify({operation,input}):undefined,headers:operation?{"Content-Type":"application/json"}:undefined,credentials:"same-origin",mode:"cors",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(r.status===409?"Dispatch changed. Reload history before continuing.":"Dispatch unavailable. Check recipient, session, permissions and PDF state.");return r;
}
const statusLabel={READY:"Ready — no dispatch recorded",MANUALLY_SENT:"Manually sent — staff-confirmed dispatch",NEEDS_FOLLOW_UP:"Needs follow-up"};
export function DeliveryPanel({requestId,revision,permissions}:{requestId:string;revision:QuoteRevision;permissions:string[]}) {
 const [history,setHistory]=useState<Delivery[]>([]),[preview,setPreview]=useState<Preview|null>(null),[channel,setChannel]=useState<"whatsapp"|"email">("whatsapp"),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[generation,setGeneration]=useState(0),[reviewed,setReviewed]=useState(false),[attested,setAttested]=useState(false),[notes,setNotes]=useState("");
 const lock=useRef(false),pendingIntent=useRef<{id:string;version:number;eventKey:string;status:string;notes:string;attested:boolean}|null>(null);
 const allowed=permissions.includes("quotations.send")&&permissions.includes("documents.export");
 useEffect(()=>{let active=true;if(allowed)void api("?view=history&id="+requestId).then(r=>r.json()).then(d=>{if(active)setHistory(d);}).catch(()=>{if(active)setMessage("Dispatch history unavailable.");});return()=>{active=false;};},[requestId,allowed,generation]);
 async function load(id:string) {const p=await(await api("?view=preview&id="+id)).json() as Preview;if(p.delivery.revision_id!==revision.id)throw new Error();setPreview(p);setReviewed(false);setAttested(false);setNotes("");}
 async function action(kind:"prepare"|"attachment"|"confirm",status?:"MANUALLY_SENT"|"NEEDS_FOLLOW_UP") {
  if(lock.current)return;lock.current=true;setBusy(true);setMessage("");
  try {
   if(kind==="prepare") {const d=await(await api("","prepare",{revisionId:revision.id,channel})).json() as Delivery;await load(d.id);setGeneration(n=>n+1);setMessage("Preparation ready. Nothing has been sent.");}
   if(kind==="attachment"&&preview) {
    const r=await api("","attachment",{id:preview.delivery.id}),blob=await r.blob();if(blob.type!=="application/pdf"||blob.size>2000000)throw new Error();
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=preview.attachment.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Exact finalized revision downloaded. Attach it manually.");
   }
   if(kind==="confirm"&&preview&&status) {
    const candidate={id:preview.delivery.id,version:preview.delivery.version,eventKey:pendingIntent.current?.eventKey??crypto.randomUUID(),status,notes,attested:status==="MANUALLY_SENT"?attested:false};
    if(pendingIntent.current&&JSON.stringify(candidate)!==JSON.stringify(pendingIntent.current))throw new Error("Inspect the uncertain previous operation before recording a different confirmation.");
    pendingIntent.current=candidate;
    const d=await(await api("","confirm",candidate)).json() as Delivery;pendingIntent.current=null;
    await load(d.id);setGeneration(n=>n+1);setMessage(status==="MANUALLY_SENT"?"Staff-confirmed manual dispatch recorded. Receipt and reading are not verified.":"Follow-up recorded. No delivery claim has been made.");
   }
  }catch{setMessage("Operation failed or its outcome is uncertain. Reload history and inspect the exact revision before retrying; no automatic retry occurs.");}
  finally{lock.current=false;setBusy(false);}
 }
 if(!allowed)return null;
 return <section className={styles.panel} aria-label="Quotation delivery"><header className={styles.header}><div className={styles.logo}><Image src={brand.logoPath} alt={brand.name} width={2212} height={624} unoptimized /></div><p>{brand.tagline}</p><h4>Send Quotation · revision {revision.revision}</h4></header>
 <div className={styles.body}><p>Only the selected finalized revision is used. Review submitted contact details before external contact. Opening WhatsApp is not dispatch or delivery.</p>
 <label>Delivery channel<select value={channel} disabled={busy} onChange={e=>setChannel(e.target.value as "whatsapp"|"email")}><option value="whatsapp">WhatsApp-assisted</option><option value="email">Email preparation — sending disabled</option></select></label>
 <div className={styles.actions}><button disabled={busy} onClick={()=>void action("prepare")}>Prepare delivery</button><button disabled={busy} onClick={()=>{pendingIntent.current=null;setPreview(null);setGeneration(n=>n+1);setMessage("History reloaded. Inspect recorded status before another action.");}}>Reload dispatch history</button></div>
 <p role="status" aria-live="polite">{message}</p>
 {preview&&<><h4>Revision {preview.delivery.revision} · {preview.delivery.channel}</h4><p>{preview.delivery.quotation_number}</p><p><strong>Intended recipient:</strong> {preview.delivery.recipient}</p><p>Source: submitted contact, not independently verified.</p><p>{statusLabel[preview.delivery.status]}</p>
 <p>Attachment: {preview.attachment.filename} · {preview.attachment.byteSize??"unavailable"} bytes</p>
 {!preview.attachmentAvailable&&<p role="alert">The exact archived PDF is unavailable or failed verification. Sending preparation is blocked; record a follow-up if needed.</p>}
 <button disabled={busy||!preview.attachmentAvailable} onClick={()=>void action("attachment")}>Download exact attachment</button>
 {preview.delivery.channel==="whatsapp"?<><label>Prepared WhatsApp message<textarea rows={12} readOnly value={preview.message}/></label><p>The WhatsApp link includes only the phone number and a generic company message. Copy this personalized message manually if desired. Download, attach and send the PDF yourself.</p>
 <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed this submitted recipient and the selected revision.</label>
 {reviewed&&preview.attachmentAvailable&&preview.whatsappUrl?<a href={preview.whatsappUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open WhatsApp conversation</a>:<p>Review the recipient and ensure the PDF is available to open WhatsApp.</p>}</>:
 <><p><strong>Email sending is disabled.</strong> No SMTP credentials or transport are configured by this feature.</p><p>To: {preview.email?.to}</p><p>Subject: {preview.email?.subject}</p><iframe title="Branded quotation email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">'+preview.email?.previewHtml}/><p>The email uses an inline CID logo for a future MIME attachment. Its browser preview embeds the public logo bytes locally; no localhost URL will enter outbound HTML.</p></>}
 {preview.delivery.status!=="MANUALLY_SENT"&&<><label>Internal dispatch notes (optional)<textarea maxLength={1000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><label className={styles.check}><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)}/>I manually sent this exact PDF revision to this reviewed recipient outside the application. This is not proof of receipt or reading.</label><div className={styles.actions}><button disabled={busy||!attested||!preview.attachmentAvailable} onClick={()=>void action("confirm","MANUALLY_SENT")}>Record manual dispatch</button><button disabled={busy} onClick={()=>void action("confirm","NEEDS_FOLLOW_UP")}>Record needs follow-up</button></div></>}
 <h4>Event history</h4><ul>{preview.delivery.events.map(e=><li key={e.id}>{statusLabel[e.status as keyof typeof statusLabel]} · {new Date(e.created_at).toLocaleString("en-GB")}<p>{e.notes}</p></li>)}</ul></>}
 <h4>Previous dispatch records</h4>{history.length?<ul>{history.map(d=><li key={d.id}><span>Revision {d.revision} · {d.channel} · {statusLabel[d.status]}</span>{d.revision_id===revision.id?<button disabled={busy} onClick={()=>{if(lock.current)return;lock.current=true;setBusy(true);void load(d.id).catch(()=>setMessage("Dispatch preview unavailable.")).finally(()=>{lock.current=false;setBusy(false);});}}>Review dispatch record</button>:<p>Select that revision above to manage its dispatch.</p>}</li>)}</ul>:<p>No dispatch has been prepared.</p>}
 </div></section>;
}
