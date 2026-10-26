import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway, CatalogEntry, Profile } from "@/lib/auth/core";
import { endCurrentSession } from "./sign-out";

function rowsOrThrow<T>(result: { data: T[] | null; error: unknown }): T[] {
  if (result.error) throw new Error("Unable to load staff authorization data.");
  return result.data ?? [];
}

/** Queries use the caller's SSR client, so the existing RLS policies still apply. */
export function createSupabaseAuthGateway(client: SupabaseClient): AuthGateway {
  return {
    async getVerifiedUserId() {
      // getUser calls Supabase Auth; cookie contents and user metadata are not trusted.
      const { data, error } = await client.auth.getUser();
      return error ? null : (data.user?.id ?? null);
    },
    async getProfile(userId): Promise<Profile | null> {
      const { data, error } = await client
        .from("team_profiles")
        .select("id, full_name, is_active")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error("Unable to load staff authorization data.");
      return data
        ? { id: data.id, fullName: data.full_name, isActive: data.is_active }
        : null;
    },
    async getRoleIds(userId) {
      const result = await client
        .from("team_role_assignments")
        .select("role_id")
        .eq("user_id", userId);
      return rowsOrThrow(result).map((row) => row.role_id);
    },
    async getRoles(roleIds): Promise<CatalogEntry[]> {
      const result = await client.from("roles").select("id, code").in("id", roleIds);
      return rowsOrThrow(result);
    },
    async getPermissionIds(roleIds) {
      const result = await client
        .from("role_permissions")
        .select("permission_id")
        .in("role_id", roleIds);
      return rowsOrThrow(result).map((row) => row.permission_id);
    },
    async getPermissions(permissionIds): Promise<CatalogEntry[]> {
      const result = await client
        .from("permissions")
        .select("id, code")
        .in("id", permissionIds);
      return rowsOrThrow(result);
    },
    async signInWithPassword(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return !error;
    },
    async signOutCurrentSession() {
      if (!await endCurrentSession(client.auth)) throw new Error("Unable to end the current session.");
    },
  };
}
