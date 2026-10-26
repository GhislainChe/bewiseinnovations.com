"use client";

import { useSyncExternalStore } from "react";
import { readConfirmationFragment, type FragmentWindow } from "@/lib/auth/fragment";
import { AuthForm } from "./auth-form";

let snapshot: ReturnType<typeof readConfirmationFragment> | undefined;
const subscribe = () => () => {};
function readSnapshot() {
  if (snapshot === undefined) {
    const target = window as unknown as FragmentWindow;
    snapshot = readConfirmationFragment(target.__beWiseConfirmation?.() ?? "");
    window.addEventListener("pagehide", () => { snapshot = undefined; }, { once: true });
  }
  return snapshot;
}

export function ConfirmationLanding() {
  const input = useSyncExternalStore(subscribe, readSnapshot, () => undefined);
  if (input === undefined) return <><h1 className="text-2xl font-semibold">Secure confirmation</h1><p>Preparing the confirmation page. JavaScript is required.</p></>;
  if (!input) return <><h1 className="text-2xl font-semibold">Link unavailable</h1><p>This link is missing or invalid. Request a current email link.</p></>;
  return <>
    <h1 className="text-2xl font-semibold">{input.type === "invite" ? "Accept invitation" : "Confirm password recovery"}</h1>
    <p>Continue only if you requested this email. Opening this page has not used the link.</p>
    <AuthForm action="/auth/confirm/complete" label="Continue">
      <input type="hidden" name="token_hash" value={input.token} />
      <input type="hidden" name="type" value={input.type} />
    </AuthForm>
  </>;
}
