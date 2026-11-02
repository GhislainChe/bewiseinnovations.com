export class BusinessValidationError extends Error {
  constructor() { super("Invalid service or request input."); }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BusinessValidationError();
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new BusinessValidationError();
}
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value)) throw new BusinessValidationError();
  return value.toLowerCase();
}
function text(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new BusinessValidationError();
  const result = value.trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new BusinessValidationError();
  return result;
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new BusinessValidationError();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new BusinessValidationError();
  return value;
}
export function parseService(value: unknown) {
  const v = record(value); exact(v, ["id", "version", "slug", "title", "description", "status", "acceptingRequests"]);
  const id = v.id == null ? null : identifier(v.id);
  const slug = text(v.slug, 1, 100), status = text(v.status, 1, 20);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !["draft", "published", "retired"].includes(status)) throw new BusinessValidationError();
  const acceptingRequests = boolean(v.acceptingRequests);
  if (acceptingRequests && status !== "published") throw new BusinessValidationError();
  return { id, version: id ? integer(v.version, 1) : null, slug, title: text(v.title, 1, 160), description: text(v.description, 1, 10000), status, acceptingRequests };
}
export function parseBudget(value: unknown) {
  const v = record(value); exact(v, ["id", "version", "serviceId", "label", "currency", "minMinor", "maxMinor", "unsure", "active", "sort"]);
  const id = v.id == null ? null : identifier(v.id), unsure = boolean(v.unsure);
  const currency = v.currency == null ? null : text(v.currency, 3, 3);
  const minMinor = v.minMinor == null ? null : integer(v.minMinor), maxMinor = v.maxMinor == null ? null : integer(v.maxMinor);
  if ((currency !== null && !/^[A-Z]{3}$/.test(currency)) || (unsure && (minMinor !== null || maxMinor !== null)) ||
    (!unsure && (!currency || (minMinor === null && maxMinor === null))) || (minMinor !== null && maxMinor !== null && maxMinor < minMinor)) throw new BusinessValidationError();
  return { id, version: id ? integer(v.version, 1) : null, serviceId: identifier(v.serviceId), label: text(v.label, 1, 160), currency, minMinor, maxMinor, unsure, active: boolean(v.active), sort: integer(v.sort, 0, 10000) };
}
export function parseProjectRequest(value: unknown, now = new Date()) {
  const v = record(value); exact(v, ["serviceId", "budgetOptionId", "fullName", "email", "whatsapp", "requirements", "preferredDeadline", "consentVersion", "website"]);
  if (v.website !== undefined && v.website !== "") throw new BusinessValidationError(); // Honeypot; not the primary limiter.
  const email = text(v.email, 3, 254).toLowerCase(), whatsapp = text(v.whatsapp, 8, 16);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email) || !/^\+[1-9][0-9]{6,14}$/.test(whatsapp)) throw new BusinessValidationError();
  let preferredDeadline: string | null = null;
  if (v.preferredDeadline != null) {
    preferredDeadline = text(v.preferredDeadline, 10, 10);
    const date = new Date(preferredDeadline + "T00:00:00Z"), today = now.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDeadline) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== preferredDeadline || preferredDeadline < today || date.getTime() > now.getTime() + 3650 * 86400000) throw new BusinessValidationError();
  }
  return { serviceId: identifier(v.serviceId), budgetOptionId: v.budgetOptionId == null ? null : identifier(v.budgetOptionId), fullName: text(v.fullName, 1, 160), email, whatsapp, requirements: text(v.requirements, 20, 10000), preferredDeadline, consentVersion: text(v.consentVersion, 1, 64) };
}
export const requestStatuses = ["received", "triaging", "discussing", "declined", "cancelled", "closed"] as const;
export function parseStatusChange(value: unknown) {
  const v = record(value); exact(v, ["id", "version", "status"]);
  if (!requestStatuses.includes(v.status as typeof requestStatuses[number])) throw new BusinessValidationError();
  return { id: identifier(v.id), version: integer(v.version, 1), status: v.status as typeof requestStatuses[number] };
}
