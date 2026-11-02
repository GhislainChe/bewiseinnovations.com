import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";
import { requirePermission, requireTeamMember, AuthorizationError } from "@/lib/auth/core";
import { assertLocalBusinessRuntime } from "./runtime";
import { identifier, parseBudget, parseService, parseStatusChange } from "./validation";
export class BusinessConflictError extends Error {}

export function servicesRepository(client: SupabaseClient) {
  const authorize = (code: string) => requirePermission(createSupabaseAuthGateway(client), code);
  async function rpc(name: string, params: Record<string, unknown>) {
    const result = await client.rpc(name, params).abortSignal(AbortSignal.timeout(10000));
    if (result.error?.code === "PT409" || result.error?.code === "40001") throw new BusinessConflictError("Record changed. Reload before editing.");
    if (result.error) throw new Error("Business operation unavailable.");
    return result.data;
  }
  return {
    async staffCatalog() {
      const member = await requireTeamMember(createSupabaseAuthGateway(client));
      if (!member.permissionCodes.some(code => code === "content.read" || code === "services.budgets.manage")) throw new AuthorizationError();
      const result = await client.from("services").select("*,service_budget_options(*)").order("title").limit(100).abortSignal(AbortSignal.timeout(10000));
      if (result.error) throw new Error("Catalog unavailable.");
      return result.data;
    },
    async publishedCatalog() {
      // Same explicit projection for all callers; staff credentials never leak drafts here.
      const result = await client.from("services").select("id,slug,title,description,accepting_requests,service_budget_options(id,label,currency,min_minor,max_minor,is_unsure,sort_order)")
        .eq("status", "published").eq("service_budget_options.is_active", true).order("title").limit(100).abortSignal(AbortSignal.timeout(10000));
      if (result.error) throw new Error("Catalog unavailable.");
      return result.data;
    },
    async saveService(input: unknown) {
      const v = parseService(input); await authorize(v.id ? "content.update" : "content.create");
      // DB additionally checks publication changes and editing a published record.
      return rpc("save_service", { p_id: v.id, p_version: v.version, p_slug: v.slug, p_title: v.title, p_description: v.description, p_status: v.status, p_accepting: v.acceptingRequests });
    },
    async saveBudget(input: unknown) {
      const v = parseBudget(input); await authorize("services.budgets.manage");
      return rpc("save_service_budget", { p_id: v.id, p_version: v.version, p_service_id: v.serviceId, p_label: v.label, p_currency: v.currency, p_min_minor: v.minMinor, p_max_minor: v.maxMinor, p_unsure: v.unsure, p_active: v.active, p_sort: v.sort });
    },
    async listRequests(limit = 25, reference = "") {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid limit.");
      await authorize("inquiries.read");
      if (reference) {
        if (!/^BWR-[a-f0-9]{32}$/.test(reference)) throw new Error("Invalid reference.");
        return rpc("find_project_request", { p_reference: reference });
      }
      return rpc("list_project_requests", { p_limit: limit });
    },
    async attachments(requestId: string) {
      identifier(requestId); await authorize("inquiries.read");
      return rpc("list_request_attachments", { p_request_id: requestId });
    },
    async getRequest(id: string) {
      identifier(id); await authorize("inquiries.read"); return rpc("get_project_request", { p_id: id });
    },
    async changeRequestStatus(input: unknown) {
      const v = parseStatusChange(input); await authorize("inquiries.manage");
      return rpc("set_project_request_status", { p_id: v.id, p_version: v.version, p_status: v.status });
    },
    async attachmentDownload(id: string) {
      identifier(id); await authorize("inquiries.read");
      const metadata = await rpc("authorize_request_attachment", { p_id: id });
      if (!metadata || metadata.bucket !== "project-request-documents" || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(metadata.key)) throw new Error("Document unavailable.");
      const result = await client.storage.from(metadata.bucket).createSignedUrl(metadata.key, 60, { download: true });
      if (result.error || !result.data) throw new Error("Document unavailable.");
      return result.data.signedUrl; // Bearer URL: return only in private no-store response; never log it.
    },
  };
}
export async function getServicesRepository() {
  assertLocalBusinessRuntime();
  return servicesRepository(await createClient());
}
