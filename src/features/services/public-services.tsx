"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { blankRequest, budgetLabel, createRequestSender, decodeCatalog, requestErrors, requestPayload, type PublicService, type RequestFields } from "./public-model";
import styles from "./public-services.module.css";

function Arrow() { return <span aria-hidden="true">↗</span>; }
function Shell({ children }: { children: ReactNode }) {
  return <div className={styles.site}><a className={styles.skip} href="#main-content">Skip to content</a><header className={styles.header}><Link href="/services" className={styles.brand}>BE WISE<span>INNOVATIONS</span></Link><nav aria-label="Main navigation"><Link href="/services">Services</Link><Link href="/products">Products</Link><Link href="/inside-be-wise">Inside BE WISE</Link><Link href="/opportunities">Opportunities</Link><Link href="/events">Events</Link><Link href="/contact">Contact</Link><Link href="/request-a-quote" className={styles.navCta}>Let’s talk <Arrow /></Link></nav></header>{children}<footer className={styles.footer}><p>BE WISE INNOVATIONS</p><a href="mailto:contact@bewiseinnovation.com">contact@bewiseinnovation.com</a></footer></div>;
}
function Visual({ index = 0 }: { index?: number }) {
  return <svg className={styles.visual} viewBox="0 0 220 150" fill="none" aria-hidden="true"><circle cx="110" cy="75" r="53" stroke="currentColor" strokeWidth="1" /><rect x="60" y="25" width="100" height="100" rx={index % 2 ? 50 : 15} transform={`rotate(${index % 2 ? 45 : -12} 110 75)`} stroke="currentColor" strokeWidth="1" /><circle cx="110" cy="75" r="16" fill="currentColor" /><path d="M22 75h56m64 0h56M110 0v40m0 70v40" stroke="currentColor" strokeWidth="1" /></svg>;
}
export function ServicesContent({ services }: { services: PublicService[] }) {
  return <><section className={styles.hero}><div><p className={styles.eyebrow}>Our services</p><h1>Thoughtful work.<br /><span>Meaningful progress.</span></h1><p className={styles.intro}>Explore how we can help bring your next idea to life. Tell us what you have in mind, and let’s find the right way forward.</p></div><div className={styles.heroArt}><Visual /></div></section>
    <section aria-labelledby="service-heading"><div className={styles.sectionHeading}><h2 id="service-heading">Explore our expertise</h2><p>Built around your ambitions.</p></div>{services.length ? <div className={styles.grid}>{services.map((s, i) => <article key={s.id} className={styles.card}><div className={styles.cardTop}><span>{String(i + 1).padStart(2, "0")}</span><Visual index={i} /></div><h3>{s.title}</h3><p className={styles.description}>{s.description}</p>{s.accepting_requests ? <Link href={`/request-a-quote?service=${encodeURIComponent(s.id)}`} className={styles.cardLink}>Request a quote <Arrow /></Link> : <p className={styles.paused}>New requests are currently paused.</p>}</article>)}</div> : <div className={styles.notice}><h3>Our service catalog is being prepared.</h3><p>Please check back soon, or contact us to discuss your idea.</p><a href="mailto:contact@bewiseinnovation.com">Contact BE WISE <Arrow /></a></div>}</section>
    <section className={styles.closing}><p className={styles.eyebrow}>A conversation comes first</p><h2>Start with an idea.<br />We’ll explore it together.</h2><Link className={styles.primary} href="/request-a-quote">Tell us about your project <Arrow /></Link></section></>;
}
export function ProjectRequestForm({ services, selectedService }: { services: PublicService[]; selectedService?: string }) {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const available = services.filter(s => s.accepting_requests);
  const [fields, setFields] = useState<RequestFields>({ ...blankRequest, serviceId: available.some(s => s.id === selectedService) ? selectedService! : "" });
  const [errors, setErrors] = useState<ReturnType<typeof requestErrors>>({});
  const [state, setState] = useState<"editing" | "sending" | "uncertain" | "done">("editing");
  const [reference, setReference] = useState("");
  const sender = useRef<ReturnType<typeof createRequestSender> | null>(null);
  const busy = useRef(false), summary = useRef<HTMLDivElement>(null), result = useRef<HTMLDivElement>(null);
  const service = available.find(s => s.id === fields.serviceId), locked = state !== "editing";
  function change<K extends keyof RequestFields>(name: K, value: RequestFields[K]) {
    setFields(current => ({ ...current, [name]: value, ...(name === "serviceId" ? { budgetOptionId: "" } : {}) }));
    setErrors({});
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || state === "done") return;
    const next = requestErrors(fields, available); setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => summary.current?.focus()); return; }
    busy.current = true; setState("sending");
    sender.current ??= createRequestSender();
    const response = await sender.current(requestPayload(fields));
    busy.current = false;
    if (response.kind === "success") { setReference(response.reference); setFields({ ...blankRequest }); setState("done"); requestAnimationFrame(() => result.current?.focus()); }
    else { setState("uncertain"); }
  }
  const fieldError = (key: keyof RequestFields) => errors[key] ? <p id={`${key}-error`} className={styles.fieldError}>{errors[key]}</p> : null;
  const attrs = (key: keyof RequestFields) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${key}-error` : undefined });
  if (!available.length) return <div className={styles.notice}><h2>Project requests are not available right now.</h2><p>Please check back when our service catalog opens.</p><Link href="/services">Back to services</Link></div>;
  if (state === "done") return <div className={styles.success} tabIndex={-1} ref={result}><p className={styles.eyebrow}>Request received</p><h2>Thank you for sharing your idea.</h2><p>Your project request is saved. Keep this reference for any follow-up:</p><p className={styles.reference}>{reference}</p><p>This confirms receipt, not a quotation or delivery commitment. No email or WhatsApp message has been sent.</p><Link href="/services" className={styles.cardLink}>Explore services <Arrow /></Link></div>;
  return <form method="post" action="/api/project-requests" onSubmit={submit} noValidate className={styles.form} aria-busy={!hydrated || state === "sending"}>
    {!!Object.keys(errors).length && <div role="alert" className={styles.errorSummary} tabIndex={-1} ref={summary}><h2>Please check your request</h2><ul>{Object.entries(errors).map(([key, message]) => <li key={key}><a href={`#${key}`}>{message}</a></li>)}</ul></div>}
    <fieldset disabled={locked} className={styles.fieldset}><legend>01 — Your details</legend><div className={styles.twoColumns}>
      <div><label htmlFor="fullName">Full name <span>(required)</span></label><input id="fullName" name="fullName" autoComplete="name" required maxLength={160} value={fields.fullName} onChange={e => change("fullName", e.target.value)} {...attrs("fullName")} />{fieldError("fullName")}</div>
      <div><label htmlFor="email">Email <span>(required)</span></label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={fields.email} onChange={e => change("email", e.target.value)} {...attrs("email")} />{fieldError("email")}</div>
    </div><div><label htmlFor="whatsapp">WhatsApp contact <span>(required)</span></label><input id="whatsapp" name="whatsapp" type="tel" autoComplete="tel" inputMode="tel" required maxLength={16} placeholder="+ country code and number" value={fields.whatsapp} onChange={e => change("whatsapp", e.target.value)} aria-describedby={`whatsapp-help${errors.whatsapp ? " whatsapp-error" : ""}`} aria-invalid={Boolean(errors.whatsapp)} /><p className={styles.hint} id="whatsapp-help">Use international format, including the + and country code.</p>{fieldError("whatsapp")}</div></fieldset>
    <fieldset disabled={locked} className={styles.fieldset}><legend>02 — Your project</legend><div><label htmlFor="serviceId">Service <span>(required)</span></label><select id="serviceId" name="serviceId" required value={fields.serviceId} onChange={e => change("serviceId", e.target.value)} {...attrs("serviceId")}><option value="">Select a service</option>{available.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>{fieldError("serviceId")}</div>
    <div><label htmlFor="budgetOptionId">Estimated budget {service?.service_budget_options.length ? <span>(required)</span> : <span>(if available)</span>}</label><select id="budgetOptionId" name="budgetOptionId" disabled={!service || !service.service_budget_options.length} required={Boolean(service?.service_budget_options.length)} value={fields.budgetOptionId} onChange={e => change("budgetOptionId", e.target.value)} aria-describedby={`budget-help${errors.budgetOptionId ? " budgetOptionId-error" : ""}`} aria-invalid={Boolean(errors.budgetOptionId)}><option value="">{!service ? "Choose a service first" : service.service_budget_options.length ? "Select your budget range" : "No budget selection needed"}</option>{service?.service_budget_options.map(b => <option key={b.id} value={b.id}>{budgetLabel(b)}</option>)}</select><p id="budget-help" className={styles.hint}>This helps us understand your plans. It is not a price or a quotation.</p>{fieldError("budgetOptionId")}</div>
    <div><label htmlFor="requirements">Project description <span>(required)</span></label><textarea id="requirements" name="requirements" rows={6} required minLength={20} maxLength={10000} placeholder="What would you like to achieve? Tell us about your goals and what you need." value={fields.requirements} onChange={e => change("requirements", e.target.value)} {...attrs("requirements")} />{fieldError("requirements")}</div>
    <fieldset className={styles.deadline}><legend>Preferred deadline</legend><label className={styles.choice}><input type="radio" name="deadline" checked={!fields.deadlineKnown} onChange={() => change("deadlineKnown", false)} />Not sure yet</label><label className={styles.choice}><input type="radio" name="deadline" checked={fields.deadlineKnown} onChange={() => change("deadlineKnown", true)} />I have a date in mind</label>{fields.deadlineKnown && <div><label htmlFor="preferredDeadline">Preferred date <span>(required)</span></label><input id="preferredDeadline" name="preferredDeadline" type="date" required value={fields.preferredDeadline} onChange={e => change("preferredDeadline", e.target.value)} {...attrs("preferredDeadline")} />{fieldError("preferredDeadline")}</div>}<p className={styles.hint}>We’ll discuss timing with you. Your preferred date is not a delivery commitment.</p></fieldset>
    <p className={styles.attachmentNote}>Attachments are not available yet. Please describe your project here.</p>
    <label className={styles.choice}><input id="consent" name="consent" type="checkbox" required checked={fields.consent} onChange={e => change("consent", e.target.checked)} {...attrs("consent")} /><span>I agree that BE WISE INNOVATIONS may use these details to review and respond to my project request. <span>(required)</span></span></label>{fieldError("consent")}
    <div className={styles.trap} aria-hidden="true"><label htmlFor="website">Leave this field empty</label><input id="website" name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={e => change("website", e.target.value)} /></div></fieldset>
    <div role="status" aria-live="polite">{state === "sending" && <p>Saving your request… Please keep this tab open.</p>}{state === "uncertain" && <p className={styles.errorSummary}>We couldn’t confirm your request. Your details are locked so you can retry the same request safely. Please don’t send a new copy. If this continues, contact contact@bewiseinnovation.com. Leaving this page clears the retry information.</p>}</div>
    <button className={styles.primary} type="submit" disabled={!hydrated || state === "sending"}>{!hydrated ? "Preparing form…" : state === "sending" ? "Saving request…" : state === "uncertain" ? "Retry the same request" : "Send project request"}<Arrow /></button><p className={styles.hint}>No account required. Your details stay out of the public catalog.</p>
  </form>;
}
export function PublicServices({ mode, selectedService }: { mode: "catalog" | "request"; selectedService?: string }) {
  const [catalog, setCatalog] = useState<PublicService[] | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/services", { cache: "no-store", credentials: "omit", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (!controller.signal.aborted) setCatalog(decodeCatalog(data)); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  return <Shell><main id="main-content" tabIndex={-1} className={styles.main}>{mode === "catalog" && (failed || catalog === null) && <header className={styles.requestHero}><p className={styles.eyebrow}>BE WISE INNOVATIONS</p><h1>Our services</h1></header>}{mode === "request" && <header className={styles.requestHero}><p className={styles.eyebrow}>Request a quote</p><h1>Tell us what<br /><span>you have in mind.</span></h1><p>Every project starts with a conversation. Share the essentials below — no account needed.</p><Link href="/services">← Explore services</Link></header>}
    {failed ? <div role="alert" className={styles.notice}><h2>We couldn’t load our services.</h2><p>Please try again in a moment. No request has been sent.</p><button type="button" className={styles.primary} onClick={() => { setFailed(false); setCatalog(null); setAttempt(n => n + 1); }}>Try loading again</button></div> : catalog === null ? <div role="status" className={styles.notice}>Loading services…</div> : mode === "catalog" ? <ServicesContent services={catalog} /> : <div className={styles.requestLayout}><aside><p className={styles.eyebrow}>A clear starting point</p><h2>Your vision.<br />Our next conversation.</h2><p>Choose the service that fits your idea. Budget options help guide the discussion; pricing is agreed individually.</p><p>Prefer email?<br /><a href="mailto:contact@bewiseinnovation.com">contact@bewiseinnovation.com</a></p></aside><ProjectRequestForm services={catalog} selectedService={selectedService} /></div>}
    <noscript><p>JavaScript is needed to load current services and securely submit a request. You can contact contact@bewiseinnovation.com instead.</p></noscript></main></Shell>;
}
