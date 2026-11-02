import "server-only";
import { inspectAuthOrigin } from "@/lib/auth/origin";
import { AuthorizationError } from "@/lib/auth/core";
import { assertLocalBusinessRuntime } from "../services/runtime";
import { BusinessConflictError } from "../services/server";
import { identifier,record } from "../services/validation";
import { readBoundedJson } from "../services/submission";
import { documentHeaders } from "../quotations/http";
import { getDeliveryRepository } from "./server";
export async function deliveryHttp(request:Request,factory=getDeliveryRepository) {
 try {
  assertLocalBusinessRuntime();
  if(request.method==="GET") {
   const q=new URL(request.url).searchParams,id=identifier(q.get("id")),repo=await factory();
   if(q.get("view")==="history")return Response.json(await repo.history(id),{headers:documentHeaders});
   if(q.get("view")==="preview")return Response.json(await repo.preview(id),{headers:documentHeaders});
   throw new Error();
  }
  if(request.method!=="POST"||!inspectAuthOrigin(request).allowed)return Response.json({message:"Request rejected."},{status:403,headers:documentHeaders});
  const v=record(await readBoundedJson(request));if(Object.keys(v).some(k=>!["operation","input"].includes(k)))throw new Error();
  const repo=await factory();
  if(v.operation==="prepare")return Response.json(await repo.prepare(v.input),{headers:documentHeaders});
  if(v.operation==="confirm")return Response.json(await repo.confirm(v.input),{headers:documentHeaders});
  if(v.operation==="attachment") {
   const i=record(v.input);if(Object.keys(i).some(k=>k!=="id"))throw new Error();const file=await repo.attachment(identifier(i.id));
   return new Response(new Uint8Array(file.bytes),{headers:{...documentHeaders,"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${file.filename}"`,"Content-Security-Policy":"sandbox; default-src 'none'"}});
  }
  throw new Error(); // No send/SMTP/provider/redirect command exists.
 }catch(e){return Response.json({message:e instanceof BusinessConflictError?"Dispatch changed. Reload history before continuing.":"Dispatch unavailable. Check permissions, recipient and document state; reload before retrying."},{status:e instanceof AuthorizationError?403:e instanceof BusinessConflictError?409:400,headers:documentHeaders});}
}
