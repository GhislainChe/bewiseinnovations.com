import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";
import { AuthorizationError,requireTeamMember } from "@/lib/auth/core";
import { identifier, record } from "../services/validation";
import { BusinessConflictError } from "../services/server";
import { assertLocalBusinessRuntime } from "../services/runtime";
import { parseQuotation, versionInput, type QuoteRevision } from "./model";
import { renderQuotationPdf, renderRequestPdf } from "./pdf";
import { preserveQuotationPdf, readQuotationPdf } from "./artifacts";
export function quotationsRepository(client: SupabaseClient) {
  const authorize=async(...codes: string[])=>{const member=await requireTeamMember(createSupabaseAuthGateway(client));if(["inquiries.read",...codes].some(code=>!member.permissionCodes.includes(code)))throw new AuthorizationError();};
  async function rpc(name: string,params: Record<string,unknown>) {
    const r=await client.rpc(name,params).abortSignal(AbortSignal.timeout(10000));
    if(r.error?.code==="PT409")throw new BusinessConflictError();
    if(r.error)throw new Error("Quotation operation unavailable.");
    return r.data;
  }
  return {
    async history(id: string) {identifier(id);await authorize("quotations.read");return rpc("list_request_quotations",{p_request_id:id});},
    async get(id: string): Promise<QuoteRevision> {identifier(id);await authorize("quotations.read");const v=await rpc("get_quotation_revision",{p_id:id});if(!v)throw new Error();return v;},
    async create(input: unknown) {
      const v=record(input);if(Object.keys(v).some(k=>!["requestId","baseId"].includes(k)))throw new Error();
      const requestId=identifier(v.requestId),baseId=v.baseId==null?null:identifier(v.baseId);
      await authorize("quotations.read","quotations.manage");return rpc("create_quotation_draft",{p_request_id:requestId,p_base_id:baseId});
    },
    async save(input: unknown) {
      const v=record(input);if(Object.keys(v).some(k=>!["id","version","content"].includes(k)))throw new Error();
      const key=versionInput(v),content=parseQuotation(v.content);
      await authorize("quotations.read","quotations.manage");return rpc("save_quotation_draft",{p_id:key.id,p_version:key.version,p_content:content});
    },
    async finalize(input: unknown) {
      const v=record(input);if(Object.keys(v).some(k=>!["id","version"].includes(k)))throw new Error();
      const key=versionInput(v);await authorize("quotations.read","quotations.manage","documents.export");
      const current=await rpc("get_quotation_revision",{p_id:key.id}) as QuoteRevision;
      if(!current || current.state!=="draft" || current.version!==key.version)throw new BusinessConflictError();
      parseQuotation(current.document.content,true);
      // Persist the trusted renderer's bytes BEFORE atomic finalization. An uncertain
      // RPC outcome retains the file for reconciliation, never overwrites/deletes it.
      const bytes=await renderQuotationPdf(current.document),hash=await preserveQuotationPdf(key.id,bytes);
      return rpc("finalize_quotation",{p_id:key.id,p_version:key.version,p_digest:current.digest,p_pdf_sha256:hash});
    },
    async requestPdf(id: string) {
      identifier(id);await authorize("documents.export");
      return renderRequestPdf(await rpc("export_project_request",{p_id:id}));
    },
    async quotationPdf(id: string) {
      identifier(id);await authorize("quotations.read","documents.export");
      const revision=await rpc("export_quotation",{p_id:id}) as QuoteRevision;
      if(!revision?.pdf_sha256 || revision.state!=="finalized")throw new Error();
      return readQuotationPdf(id,revision.pdf_sha256);
    },
  };
}
export async function getQuotationsRepository() { assertLocalBusinessRuntime();return quotationsRepository(await createClient()); }
