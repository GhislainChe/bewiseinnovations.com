"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type State = { aal: string; factors: { id: string; verified: boolean }[]; staffAccess: boolean; recovery: boolean };
async function readStatus(): Promise<State | null> {
  const result = await fetch("/auth/mfa/session", { cache: "no-store", credentials: "same-origin", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000) });
  return result.ok ? await result.json() as State : null;
}
function statusMessage(data: State | null) {
  return !data ? "Sign in through the approved sign-in flow to continue." : data.aal === "aal2"
    ? data.staffAccess ? "MFA verified. Staff permissions remain checked on every operation." : "MFA verified. Your account is pending activation."
    : "Complete MFA to continue. Password authentication alone grants no staff access.";
}
export function MfaPanel() {
  const [state, setState] = useState<State | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; secret: string } | null>(null);
  const [message, setMessage] = useState("Loading authentication status…");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function refresh() {
    try {
      const data = await readStatus();
      setState(data); setMessage(statusMessage(data));
    } catch { setMessage("Authentication status unavailable. Reload to retry."); }
  }
  useEffect(() => {
    let active = true;
    void readStatus().then(data => { if (active) { setState(data); setMessage(statusMessage(data)); } })
      .catch(() => { if (active) setMessage("Authentication status unavailable. Reload to retry."); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true);
    const element = event.currentTarget;
    const form = new URLSearchParams();
    for (const [key, value] of new FormData(element)) if (typeof value === "string") form.append(key, value);
    try {
      const result = await fetch("/auth/mfa/session", { method: "POST", body: form, mode: "cors", cache: "no-store", credentials: "same-origin", referrerPolicy: "no-referrer", redirect: "error", signal: AbortSignal.timeout(20000) });
      const data = await result.json();
      if (!result.ok) { setMessage("MFA request failed. Check your authenticator and session; reload if enrollment was interrupted."); return; }
      if (data.enrollment) setEnrollment(data.enrollment);
      else { setEnrollment(null); await refresh(); }
    } catch { setEnrollment(null); setMessage("Result uncertain. Reload and inspect your factor status before trying again."); }
    finally { element.reset(); busy.current = false; setPending(false); }
  }
  return <>
    <h1 className="text-2xl font-semibold">Authenticator security</h1>
    <noscript><p>JavaScript is required for secure authenticator setup.</p></noscript>
    <p role="status">{message}</p>
    {state && <>
      <p>Current assurance: {state.aal}. A verified enrollment is separate from authenticating this session.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input type="hidden" name="operation" value="enroll" />
        <button type="submit" disabled={pending || Boolean(enrollment) || state.factors.length >= 5 || (state.factors.some(f => f.verified) && state.aal !== "aal2")} className="underline">Set up an authenticator or backup factor</button>
      </form>
      {enrollment && <><p>Enter this setup key in your authenticator. Keep it private. It disappears when you leave or reload this page.</p><code className="break-all select-all">{enrollment.secret}</code></>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input type="hidden" name="operation" value="verify" />
        <label htmlFor="factor">Authenticator</label>
        <select name="factor_id" id="factor" required key={enrollment?.id ?? state.factors.length} defaultValue={enrollment?.id}>
          {enrollment && <option value={enrollment.id}>New authenticator</option>}
          {state.factors.filter(f => f.id !== enrollment?.id).map((f,i) => <option key={f.id} value={f.id}>Authenticator {i + 1} ({f.verified ? "verified" : "setup incomplete"})</option>)}
        </select>
        <label htmlFor="code">Six-digit authenticator code</label>
        <input name="code" id="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" minLength={6} maxLength={6} required />
        <button disabled={pending} className="rounded bg-slate-900 p-3 text-white" type="submit">Verify code</button>
      </form>
    </>}
    {state?.recovery && state.aal === "aal2" && <Link href="/auth/reset-password" prefetch={false} className="underline">Continue password recovery</Link>}
    <Link href="/auth/sign-in" prefetch={false} className="underline">Sign in</Link>
    <Link href="/auth/sign-out" prefetch={false} className="underline">Sign out</Link>
  </>;
}
