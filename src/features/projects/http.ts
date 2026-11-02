import "server-only";
import {AuthorizationError} from "@/lib/auth/core";
import {inspectAuthOrigin} from "@/lib/auth/origin";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {BusinessConflictError} from "../services/server";
import {readBoundedJson} from "../services/submission";
import {record,identifier} from "../services/validation";
import {documentHeaders} from "../quotations/http";
import {getProjectsRepository} from "./server";
export async function projectsHttp(request:Request,factory=getProjectsRepository){try{
 assertLocalBusinessRuntime();
 if(request.method==="GET") {const q=new URL(request.url).searchParams,r=await factory();let data;
  switch(q.get("view")){case "list":data=await r.list();break;case "overview":data=await r.overview();break;case "intakes":data=await r.intakes();break;case "intake":data=await r.intake(identifier(q.get("id")));break;case "detail":data=await r.detail(identifier(q.get("id")));break;case "preview":data=await r.preview(identifier(q.get("id")),identifier(q.get("intentId")));break;default:throw new Error();}
  return Response.json(data,{headers:documentHeaders});
 }
 if(request.method!=="POST"||!inspectAuthOrigin(request).allowed)return Response.json({message:"Request rejected."},{status:403,headers:documentHeaders});
 const v=record(await readBoundedJson(request));if(Object.keys(v).length!==2||Object.keys(v).some(k=>!["operation","input"].includes(k)))throw new Error();
 const r=await factory();let data;
 switch(v.operation){case "save":data=await r.save(v.input);break;case "milestone":data=await r.milestone(v.input);break;case "reorder":data=await r.reorder(v.input);break;case "notify":data=await r.notify(v.input);break;case "release":data=await r.release(v.input);break;default:throw new Error();}
 return Response.json(data,{headers:documentHeaders});
 }catch(e){return Response.json({message:e instanceof BusinessConflictError?"Record changed. Reload before continuing.":"Project operation unavailable. Check access, fields and approved contact state; reload to inspect the result."},{status:e instanceof AuthorizationError?403:e instanceof BusinessConflictError?409:400,headers:documentHeaders});}}
