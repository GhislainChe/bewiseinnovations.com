import'server-only';
import{inspectAuthOrigin}from'@/lib/auth/origin';
import{AuthorizationError}from'@/lib/auth/core';
import{assertLocalBusinessRuntime}from'../services/runtime';
import{readBoundedJson}from'../services/submission';
import{BusinessConflictError}from'../services/server';
import{record}from'../services/validation';
import{exact}from'../products/model';
import{documentHeaders}from'../quotations/http';
import{enquiryIngress}from'./ingress';
import{getEnquiriesRepository}from'./server';
import{CONTACT_MESSAGE}from'./model';
export async function submitEnquiryHttp(request:Request,factory=enquiryIngress){try{assertLocalBusinessRuntime();if(request.method!=='POST'||!inspectAuthOrigin(request).allowed)return Response.json({message:'Request rejected.'},{status:403,headers:documentHeaders});const reference=await factory().submit(await readBoundedJson(request,16384),request.headers.get('idempotency-key')??'');return Response.json({reference,message:CONTACT_MESSAGE},{status:202,headers:documentHeaders});}catch{return Response.json({message:'Enquiry unavailable or uncertain. Review your details and retry unchanged information only if needed. No automatic retry occurred.'},{status:400,headers:documentHeaders});}}
export async function staffEnquiryHttp(request:Request,factory=getEnquiriesRepository){try{assertLocalBusinessRuntime();if(request.method==='GET'){const q=new URL(request.url).searchParams,r=await factory();let data;switch(q.get('view')){case'list':data=await r.list(q.get('status')||null,q.get('reference')||null);break;case'detail':data=await r.get(q.get('id')??'');break;case'assessments':data=await r.assessments();break;default:throw new Error();}return Response.json(data,{headers:documentHeaders});}if(request.method!=='POST'||!inspectAuthOrigin(request).allowed)return Response.json({message:'Request rejected.'},{status:403,headers:documentHeaders});const v=record(await readBoundedJson(request,16384));exact(v,['operation','input']);const r=await factory();if(v.operation==='act')await r.act(v.input);else if(v.operation==='assess')await r.assess(v.input);else throw new Error();return Response.json({recorded:true},{headers:documentHeaders});}catch(e){return Response.json({message:e instanceof BusinessConflictError?'Record changed. Reload before continuing.':'Enquiry operation unavailable. Check access, input and current state; reload before retrying.'},{status:e instanceof AuthorizationError?403:e instanceof BusinessConflictError?409:400,headers:documentHeaders});}}
