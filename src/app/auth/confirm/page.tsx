import { confirmationType } from "@/lib/auth/flow";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: token, type: rawType } = await searchParams;
  const type = confirmationType(rawType);
  if (!type || !token || token.length > 2048) {
    return <><h1 className="text-2xl font-semibold">Link unavailable</h1><p>This link is missing or invalid. Request a new email.</p></>;
  }
  return <>
    <h1 className="text-2xl font-semibold">{type === "invite" ? "Accept invitation" : "Confirm password recovery"}</h1>
    <p>Continue only if you requested this email. Opening this page has not used the link.</p>
    <form action="/auth/confirm/complete" method="post" className="flex flex-col gap-4">
      <input type="hidden" name="token_hash" value={token} />
      <input type="hidden" name="type" value={type} />
      <button className="rounded bg-slate-900 px-4 py-3 text-white" type="submit">Continue</button>
    </form>
  </>;
}
