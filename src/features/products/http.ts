import "server-only";
import {inspectAuthOrigin} from "@/lib/auth/origin";
import {AuthorizationError} from "@/lib/auth/core";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {BusinessConflictError} from "../services/server";
import {readBoundedJson} from "../services/submission";
import {record,identifier} from "../services/validation";
import {documentHeaders} from "../quotations/http";
import {getProductsRepository,getPublicProductsRepository} from "./server";
import {productWaitlistIngress} from "./ingress";
import {JOIN_MESSAGE,WITHDRAW_MESSAGE,withdrawalToken} from "./model";
export async function publicProductsHttp(request:Request){try{assertLocalBusinessRuntime();const q=new URL(request.url).searchParams,r=getPublicProductsRepository();const data=q.has('slug')?await r.published(q.get('slug')!):await r.catalog();return Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},status:data===null?404:200});}catch{return Response.json({message:'Product catalog unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export async function waitlistHttp(request:Request,withdraw=false,factory=productWaitlistIngress){try{
 assertLocalBusinessRuntime();if(request.method!=='POST'||!inspectAuthOrigin(request).allowed)return Response.json({message:'Request rejected.'},{status:403,headers:documentHeaders});
 const input=await readBoundedJson(request),r=factory();
 if(withdraw){const v=record(input);if(Object.keys(v).length!==1||!Object.hasOwn(v,'token'))throw new Error();await r.withdraw(withdrawalToken(v.token));return Response.json({message:WITHDRAW_MESSAGE},{status:202,headers:documentHeaders});}
 const token=await r.join(input,request.headers.get('idempotency-key')??'');return Response.json({message:JOIN_MESSAGE,withdrawalToken:token},{status:202,headers:documentHeaders});
 }catch{return Response.json({message:withdraw?'Unable to process withdrawal. Use your original private link or contact Operations.':'Unable to process this request. Check consent and your details, or try again later.'},{status:400,headers:documentHeaders});}}
export async function staffProductsHttp(request:Request,factory=getProductsRepository){try{
 assertLocalBusinessRuntime();if(request.method==='GET'){const q=new URL(request.url).searchParams,r=await factory();let data;switch(q.get('view')){case'list':data=await r.list();break;case'detail':data=await r.detail(identifier(q.get('id')));break;case'assets':data=await r.assets();break;case'subscribers':data=await r.subscribers(identifier(q.get('id')));break;default:throw new Error();}return Response.json(data,{headers:documentHeaders});}
 if(request.method!=='POST'||!inspectAuthOrigin(request).allowed)return Response.json({message:'Request rejected.'},{status:403,headers:documentHeaders});
 const v=record(await readBoundedJson(request));if(Object.keys(v).length!==2||Object.keys(v).some(k=>!['operation','input'].includes(k)))throw new Error();const r=await factory();let data;
 switch(v.operation){case'identity':data=await r.identity(v.input);break;case'copy':data=await r.copy(v.input);break;case'technical':data=await r.technical(v.input);break;case'publish':data=await r.publish(v.input);break;case'setting':data=await r.setting(v.input);break;case'withdraw':await r.withdraw(v.input);data={recorded:true};break;default:throw new Error();}return Response.json(data,{headers:documentHeaders});
 }catch(e){return Response.json({message:e instanceof BusinessConflictError?'Product changed. Reload before continuing.':'Operation unavailable. Check your access and input; reload before retrying.'},{status:e instanceof AuthorizationError?403:e instanceof BusinessConflictError?409:400,headers:documentHeaders});}}
