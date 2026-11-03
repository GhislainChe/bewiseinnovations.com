"use client";
import { QuotationPanel } from "../quotations/panel";
import { ProjectIntakePanel } from "../projects/intake-panel";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { budgetUpdate, nextStatuses, requestBudgetLabel, serviceUpdate, type Attachment, type RequestDetail, type RequestRow, type StaffBudget, type StaffService } from "./staff-model";
import { parseBudget, parseService } from "./validation";
import styles from "./staff.module.css";

class StaffApiError extends Error {}
async function api(query: string, body?: unknown) {
  const response = await fetch("/internal/business-api" + query, { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined, headers: body ? { "Content-Type": "application/json" } : undefined,
    mode: "cors", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new StaffApiError(response.status === 409 ? "This record changed. Reload before editing again." : "Operation unavailable. Check your access and input, then reload to inspect the current state.");
  return data;
}
type Save = (operation: string, input: unknown) => Promise<boolean>;
export function StaffWorkspace({ mode, permissions }: { mode: "services" | "requests"; permissions: string[] }) {
  const [services, setServices] = useState<StaffService[]>([]), [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<{ detail: RequestDetail; attachments: Attachment[] } | null>(null);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("Loading your workspace…"), [pending, setPending] = useState(false), [revision, setRevision] = useState(0);
  const lock = useRef(false), detailGeneration = useRef(0);
  const has = (p: string) => permissions.includes(p);
  useEffect(() => {
    let active = true;
    void api(mode === "services" ? "?view=catalog" : "?view=requests").then(data => {
      if (!active) return;
      if (mode === "services") setServices(data); else setRequests(data);
      setMessage(data.length ? "Workspace up to date." : "No records yet.");
    }).catch(() => { if (active) setMessage("Workspace unavailable. Confirm your session and use Reload workspace to retry."); });
    return () => { active = false; };
  }, [mode, revision]);
  const save: Save = async (operation, input) => {
    if (lock.current) return false;
    lock.current = true; setPending(true);
    try {
      await api("", { operation, input });
      setSelected(null); detailGeneration.current++;
      setMessage("Saved and audited. Reloading the current records…"); setRevision(v => v + 1); return true;
    } catch (error) { setMessage(error instanceof StaffApiError ? error.message : "Result uncertain. Reload and inspect the current record before another update."); return false; }
    finally { lock.current = false; setPending(false); }
  };
  async function search(e: FormEvent) {
    e.preventDefault(); if (lock.current) return;
    const value = reference.trim();
    if (value && !/^BWR-[a-f0-9]{32}$/.test(value)) { setMessage("Enter the complete BWR- reference, or clear the field for recent requests."); return; }
    lock.current = true; setPending(true); setSelected(null); detailGeneration.current++;
    try { const data = await api("?view=requests&reference=" + encodeURIComponent(value)); setRequests(data); setMessage(data.length ? "Search complete." : "No matching request."); }
    catch { setMessage("Search unavailable. Check your session and try again."); }
    finally { lock.current = false; setPending(false); }
  }
  async function detail(id: string) {
    const generation = ++detailGeneration.current; setSelected(null);
    try { const data = await api("?view=detail&id=" + encodeURIComponent(id)); if (generation === detailGeneration.current) { setSelected(data.detail ? data : null); setMessage(data.detail ? "Request opened." : "Request unavailable."); } }
    catch { if (generation === detailGeneration.current) setMessage("Request unavailable. Check your session and access."); }
  }
  async function download(a: Attachment) {
    if (lock.current) return; lock.current = true; setPending(true);
    try {
      const data = await api("", { operation: "download", input: { id: a.id } });
      const url = new URL(data.url);
      if (url.origin !== "http://127.0.0.1:65421" || !url.pathname.startsWith("/storage/v1/object/sign/project-request-documents/")) throw new Error();
      const result = await fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!result.ok) throw new Error();
      const blob = await result.blob(); if (blob.size > 10485760) throw new Error();
      const objectUrl = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = objectUrl; link.download = a.display_name; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Clean document download authorized and audited.");
    } catch { setMessage("Document unavailable. Only authorized, clean files can be downloaded."); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className={styles.workspace}>
    <header className={styles.header}><Link href="/internal/services" className={styles.brand}>BE WISE <span>STAFF WORKSPACE</span></Link><nav aria-label="Staff navigation">
      {has("company.overview.read") && <Link href="/internal">Company Overview</Link>}
      {has("projects.read") && <Link href="/internal/projects">Projects</Link>}
      {(has("content.read") || has("services.budgets.manage")) && <Link href="/internal/services" aria-current={mode === "services" ? "page" : undefined}>Services</Link>}
      {has("inquiries.read") && <Link href="/internal/requests" aria-current={mode === "requests" ? "page" : undefined}>Client requests</Link>}
      {["content.read","products.technical.manage","waitlists.read"].some(has)&&<Link href="/internal/products">Products</Link>}{has("content.read")&&<Link href="/internal/editorial">Editorial</Link>}{["content.read","programs.operations.manage","applications.read"].some(has)&&<Link href="/internal/opportunities">Opportunities</Link>}{["content.read","events.operations.manage"].some(has)&&<Link href="/internal/events">Events</Link>}{has("events.checkin")&&<Link href="/internal/events/check-in">Check-in</Link>}{["enquiries.read","enquiries.assess"].some(has)&&<Link href="/internal/enquiries">Enquiries</Link>}<Link href="/auth/mfa">MFA</Link><Link href="/auth/sign-out">Sign out</Link></nav></header>
    <main className={styles.main}><a href="#workspace" className={styles.skip}>Skip to workspace</a>
      <p className={styles.eyebrow}>OPERATIONS / {mode === "services" ? "CATALOG" : "CLIENT REQUESTS"}</p>
      <h1>{mode === "services" ? "Shape what we offer." : "Every project starts here."}</h1>
      <p className={styles.intro}>{mode === "services" ? "Manage service content, intake and client-estimated budgets. These ranges are never fixed prices." : "Review requests privately, coordinate the next step and keep a clear operational record."}</p>
      <div className={styles.toolbar}><p role="status" aria-live="polite">{message}</p><button type="button" disabled={pending} onClick={() => { setSelected(null); detailGeneration.current++; setRevision(v => v + 1); }}>Reload workspace</button></div>
      <div id="workspace" tabIndex={-1} aria-busy={pending}>
        {mode === "services" ? <div className={styles.stack}>{services.map(s => <ServiceEditor key={s.id + ":" + s.version + ":" + revision} service={s} permissions={permissions} pending={pending} save={save} />)}</div> : <>
          <form className={styles.search} onSubmit={search}><label htmlFor="reference">Find by complete request reference</label><input id="reference" value={reference} onChange={e => setReference(e.target.value)} placeholder="BWR-…" autoComplete="off" spellCheck={false} /><button disabled={pending}>Search</button><p>Shows up to 100 most recent requests when empty.</p></form>
          <div className={styles.inbox}><section aria-label="Request list" className={styles.stack}>{requests.map(r => <button className={styles.request} key={r.id} onClick={() => void detail(r.id)} disabled={pending}><strong>{r.full_name}</strong><span>{r.reference}</span><span>{r.status} · {new Date(r.created_at).toLocaleDateString("en-GB")}</span></button>)}</section>
          <section className={styles.card} aria-label="Request details">{selected ? <RequestView detail={selected.detail} attachments={selected.attachments} pending={pending} canManage={has("inquiries.manage")} save={save} download={download} permissions={permissions} /> : <p>Select a request to view its details.</p>}</section></div>
        </>}
      </div>
    </main><footer className={styles.footer}>BE WISE INNOVATIONS · Private local workspace</footer>
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}>{label}{children}</label>; }
function ServiceEditor({ service: s, permissions, pending, save }: { service: StaffService; permissions: string[]; pending: boolean; save: Save }) {
  const [error, setError] = useState("");
  const canEdit = permissions.includes("content.update") && (s.status !== "published" || permissions.includes("content.publish"));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const input = serviceUpdate(s, new FormData(e.currentTarget));
    try { parseService(input); setError(""); await save("service", input); } catch { setError("Check the title, description and intake state. Only published services can accept requests."); }
  }
  return <section className={styles.card}><div className={styles.cardHeading}><h2>{s.title}</h2><span>{s.status} · {s.accepting_requests ? "Intake open" : "Intake paused"}</span></div>
    <form onSubmit={submit}><fieldset disabled={!canEdit || pending}><legend>Service content · version {s.version}</legend>
      <Field label="Service title"><input name="title" defaultValue={s.title} maxLength={160} required /></Field>
      <Field label="Description"><textarea name="description" defaultValue={s.description} maxLength={10000} required rows={3} /></Field>
      <div className={styles.row}><Field label="Publication status"><select name="status" defaultValue={s.status} disabled={!permissions.includes("content.publish")}><option value="draft">Draft</option><option value="published">Published</option><option value="retired">Retired</option></select></Field>
      {!permissions.includes("content.publish") && <input type="hidden" name="status" value={s.status} />}
      <label className={styles.check}><input type="checkbox" name="accepting" defaultChecked={s.accepting_requests} />Accept new requests</label></div>
      <button>Save service</button></fieldset>{error && <p role="alert">{error}</p>}
      {!canEdit && <p>Service content is read-only for your current permissions.</p>}</form>
    <details><summary>Estimated-budget options ({s.service_budget_options.length})</summary><p>Client estimates in FCFA (XAF, no decimal units). Preserve an active “Not sure yet” option. Pause options rather than deleting client history.</p>
      <div className={styles.stack}>{[...s.service_budget_options].sort((a,b) => a.sort_order-b.sort_order).map(b => <BudgetEditor key={b.id + ":" + b.version} budget={b} serviceId={s.id} pending={pending || !permissions.includes("services.budgets.manage")} save={save} />)}
      {permissions.includes("services.budgets.manage") && <BudgetEditor budget={null} serviceId={s.id} pending={pending} save={save} />}</div></details>
  </section>;
}
function BudgetEditor({ budget: b, serviceId, pending, save }: { budget: StaffBudget | null; serviceId: string; pending: boolean; save: Save }) {
  const [unsure, setUnsure] = useState(b?.is_unsure ?? false), [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, input = budgetUpdate(serviceId, b, new FormData(form));
    try { parseBudget(input); setError(""); if (await save("budget", input)) { if (!b) { form.reset(); setUnsure(false); } } } catch { setError("Check the label, whole FCFA amounts, range order and display order."); }
  }
  return <form onSubmit={submit} className={styles.budget}><fieldset disabled={pending}><legend>{b ? b.label : "Add budget option"}</legend>
    <Field label="Option label"><input name="label" defaultValue={b?.label ?? ""} maxLength={160} required /></Field>
    <div className={styles.row}><label className={styles.check}><input type="checkbox" name="unsure" checked={unsure} onChange={e => setUnsure(e.target.checked)} />Not sure option</label><label className={styles.check}><input type="checkbox" name="active" defaultChecked={b?.is_active ?? true} />Available in public form</label></div>
    <div className={styles.row}><Field label="From (FCFA)"><input type="number" name="min" min="0" max={Number.MAX_SAFE_INTEGER} step="1" disabled={unsure} defaultValue={b?.min_minor ?? ""} /></Field><Field label="To (FCFA; empty = open-ended)"><input type="number" name="max" min="0" max={Number.MAX_SAFE_INTEGER} step="1" disabled={unsure} defaultValue={b?.max_minor ?? ""} /></Field><Field label="Display order"><input type="number" name="sort" min="0" max="10000" defaultValue={b?.sort_order ?? 70} required /></Field></div><button>{b ? "Save budget option" : "Add budget option"}</button></fieldset>{error && <p role="alert">{error}</p>}</form>;
}
function RequestView({ detail: d, attachments, pending, canManage, save, download, permissions }: { permissions: string[]; detail: RequestDetail; attachments: Attachment[]; pending: boolean; canManage: boolean; save: Save; download: (a: Attachment) => Promise<void> }) {
  return <><p className={styles.eyebrow}>{d.status} · VERSION {d.version}</p><h2>{d.full_name}</h2><p className={styles.reference}>{d.reference}</p>
    <dl className={styles.data}><dt>Email</dt><dd>{d.email}</dd><dt>WhatsApp</dt><dd>{d.whatsapp}</dd><dt>Service at submission</dt><dd>{d.service_snapshot.title}</dd><dt>Estimated budget at submission</dt><dd>{requestBudgetLabel(d.budget_snapshot)}</dd><dt>Preferred deadline</dt><dd>{d.preferred_deadline ?? "Not sure yet"}</dd><dt>Project requirements</dt><dd className={styles.prose}>{d.requirements}</dd></dl>
    {canManage && nextStatuses(d.status).length > 0 ? <form key={d.id + d.version} onSubmit={e => { e.preventDefault(); void save("status", { id: d.id, version: d.version, status: new FormData(e.currentTarget).get("status") }); }}><Field label="Move to status"><select name="status">{nextStatuses(d.status).map(s => <option key={s}>{s}</option>)}</select></Field><button disabled={pending}>Update request status</button></form> : <p>No status changes available for this record or permission.</p>}
    {canManage&&<ProjectIntakePanel key={d.id+":"+d.version} requestId={d.id} requestVersion={d.version} status={d.status}/>}
    <QuotationPanel key={d.id} requestId={d.id} permissions={permissions} /><h3>Attachments</h3>{attachments.length ? <ul>{attachments.map(a => <li key={a.id}>{a.display_name} · {a.mime_type} · {a.byte_size} bytes · {a.scan_status}{a.scan_status === "clean" && <button disabled={pending} onClick={() => void download(a)}>Download clean file</button>}</li>)}</ul> : <p>No attachments. Public uploads remain disabled.</p>}</>;
}
