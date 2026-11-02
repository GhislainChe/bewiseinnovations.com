import "server-only";
import { inspectAuthOrigin } from "@/lib/auth/origin";
import { AuthorizationError } from "@/lib/auth/core";
import { assertLocalBusinessRuntime } from "../services/runtime";
import { BusinessConflictError } from "../services/server";
import { identifier, record } from "../services/validation";
import { readBoundedJson } from "../services/submission";
import { getQuotationsRepository } from "./server";
export const documentHeaders = { "Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", "X-Robots-Tag":"noindex, nofollow", "X-Content-Type-Options":"nosniff" };
export async function quotationHttp(request: Request, repository=getQuotationsRepository) {
  try {
    assertLocalBusinessRuntime();
    if(request.method==="GET") {
      const q=new URL(request.url).searchParams,repo=await repository(),id=identifier(q.get("id"));
      if(q.get("view")==="history")return Response.json(await repo.history(id),{headers:documentHeaders});
      if(q.get("view")==="revision")return Response.json(await repo.get(id),{headers:documentHeaders});
      throw new Error();
    }
    if(request.method!=="POST" || !inspectAuthOrigin(request).allowed)return Response.json({message:"Request rejected."},{status:403,headers:documentHeaders});
    const v=record(await readBoundedJson(request));
    if(Object.keys(v).some(k=>!["operation","input"].includes(k)))throw new Error();
    const repo=await repository();
    switch(v.operation) {
      case "create": return Response.json(await repo.create(v.input),{headers:documentHeaders});
      case "save": return Response.json(await repo.save(v.input),{headers:documentHeaders});
      case "finalize": return Response.json(await repo.finalize(v.input),{headers:documentHeaders});
      case "request-pdf": case "quotation-pdf": {
        const input=record(v.input);if(Object.keys(input).some(k=>k!=="id"))throw new Error();
        const id=identifier(input.id),bytes=v.operation==="request-pdf"?await repo.requestPdf(id):await repo.quotationPdf(id);
        return new Response(new Uint8Array(bytes),{headers:{...documentHeaders,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="bewise-${v.operation==='request-pdf'?'internal-request':'quotation'}.pdf"`,"Content-Security-Policy":"sandbox; default-src 'none'"}});
      }
      default: throw new Error();
    }
  } catch(error) {
    return Response.json({message:error instanceof BusinessConflictError?"The quotation changed. Reload its history before editing or finalizing again.":"Document operation unavailable. Check your session, permissions and quotation fields. Reload to inspect the saved state before retrying."},{status:error instanceof AuthorizationError?403:error instanceof BusinessConflictError?409:400,headers:documentHeaders});
  }
}
