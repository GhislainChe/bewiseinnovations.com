import 'server-only';
import {createClient as anonymous,type SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {getSupabaseConfig} from '@/lib/supabase/env';
import {requireTeamMember,AuthorizationError} from '@/lib/auth/core';
import {createSupabaseAuthGateway} from '@/lib/auth/supabase-gateway';
import {assertLocalBusinessRuntime} from '../services/runtime';
import {identifier,record} from '../services/validation';
import {BusinessConflictError} from '../services/server';
import {articleSlug} from '../magazine/model';
import {parseCopy,parseConfiguration,parsePublication,parseReview,filters,type Opportunity,type StaffOpportunity,type Asset,type ApplicationRow,type Application} from './model';
export function opportunitiesRepository(client:SupabaseClient){
 async function auth(codes:string[],any=false){const m=await requireTeamMember(createSupabaseAuthGateway(client));if(any?!codes.some(c=>m.permissionCodes.includes(c)):codes.some(c=>!m.permissionCodes.includes(c)))throw new AuthorizationError();}
 const reader=()=>auth(['content.read','programs.operations.manage'],true);
 async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(12000));if(r.error?.code==='PT409')throw new BusinessConflictError();if(r.error)throw new Error('Program operation unavailable.');return r.data;}
 return{
  async catalog():Promise<Opportunity[]>{return rpc('list_published_opportunities');},
  async published(slug:string):Promise<Opportunity|null>{return rpc('get_published_opportunity',{p_slug:articleSlug(slug)});},
  async list():Promise<StaffOpportunity[]>{await reader();return rpc('list_staff_opportunities');},
  async assets():Promise<Asset[]>{await auth(['content.read']);return rpc('list_opportunity_assets');},
  async save(input:unknown):Promise<StaffOpportunity>{const v=parseCopy(input);await auth(['content.read',v.id?'content.update':'content.create']);return rpc('save_opportunity_copy',{p_id:v.id,p_version:v.version,p_slug:v.slug,p_copy:v.copy});},
  async configure(input:unknown):Promise<StaffOpportunity>{const v=parseConfiguration(input);await auth(['programs.operations.manage']);return rpc('configure_program',{p_id:v.id,p_version:v.version,p_operations:v.operations,p_questions:v.questions,p_open:v.open,p_attested:true});},
  async publish(input:unknown):Promise<StaffOpportunity>{const v=parsePublication(input);await auth(['content.read','content.publish']);return rpc('publish_opportunity',{p_id:v.id,p_version:v.version,p_published:v.published});},
  async applications(input:unknown):Promise<ApplicationRow[]>{const v=filters(input);await auth(['applications.read']);return rpc('list_program_applications',{p_opportunity:v.opportunityId,p_status:v.status,p_reference:v.reference});},
  async application(id:string):Promise<Application>{identifier(id);await auth(['applications.read']);return rpc('get_program_application',{p_id:id});},
  async review(input:unknown):Promise<Application>{const v=parseReview(input);await auth(['applications.read','applications.manage']);return rpc('review_program_application',{p_id:v.id,p_version:v.version,p_status:v.status,p_reason:v.reason});},
  async export(input:unknown){const v=filters(input);await auth(['applications.read','documents.export']);return rpc('export_program_application_summary',{p_opportunity:v.opportunityId,p_status:v.status,p_reference:v.reference});},
  async download(input:unknown){const v=record(input);if(Object.keys(v).length!==1)throw new Error();const id=identifier(v.id);await auth(['applications.read']);const d=await rpc('authorize_program_document',{p_id:id});if(d?.bucket!=='program-application-documents'||!(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/).test(d.key))throw new Error();const r=await client.storage.from(d.bucket).createSignedUrl(d.key,60,{download:true});if(r.error||!r.data)throw new Error();const u=new URL(r.data.signedUrl);if(u.origin!=='http://127.0.0.1:65421'||!u.pathname.startsWith('/storage/v1/object/sign/program-application-documents/'))throw new Error();return{url:u.href};},
 };
}
export async function getOpportunitiesRepository(){assertLocalBusinessRuntime();return opportunitiesRepository(await createClient());}
export function publicOpportunities(){assertLocalBusinessRuntime();const{url,publishableKey}=getSupabaseConfig();return opportunitiesRepository(anonymous(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));}
