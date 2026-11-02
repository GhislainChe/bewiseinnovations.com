export type StaffBudget = { id: string; service_id: string; version: number; label: string; currency: string | null; min_minor: number | null; max_minor: number | null; is_unsure: boolean; is_active: boolean; sort_order: number };
export type StaffService = { id: string; version: number; slug: string; title: string; description: string; status: string; accepting_requests: boolean; service_budget_options: StaffBudget[] };
export type RequestRow = { id: string; reference: string; full_name: string; status: string; version: number; created_at: string };
export type RequestDetail = RequestRow & { email: string; whatsapp: string; requirements: string; preferred_deadline: string | null; service_snapshot: { title: string }; budget_snapshot: { label: string; currency: string | null; minMinor?: number | null; maxMinor?: number | null; unsure?: boolean } | null };
export function requestBudgetLabel(budget: RequestDetail["budget_snapshot"]) {
  return budget ? budgetLabel({ id: "", label: budget.label, currency: budget.currency, min_minor: budget.minMinor ?? null, max_minor: budget.maxMinor ?? null, is_unsure: budget.unsure ?? false, sort_order: 0 }) : "Not supplied";
}
export type Attachment = { id: string; display_name: string; mime_type: string; byte_size: number; scan_status: string };
export function nextStatuses(status: string): string[] {
  return status === "received" ? ["triaging", "declined", "cancelled"] : status === "triaging" ? ["discussing", "declined", "cancelled"] : (status === "discussing" || status === "approved") ? ["declined", "cancelled", "closed"] : [];
}
export function serviceUpdate(service: StaffService, form: FormData) {
  return { id: service.id, version: service.version, slug: service.slug, title: String(form.get("title") ?? ""), description: String(form.get("description") ?? ""), status: String(form.get("status")), acceptingRequests: form.get("accepting") === "on" };
}
export function budgetUpdate(serviceId: string, budget: StaffBudget | null, form: FormData) {
  const unsure = form.get("unsure") === "on";
  const amount = (key: string) => form.get(key) === "" ? null : Number(form.get(key));
  return { id: budget?.id ?? null, version: budget?.version ?? null, serviceId, label: String(form.get("label") ?? ""), currency: "XAF", minMinor: unsure ? null : amount("min"), maxMinor: unsure ? null : amount("max"), unsure, active: form.get("active") === "on", sort: Number(form.get("sort")) };
}
import { budgetLabel } from "./public-model";
