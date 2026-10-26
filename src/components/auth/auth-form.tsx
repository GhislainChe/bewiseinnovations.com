"use client";

import { useSyncExternalStore, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createAuthFormSubmitter, type AuthFormAction } from "@/lib/auth/form-submit";

/** Explicit CORS-mode fetch preserves Origin under no-referrer; native POST does not. */
const subscribe = () => () => {};
export function AuthForm({ action, children, label }: { action: AuthFormAction; children?: ReactNode; label: string }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitter = useRef<ReturnType<typeof createAuthFormSubmitter> | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitter.current) submitter.current = createAuthFormSubmitter(window.fetch.bind(window), window.location.origin, path => window.location.replace(path));
    const fields = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") { setFailed(true); return; }
      fields.append(name, value);
    }
    setPending(true);
    const result = await submitter.current(action, fields);
    if (result === "failed") setFailed(true);
  }
  return <form action={action} method="post" onSubmit={submit} className="flex flex-col gap-4">
    {children}
    <button className="rounded bg-slate-900 px-4 py-3 text-white disabled:opacity-60" type="submit" disabled={!ready || pending}>{pending ? "Please wait…" : label}</button>
    {failed && <p role="alert">Unable to complete this request. Stop and contact the administrator before trying again.</p>}
    <noscript><p>JavaScript is required to submit this secure authentication form.</p></noscript>
  </form>;
}
