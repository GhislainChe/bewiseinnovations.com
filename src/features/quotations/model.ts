import { identifier, record } from "../services/validation";
export type QuoteItem = { description: string; quantity: number; unitAmount: number | null };
export type QuoteContent = { projectDescription: string; scope: string; deliverables: string; timeline: string; paymentTerms: string; validUntil: string | null; notes: string; exclusions: string; teamAgreement: boolean; currency: "XAF"; items: QuoteItem[] };
export type QuoteDocument = { company: { name: string; email: string; website: string }; number: string; revision: number; date: string; client: { name: string; email: string; whatsapp: string }; request: { reference: string; service: string }; content: QuoteContent; total: number; templateVersion: number };
export type QuoteRevision = { id: string; quotation_id: string; revision: number; version: number; state: "draft" | "finalized"; document: QuoteDocument; digest: string; pdf_sha256: string | null; finalized_at: string | null };
export type QuoteHistory = { id: string; number: string; revision: number; state: "draft" | "finalized"; version: number; finalized_at: string | null };
const textKeys = ["projectDescription", "scope", "deliverables", "timeline", "paymentTerms", "notes", "exclusions"] as const;
export function quoteTotal(items: QuoteItem[]): number {
  if (!Array.isArray(items) || items.length > 25) throw new Error("Use at most 25 line items.");
  let total = BigInt(0);
  for (const item of items) {
    if (typeof item.description !== "string" || !item.description.trim() || item.description.length > 300 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.description) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000 || item.unitAmount === null || !Number.isSafeInteger(item.unitAmount) || item.unitAmount < 0 || item.unitAmount > 1000000000000) throw new Error("Enter each item description, whole quantity and explicit whole-FCFA unit amount.");
    total += BigInt(item.quantity) * BigInt(item.unitAmount);
    if (total > BigInt(9000000000000)) throw new Error("Quotation total exceeds the supported limit.");
  }
  return Number(total);
}
export function parseQuotation(input: unknown, complete = false, now = new Date()): QuoteContent {
  const v = record(input), allowed = [...textKeys, "validUntil", "teamAgreement", "currency", "items"];
  if (Object.keys(v).length !== allowed.length || Object.keys(v).some(k => !allowed.includes(k as typeof allowed[number])) || v.currency !== "XAF" || typeof v.teamAgreement !== "boolean" || !Array.isArray(v.items)) throw new Error("Invalid quotation fields.");
  for (const k of textKeys) if (typeof v[k] !== "string" || v[k].length > (k === "projectDescription" ? 10000 : 3000) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v[k])) throw new Error("Check quotation text lengths and characters.");
  for (const item of v.items) if (Object.keys(record(item)).length !== 3 || Object.keys(item).some(k => !["description", "quantity", "unitAmount"].includes(k))) throw new Error("Invalid item fields.");
  quoteTotal(v.items as QuoteItem[]);
  if (v.validUntil !== null && (typeof v.validUntil !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.validUntil) || !Number.isFinite(new Date(v.validUntil+"T00:00:00Z").getTime()) || new Date(v.validUntil+"T00:00:00Z").toISOString().slice(0,10) !== v.validUntil)) throw new Error("Enter a valid calendar date.");
  if (complete && (textKeys.slice(0,5).some(k => !(v[k] as string).trim()) || !v.items.length || !v.teamAgreement || !v.validUntil || v.validUntil < now.toISOString().slice(0,10) || new Date(v.validUntil as string).getTime() > now.getTime()+730*86400000)) throw new Error("Complete scope, deliverables, timeline, payment terms, a current validity date, line items and team-agreement confirmation.");
  if (new TextEncoder().encode(JSON.stringify(v)).length > 15000) throw new Error("Shorten the quotation to fit the supported document size.");
  return v as QuoteContent;
}
export function versionInput(input: unknown) {
  const v = record(input);
  if (!Number.isSafeInteger(v.version) || (v.version as number) < 1) throw new Error("Invalid version.");
  return { id: identifier(v.id), version: v.version as number };
}
