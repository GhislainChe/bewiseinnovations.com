import Link from "next/link";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  const allowed = ["Password saved. Your account is pending activation.", "Password reset. You may sign in when an approved sign-in page is available."];
  return <><h1 className="text-2xl font-semibold">Authentication status</h1>
    <p>{allowed.includes(message ?? "") ? message : "This link is invalid, expired, or already used. Request a new email if needed."}</p>
    <Link className="underline" href="/auth/forgot-password">Request password recovery</Link>
  </>;
}
