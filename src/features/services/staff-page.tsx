import "server-only";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";
import { requireTeamMember } from "@/lib/auth/core";
import { assertLocalBusinessRuntime } from "./runtime";
import { StaffWorkspace } from "./staff-workspace";
import styles from "./staff.module.css";

export async function StaffPage({ mode }: { mode: "services" | "requests" }) {
  let permissions: string[] | null = null;
  try {
    assertLocalBusinessRuntime();
    const member = await requireTeamMember(createSupabaseAuthGateway(await createClient()));
    const allowed = mode === "requests" ? member.permissionCodes.includes("inquiries.read") : member.permissionCodes.some(p => ["content.read", "services.budgets.manage"].includes(p));
    if (!allowed) throw new Error();
    permissions = member.permissionCodes;
  } catch { /* Fail closed without serializing private data or provider errors. */ }
  if (permissions) return <StaffWorkspace mode={mode} permissions={permissions} />;
  return <main className={styles.shell}><p className={styles.brand}>BE WISE INNOVATIONS · STAFF</p><h1>Staff access required</h1><p>Use an active staff account with the required permission and a verified MFA session. No private records have been loaded.</p><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;
}
