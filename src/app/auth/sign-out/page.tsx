import { AuthForm } from "@/components/auth/auth-form";

export default function SignOutPage() {
  return <><h1 className="text-2xl font-semibold">Sign out</h1>
    <p>Retry ending this browser session. No password or email link is required.</p>
    <AuthForm action="/auth/sign-out/complete" label="Sign out" />
  </>;
}
