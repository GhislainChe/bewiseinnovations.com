export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return <><h1 className="text-2xl font-semibold">Password recovery</h1>
    {sent ? <p>If the address is eligible, a recovery email will arrive shortly.</p> : <>
      <p>Enter your account email. We will send recovery instructions if the address is eligible.</p>
      <form action="/auth/forgot-password/request" method="post" className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">Email<input className="rounded border p-3" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
        <button className="rounded bg-slate-900 px-4 py-3 text-white" type="submit">Request recovery email</button>
      </form>
    </>}
  </>;
}
