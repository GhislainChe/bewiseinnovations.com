import Link from "next/link";
import { SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED } from "@/lib/auth/sign-out";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  const allowed = ["Password saved. Your account is pending activation.", "Password reset. You may sign in when an approved sign-in page is available.", SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED];
  return <><h1 className="text-2xl font-semibold">Authentication status</h1>
    <p>{allowed.includes(message ?? "") ? message : "This link is invalid, expired, or already used. Request a new email if needed."}</p>
    <Link className="underline" href={message === SIGN_OUT_FAILED ? "/auth/sign-out" : "/auth/forgot-password"} prefetch={false}>{message === SIGN_OUT_FAILED ? "Retry sign-out" : "Request password recovery"}</Link>
  </>;
}
