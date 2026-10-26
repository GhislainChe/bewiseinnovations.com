import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FLOW_COOKIE_NAME, readFlowTicket } from "@/lib/auth/flow";
import { AuthForm } from "@/components/auth/auth-form";

export default async function ResetPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const ticket = (await cookies()).get(FLOW_COOKIE_NAME)?.value;
  if (error || !data.user || !readFlowTicket(ticket, "recovery", data.user.id)) {
    return <><h1 className="text-2xl font-semibold">Recovery unavailable</h1><p>Request a new password recovery email.</p></>;
  }
  return <><h1 className="text-2xl font-semibold">Choose a new password</h1><p>Use at least 12 characters.</p>
    <AuthForm action="/auth/reset-password/complete" label="Reset password">
      <label className="flex flex-col gap-1">New password<input className="rounded border p-3" type="password" name="password" minLength={12} required autoComplete="new-password" /></label>
      <label className="flex flex-col gap-1">Confirm new password<input className="rounded border p-3" type="password" name="confirmation" minLength={12} required autoComplete="new-password" /></label>
    </AuthForm></>;
}
