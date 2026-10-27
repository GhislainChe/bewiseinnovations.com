import Link from "next/link";
import { SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED } from "@/lib/auth/sign-out";
import { SIGN_IN_FAILED } from "@/lib/auth/sign-in";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  const allowed = ["Password saved. Your account is pending activation.", "Password reset. You may sign in when an approved sign-in page is available.", SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED, SIGN_IN_FAILED];
  return <><h1 className="text-2xl font-semibold">Authentication status</h1>
    <p>{allowed.includes(message ?? "") ? message : "This link is invalid, expired, or already used. Request a new email if needed."}</p>
    <Link className="underline" href={message === SIGN_OUT_FAILED ? "/auth/sign-out" : message === SIGN_IN_FAILED ? "/auth/sign-in" : "/auth/forgot-password"} prefetch={false}>{message === SIGN_OUT_FAILED ? "Retry sign-out" : message === SIGN_IN_FAILED ? "Retry sign-in" : "Request password recovery"}</Link>
    {message === "Password saved. Your account is pending activation." && <Link className="underline" href="/auth/sign-in" prefetch={false}>Sign in to set up your authenticator</Link>}
  </>;
}
