import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FLOW_COOKIE_NAME, readFlowTicket } from "@/lib/auth/flow";
import { AuthForm } from "@/components/auth/auth-form";
import Link from "next/link";
import { passwordMfaState } from "@/lib/auth/password-mfa";

export default async function ResetPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const ticket = (await cookies()).get(FLOW_COOKIE_NAME)?.value;
  if (error || !data.user || !readFlowTicket(ticket, "recovery", data.user.id)) {
    return <><h1 className="text-2xl font-semibold">Recovery unavailable</h1><p>Request a new password recovery email.</p></>;
  }
  const assurance = await passwordMfaState(client.auth, data.user.id);
  if (assurance === "denied") return <><h1>Recovery unavailable</h1><p>Sign out and request a fresh recovery link.</p></>;
  if (assurance === "required") return <><h1 className="text-2xl font-semibold">Verify your authenticator</h1>
    <p>Your recovery link does not bypass MFA. Complete an authenticator challenge, then return here within ten minutes of confirming your email.</p>
    <Link href="/auth/mfa" prefetch={false} className="underline">Continue to MFA</Link></>;
  return <><h1 className="text-2xl font-semibold">Choose a new password</h1><p>Use at least 12 characters.</p>
    <AuthForm action="/auth/reset-password/complete" label="Reset password">
      <label className="flex flex-col gap-1">New password<input className="rounded border p-3" type="password" name="password" minLength={12} required autoComplete="new-password" /></label>
      <label className="flex flex-col gap-1">Confirm new password<input className="rounded border p-3" type="password" name="confirmation" minLength={12} required autoComplete="new-password" /></label>
    </AuthForm></>;
}
