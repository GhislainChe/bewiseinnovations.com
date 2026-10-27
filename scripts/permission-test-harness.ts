import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifiedIdentity } from "../src/lib/auth/assurance";
import { createSupabaseAuthGateway } from "../src/lib/auth/supabase-gateway";
import { AuthorizationError, requirePermission } from "../src/lib/auth/core";

/** Private callable probe; no HTTP endpoint or service credential. Caller SSR
 * client must come from an actual approved browser session, not synthesized claims.
 * The output contains only decisions/counts, never a JWT/cookie/user record. */
export async function probeContentTestPermissions(client: SupabaseClient, exactUserId: string) {
  const identity = await verifiedIdentity(client.auth);
  if (!identity || identity.id !== exactUserId) throw new Error("Test caller identity mismatch.");
  const gateway = createSupabaseAuthGateway(client);
  const decisions: Record<string, boolean> = {};
  for (const permission of ["content.read", "content.create", "content.update", "content.publish",
    "team.manage", "roles.assign", "settings.manage", "audit.read", "inquiries.read", "registrations.read", "waitlists.read"]) {
    try { await requirePermission(gateway, permission); decisions[permission] = true; }
    catch (error) {
      if (!(error instanceof AuthorizationError)) throw new Error("Permission probe unavailable.");
      decisions[permission] = false;
    }
  }
  const profile = await client.from("team_profiles").select("id").eq("id", exactUserId);
  const assignment = await client.from("team_role_assignments").select("user_id").eq("user_id", exactUserId);
  const audit = await client.from("audit_logs").select("id", { count: "exact", head: true });
  if (profile.error || assignment.error || audit.error) throw new Error("RLS read probe unavailable.");
  return { aal: identity.aal, decisions, ownProfileCount: profile.data.length,
    ownAssignmentCount: assignment.data.length, visibleAuditCount: audit.count ?? 0 };
}
