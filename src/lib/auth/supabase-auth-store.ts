import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AuthFlowStore } from "./auth-store";
import { recoveryBudgetHashes, ticketRecord } from "./flow";
import { getSupabaseConfig } from "@/lib/supabase/env";

/** This secret key never enters a browser bundle, cookie, URL, or log. */
export function createAuthFlowStore(): AuthFlowStore {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_AUTH_STORE_SECRET_KEY?.trim();
  if (!key || key.length < 32 || key.includes("REPLACE_WITH") || key.startsWith("sb_publishable_")) {
    throw new Error("Server-side Auth flow store is not configured.");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async ready() {
      const { data, error } = await client.rpc("auth_flow_store_ready");
      return !error && data === true;
    },
    async register(ticket, userId, type) {
      const record = ticketRecord(ticket, type, userId);
      if (!record) throw new Error("Invalid Auth flow ticket.");
      const { error } = await client.rpc("register_auth_flow_ticket", {
        p_hash_hex: record.hashHex, p_user_id: userId,
        p_flow_type: type, p_expires_at: record.expiresAt,
      });
      if (error) throw new Error("Auth flow store unavailable.");
    },
    async redeem(ticket, userId, type) {
      const record = ticketRecord(ticket, type, userId);
      if (!record) return false;
      const { data, error } = await client.rpc("redeem_auth_flow_ticket", {
        p_hash_hex: record.hashHex, p_user_id: userId, p_flow_type: type,
      });
      if (error) throw new Error("Auth flow store unavailable.");
      return data === true;
    },
    async consumeRecoveryBudget(email) {
      const { emailHashHex, globalHashHex } = recoveryBudgetHashes(email);
      const { data, error } = await client.rpc("consume_recovery_budget", {
        p_email_hash_hex: emailHashHex, p_global_hash_hex: globalHashHex,
      });
      if (error) throw new Error("Auth flow store unavailable.");
      return data === true;
    },
  };
}
