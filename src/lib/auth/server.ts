import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentTeamMember as getMember,
  hasPermission as checkPermission,
  requirePermission as enforcePermission,
  requireTeamMember as enforceMember,
  signInTeamMember as signIn,
  signOutTeamMember as signOut,
} from "@/lib/auth/core";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";

/** Call these only in request-scoped Server Components, Actions, or Route Handlers. */
async function gateway() {
  return createSupabaseAuthGateway(await createClient());
}

export async function getCurrentTeamMember() {
  return getMember(await gateway());
}

export async function requireTeamMember() {
  return enforceMember(await gateway());
}

export async function hasPermission(code: string) {
  return checkPermission(await gateway(), code);
}

export async function requirePermission(code: string) {
  return enforcePermission(await gateway(), code);
}

export async function signInTeamMember(email: string, password: string) {
  return signIn(await gateway(), email, password);
}

export async function signOutTeamMember() {
  return signOut(await gateway());
}
