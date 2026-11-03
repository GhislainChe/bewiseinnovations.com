import'server-only';
import type{SupabaseClient}from'@supabase/supabase-js';
import{createClient}from'@/lib/supabase/server';
import{requirePermission}from'@/lib/auth/core';
import{createSupabaseAuthGateway}from'@/lib/auth/supabase-gateway';
import{assertLocalBusinessRuntime}from'../services/runtime';
import{BusinessConflictError}from'../services/server';
import{identifier}from'../services/validation';
import{parseAction,parseAssessment,states,type InboxRow,type Enquiry,type Assessment}from'./model';
export function enquiriesRepository(client:SupabaseClient){async function auth(p:string){await requirePermission(createSupabaseAuthGateway(client),p);}async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(r.error?.code==='PT409')throw new BusinessConflictError();if(r.error)throw new Error('Enquiry operation unavailable.');return r.data;}return{
 async list(status:string|null=null,reference:string|null=null):Promise<InboxRow[]>{if(status&&!Object.hasOwn(states,status)||reference&&!/^BWEQ-[a-f0-9]{32}$/.test(reference))throw new Error();await auth('enquiries.read');return rpc('list_contact_enquiries',{p_status:status,p_reference:reference});},
 async get(id:string):Promise<Enquiry>{identifier(id);await auth('enquiries.read');return rpc('get_contact_enquiry',{p_id:id});},
 async act(input:unknown){const v=parseAction(input);await auth('enquiries.manage');return rpc('manage_contact_enquiry',{p_id:v.id,p_version:v.version,p_operation:v.operation,p_action:v.action,p_value:v.value,p_body:v.body});},
 async assessments():Promise<Assessment[]>{await auth('enquiries.assess');return rpc('list_enquiry_assessments');},
 async assess(input:unknown){const v=parseAssessment(input);await auth('enquiries.assess');return rpc('respond_enquiry_assessment',{p_id:v.id,p_version:v.version,p_operation:v.operation,p_body:v.body});}
 };}
export async function getEnquiriesRepository(){assertLocalBusinessRuntime();return enquiriesRepository(await createClient());}
