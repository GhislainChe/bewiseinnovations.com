"use client";
import { DeliveryPanel } from "../delivery/panel";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { parseQuotation,quoteTotal,type QuoteContent,type QuoteHistory,type QuoteRevision } from "./model";
import styles from "./panel.module.css";
async function api(query: string,operation?: string,input?: unknown) {
  const result=await fetch("/internal/quotation-api"+query,{method:operation?"POST":"GET",body:operation?JSON.stringify({operation,input}):undefined,headers:operation?{"Content-Type":"application/json"}:undefined,
    mode:"cors",credentials:"same-origin",cache:"no-store",redirect:"error",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(30000)});
  if(!result.ok)throw new Error(result.status===409?"This revision changed. Reload history before continuing.":"Operation unavailable. Check permissions and fields, then reload to inspect the saved state.");
  return result;
}
export function QuotationPanel({requestId,permissions}:{requestId:string;permissions:string[]}) {
  const has=(p:string)=>permissions.includes(p),canRead=has("quotations.read"),canManage=has("quotations.manage")&&canRead,canExport=has("documents.export");
  const [history,setHistory]=useState<QuoteHistory[]>([]),[revision,setRevision]=useState<QuoteRevision|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[generation,setGeneration]=useState(0);
  const lock=useRef(false);
  useEffect(()=>{let active=true;
    if(canRead)void api("?view=history&id="+encodeURIComponent(requestId)).then(r=>r.json()).then(v=>{if(active)setHistory(v);}).catch(()=>{if(active)setMessage("Quotation history unavailable.");});
    return ()=>{active=false;};
  },[requestId,canRead,generation]);
  async function run(operation:string,input:unknown) {
    if(lock.current)return;lock.current=true;setBusy(true);setMessage("");
    try {
      const response=await api("",operation,input);
      if(operation.endsWith("-pdf")) {
        const blob=await response.blob();if(blob.type!=="application/pdf"||blob.size>2000000)throw new Error();
        const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=operation==="request-pdf"?"bewise-internal-project-request.pdf":"bewise-quotation.pdf";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Private PDF download prepared. Store it securely.");
      } else {setRevision(await response.json());setGeneration(g=>g+1);setMessage(operation==="finalize"?"Quotation finalized. This revision is immutable.":"Draft saved. Review before finalizing.");}
    } catch(error) {setMessage(error instanceof Error && ["This revision changed. Reload history before continuing.","Operation unavailable. Check permissions and fields, then reload to inspect the saved state."].includes(error.message)?error.message:"Result uncertain. Reload history and inspect the revision before another attempt.");}
    finally {lock.current=false;setBusy(false);}
  }
  async function open(id:string) {if(lock.current)return;lock.current=true;setBusy(true);try{setRevision(await(await api("?view=revision&id="+id)).json());}catch{setMessage("Revision unavailable.");}finally{lock.current=false;setBusy(false);}}
  return <section className={styles.panel} aria-label="Request documents and quotations">
    <h3>Documents & quotation</h3>
    <div className={styles.actions}>{canExport&&<button disabled={busy} onClick={()=>void run("request-pdf",{id:requestId})}>Download Request PDF</button>}
    {canRead&&<button disabled={busy} onClick={()=>{setRevision(null);setGeneration(g=>g+1);setMessage("History refreshed. Open the current revision to inspect it.");}}>Reload quotation history</button>}
    {canManage&&!history.some(r=>r.state==="draft")&&history.length===0&&<button disabled={busy} onClick={()=>void run("create",{requestId})}>Prepare Quotation</button>}</div>
    <p role="status" aria-live="polite">{message}</p>
    {canRead&&<><h4>Quotation history</h4>{history.length?<ul>{history.map(r=><li key={r.id}><button disabled={busy} onClick={()=>void open(r.id)}>Revision {r.revision} · {r.state}</button><span>{r.number}</span></li>)}</ul>:<p>No quotation revisions yet.</p>}</>}
    {revision&&(revision.state==="draft"&&canManage?<QuotationEditor key={revision.id+":"+revision.version} revision={revision} busy={busy} canFinalize={canExport} save={content=>run("save",{id:revision.id,version:revision.version,content})} finalize={()=>run("finalize",{id:revision.id,version:revision.version})}/>:<>
      <h4>{revision.state==="finalized"?"Finalized quotation":"Draft quotation (read-only)"} · revision {revision.revision}</h4><p>{revision.document.number}</p><p>Total proposed: {revision.document.content.items.length?revision.document.total.toLocaleString("en")+" FCFA (XAF)":"No price entered."}</p><p>Valid until: {revision.document.content.validUntil??"Not set"}</p>
      <details><summary>View finalized details</summary><p>{revision.document.client.name} · {revision.document.client.email}</p>{(["projectDescription","scope","deliverables","timeline","paymentTerms","notes","exclusions"] as const).map(k=><div key={k}><strong>{labels[k]}</strong><p className={styles.prose}>{revision.document.content[k]}</p></div>)}<ul>{revision.document.content.items.map((i,n)=><li key={n}>{i.description}: {i.quantity} × {i.unitAmount?.toLocaleString("en")} FCFA</li>)}</ul></details>
      <div className={styles.actions}>{canExport&&revision.state==="finalized"&&<button disabled={busy} onClick={()=>void run("quotation-pdf",{id:revision.id})}>Download Quotation PDF</button>}
      {canManage&&revision.state==="finalized"&&history[0]?.id===revision.id&&<button disabled={busy} onClick={()=>void run("create",{requestId,baseId:revision.id})}>Prepare new revision</button>}</div>
      {revision.state==="finalized"&&<DeliveryPanel key={revision.id} requestId={requestId} revision={revision} permissions={permissions}/>}
    </>)}
  </section>;
}
const labels={projectDescription:"Service / project description",scope:"Scope of work",deliverables:"Deliverables",timeline:"Estimated delivery timeline",paymentTerms:"Payment terms",notes:"Client-facing notes",exclusions:"Exclusions"};
function QuotationEditor({revision,busy,canFinalize,save,finalize}:{revision:QuoteRevision;busy:boolean;canFinalize:boolean;save:(c:QuoteContent)=>Promise<void>;finalize:()=>Promise<void>}) {
  const [content,setContent]=useState<QuoteContent>(revision.document.content),[error,setError]=useState(""),[review,setReview]=useState(false);
  const dirty=JSON.stringify(content)!==JSON.stringify(revision.document.content);
  function change<K extends keyof QuoteContent>(key:K,value:QuoteContent[K]) {setReview(false);setContent(c=>({...c,[key]:value}));}
  function submit(e:FormEvent) {e.preventDefault();try{parseQuotation(content);setError("");void save(content);}catch(e){setError(e instanceof Error?e.message:"Check draft fields.");}}
  function prepareReview() {try{if(revision.document.templateVersion!==2)throw new Error("Save the draft to apply current branding before finalizing.");parseQuotation(content,true);if(dirty)throw new Error("Save the draft before reviewing it.");setError("");setReview(true);}catch(e){setError(e instanceof Error?e.message:"Complete the draft.");}}
  let total:string;try{total=content.items.length?quoteTotal(content.items).toLocaleString("en")+" FCFA (XAF)":"No price entered.";}catch{total="Complete the line items to calculate a total.";}
  return <form onSubmit={submit} className={styles.editor}><h4>Draft · revision {revision.revision}</h4><p>{revision.document.number} · version {revision.version}</p>
    <p>Client: {revision.document.client.name} · {revision.document.client.email} · {revision.document.client.whatsapp}</p><p>Service: {revision.document.request.service}. Contact details are copied from the original request; ownership is not independently verified.</p>
    <fieldset disabled={busy||review}><legend>Quotation preparation</legend>
      {(Object.keys(labels) as (keyof typeof labels)[]).map(k=><label key={k}>{labels[k]}<textarea value={content[k]} rows={k==="scope"||k==="projectDescription"?4:2} maxLength={k==="projectDescription"?10000:3000} onChange={e=>change(k,e.target.value)}/></label>)}
      <label>Valid until<input type="date" value={content.validUntil??""} onChange={e=>change("validUntil",e.target.value||null)}/></label>
      <h4>Itemized amounts · FCFA (XAF)</h4><p>Enter agreed amounts explicitly. The client&apos;s estimated budget does not set the price. No tax or currency conversion is inferred.</p>
      {content.items.map((item,n)=><div className={styles.item} key={n}><label>Item {n+1} description<input value={item.description} maxLength={300} onChange={e=>change("items",content.items.map((i,j)=>j===n?{...i,description:e.target.value}:i))}/></label><div className={styles.row}><label>Quantity<input type="number" min="1" max="100000" step="1" value={item.quantity||""} onChange={e=>change("items",content.items.map((i,j)=>j===n?{...i,quantity:e.target.value===""?0:Number(e.target.value)}:i))}/></label><label>Unit amount (FCFA)<input type="number" min="0" max="1000000000000" step="1" value={item.unitAmount??""} onChange={e=>change("items",content.items.map((i,j)=>j===n?{...i,unitAmount:e.target.value===""?null:Number(e.target.value)}:i))}/></label></div><button type="button" onClick={()=>change("items",content.items.filter((_,j)=>j!==n))}>Remove item {n+1}</button></div>)}
      <button type="button" disabled={content.items.length>=25} onClick={()=>change("items",[...content.items,{description:"",quantity:1,unitAmount:null}])}>Add line item</button>
      <label className={styles.check}><input type="checkbox" checked={content.teamAgreement} onChange={e=>change("teamAgreement",e.target.checked)}/>I confirm the founders discussed and agreed this proposed pricing outside the platform.</label>
    </fieldset><p><strong>Total proposed: {total}</strong></p>
    {error&&<p role="alert">{error}</p>}
    {!review?<div className={styles.actions}><button disabled={busy}>Save Draft</button>{canFinalize&&<button type="button" disabled={busy||dirty} onClick={prepareReview}>Review and Finalize</button>}</div>:<div className={styles.review}><h4>Final review</h4><p>Review the saved scope, line items, total and terms above. Finalization locks this revision and preserves its private PDF. Future changes require a new revision. Nothing will be sent to the client.</p><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void finalize()}>Finalize this revision</button><button type="button" disabled={busy} onClick={()=>setReview(false)}>Back to editing</button></div></div>}
  </form>;
}
