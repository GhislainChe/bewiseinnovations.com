import { identifier, parseProjectRequest } from "./validation";
export type PublicBudget = { id: string; label: string; sort_order: number; currency: string | null; min_minor: number | null; max_minor: number | null; is_unsure: boolean };
export type PublicService = { id: string; title: string; slug: string; description: string; accepting_requests: boolean; service_budget_options: PublicBudget[] };
export type RequestFields = { fullName: string; email: string; whatsapp: string; serviceId: string; budgetOptionId: string; requirements: string; deadlineKnown: boolean; preferredDeadline: string; consent: boolean; website: string };
export const blankRequest: RequestFields = { fullName: "", email: "", whatsapp: "", serviceId: "", budgetOptionId: "", requirements: "", deadlineKnown: false, preferredDeadline: "", consent: false, website: "" };
export function decodeCatalog(value: unknown): PublicService[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Catalog unavailable.");
  return value.map(v => {
    if (!v || typeof v !== "object" || typeof v.title !== "string" || typeof v.slug !== "string" || typeof v.description !== "string" || typeof v.accepting_requests !== "boolean" || !Array.isArray(v.service_budget_options)) throw new Error("Catalog unavailable.");
    const budgets = v.service_budget_options.map((b: unknown) => {
      if (!b || typeof b !== "object" || !("id" in b) || !("label" in b) || typeof b.label !== "string" || !("sort_order" in b) || !Number.isInteger(b.sort_order)) throw new Error("Catalog unavailable.");
      const raw = b as Record<string, unknown>;
      const amount = (v: unknown) => v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);
      if (!(raw.currency === null || (typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency))) || !amount(raw.min_minor) || !amount(raw.max_minor) || typeof raw.is_unsure !== "boolean") throw new Error("Catalog unavailable.");
      return { id: identifier(b.id), label: b.label, sort_order: b.sort_order as number, currency: raw.currency as string | null, min_minor: raw.min_minor as number | null, max_minor: raw.max_minor as number | null, is_unsure: raw.is_unsure };
    }).sort((a: PublicBudget, b: PublicBudget) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    return { id: identifier(v.id), title: v.title, slug: v.slug, description: v.description, accepting_requests: v.accepting_requests, service_budget_options: budgets };
  });
}
export function budgetLabel(b: PublicBudget): string {
  if (b.is_unsure || !b.currency) return b.label;
  const formatter = new Intl.NumberFormat("en", { style: "currency", currency: b.currency, currencyDisplay: "code" });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const format = (n: number) => formatter.format(n / 10 ** digits);
  const range = b.min_minor !== null && b.max_minor !== null ? `${format(b.min_minor)} – ${format(b.max_minor)}` : b.min_minor !== null ? `${format(b.min_minor)} or more` : b.max_minor !== null ? `Up to ${format(b.max_minor)}` : "";
  return range ? `${b.label} · ${range}` : b.label;
}
export function requestErrors(f: RequestFields, services: PublicService[], now = new Date()) {
  const errors: Partial<Record<keyof RequestFields, string>> = {};
  if (!f.fullName.trim() || f.fullName.trim().length > 160) errors.fullName = "Enter your full name (up to 160 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) || f.email.trim().length > 254) errors.email = "Enter a valid email address.";
  if (!/^\+[1-9][0-9]{6,14}$/.test(f.whatsapp.trim())) errors.whatsapp = "Use your international number, starting with + and country code.";
  const service = services.find(s => s.id === f.serviceId && s.accepting_requests);
  if (!service) errors.serviceId = "Choose an available service.";
  if (service && service.service_budget_options.length && !service.service_budget_options.some(b => b.id === f.budgetOptionId)) errors.budgetOptionId = "Choose a budget option for this service.";
  if (f.requirements.trim().length < 20 || f.requirements.trim().length > 10000) errors.requirements = "Describe your project in 20–10,000 characters.";
  if (f.deadlineKnown) {
    try { parseProjectRequest({ ...requestPayload(f), preferredDeadline: f.preferredDeadline }, now); }
    catch {
      const date = new Date(f.preferredDeadline + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.preferredDeadline) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== f.preferredDeadline || f.preferredDeadline < now.toISOString().slice(0, 10) || date.getTime() > now.getTime() + 3650 * 86400000) errors.preferredDeadline = "Choose a valid date from today to ten years ahead, or select Not sure yet.";
    }
  }
  if (!f.consent) errors.consent = "Please agree to the use of your details for this request.";
  if (f.website) errors.website = "Unable to submit this request.";
  if (new TextEncoder().encode(JSON.stringify(requestPayload(f))).byteLength > 16384) errors.requirements = "Your request is too large. Please shorten the description before sending.";
  if (!Object.keys(errors).length) {
    try { parseProjectRequest(requestPayload(f), now); } catch { errors.requirements = "Check your details and remove unsupported control characters."; }
  }
  return errors;
}
export function requestPayload(f: RequestFields) {
  return { serviceId: f.serviceId, budgetOptionId: f.budgetOptionId || null, fullName: f.fullName, email: f.email, whatsapp: f.whatsapp, requirements: f.requirements, preferredDeadline: f.deadlineKnown ? f.preferredDeadline : null, consentVersion: "services-request-local-v1", website: f.website };
}

/** In-memory only. An uncertain attempt can retry only its exact payload and key. */
export function createRequestSender(fetcher: typeof fetch = fetch, newKey: () => string = () => crypto.randomUUID()) {
  let pending = false, completed = false, payload: string | null = null, key: string | null = null;
  return async (input: ReturnType<typeof requestPayload>): Promise<{ kind: "success"; reference: string } | { kind: "busy" | "uncertain" | "changed" }> => {
    if (pending || completed) return { kind: "busy" };
    const body = JSON.stringify(input);
    if (payload !== null && body !== payload) return { kind: "changed" };
    pending = true;
    try {
      key ??= newKey(); payload ??= body;
      const response = await fetcher("/api/project-requests", { method: "POST", mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", headers: { "content-type": "application/json", "idempotency-key": key }, body: payload, signal: AbortSignal.timeout(20000) });
      if (!response.ok) return { kind: "uncertain" };
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("reference" in result) || typeof result.reference !== "string" || !/^BWR-[a-f0-9]{32}$/.test(result.reference)) return { kind: "uncertain" };
      completed = true; payload = null; key = null;
      return { kind: "success", reference: result.reference };
    } catch { return { kind: "uncertain" }; }
    finally { pending = false; }
  };
}
