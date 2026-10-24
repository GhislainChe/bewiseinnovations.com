import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FLOW_COOKIE_NAME, readFlowTicket } from "@/lib/auth/flow";

export default async function SetPasswordPage() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  const ticket = (await cookies()).get(FLOW_COOKIE_NAME)?.value;
  if (error || !data.user || !readFlowTicket(ticket, "invite", data.user.id)) {
    return <><h1 className="text-2xl font-semibold">Invitation unavailable</h1><p>Open a valid invitation email to set your password.</p><Link href="/auth/error">Help</Link></>;
  }
  return <><h1 className="text-2xl font-semibold">Set your password</h1><p>Choose a password of at least 12 characters.</p>
    <form action="/auth/set-password/complete" method="post" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">Password<input className="rounded border p-3" type="password" name="password" minLength={12} required autoComplete="new-password" /></label>
      <label className="flex flex-col gap-1">Confirm password<input className="rounded border p-3" type="password" name="confirmation" minLength={12} required autoComplete="new-password" /></label>
      <button className="rounded bg-slate-900 px-4 py-3 text-white" type="submit">Save password</button>
    </form></>;
}
