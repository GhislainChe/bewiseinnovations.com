import { AuthForm } from "@/components/auth/auth-form";
export default function SignInPage() {
  return <><h1 className="text-2xl font-semibold">Team authentication</h1><p>Invitation-only. Password sign-in continues to MFA; it does not grant staff access.</p>
    <AuthForm action="/auth/sign-in/complete" label="Sign in">
      <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} required />
      <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={1024} required />
    </AuthForm></>;
}
