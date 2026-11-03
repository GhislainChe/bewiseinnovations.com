import 'server-only';
import {createClient as anonymous,type SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {getSupabaseConfig} from '@/lib/supabase/env';
import {requireTeamMember,AuthorizationError} from '@/lib/auth/core';
import {createSupabaseAuthGateway} from '@/lib/auth/supabase-gateway';
import {authOriginEnvironment,trustedAuthOrigin} from '@/lib/auth/origin';
import {assertLocalBusinessRuntime} from '../services/runtime';
import {BusinessConflictError} from '../services/server';
import {identifier} from '../services/validation';
import {parseDraft,parseCategory,parseSwitch,articleSlug,type Article,type StaffArticle,type Category,type Asset} from './model';
export function magazineRepository(client:SupabaseClient){
 async function auth(code='content.read'){const m=await requireTeamMember(createSupabaseAuthGateway(client));if(!m.permissionCodes.includes('content.read')||!m.permissionCodes.includes(code))throw new AuthorizationError();}
 async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(12000));if(r.error?.code==='PT409')throw new BusinessConflictError();if(r.error)throw new Error('Editorial operation unavailable.');return r.data;}
 return{
  async catalog(category?:string):Promise<Article[]>{return rpc('list_published_magazine',{p_category:category?articleSlug(category):null});},
  async published(slug:string):Promise<Article|null>{return rpc('get_published_magazine',{p_slug:articleSlug(slug)});},
  async categories(staff=false):Promise<Category[]>{if(staff)await auth();return rpc('list_magazine_categories',{p_staff:staff});},
  async list():Promise<StaffArticle[]>{await auth();return rpc('list_staff_magazine');},
  async detail(id:string):Promise<StaffArticle>{identifier(id);await auth();return rpc('get_staff_magazine',{p_id:id});},
  async assets():Promise<Asset[]>{await auth();return rpc('list_magazine_assets');},
  async save(input:unknown):Promise<StaffArticle>{const v=parseDraft(input);await auth(v.id?'content.update':'content.create');return rpc('save_magazine_draft',{p_id:v.id,p_version:v.version,p_slug:v.slug,p_document:v.document});},
  async category(input:unknown):Promise<Category[]>{const v=parseCategory(input);for(const code of['content.update','content.publish',...(v.id?[]:['content.create'])])await auth(code);return rpc('save_magazine_category',{p_id:v.id,p_version:v.version,p_name:v.name,p_slug:v.slug,p_active:v.active,p_sort:v.sortOrder});},
  async publish(input:unknown):Promise<StaffArticle>{const v=parseSwitch(input,'published');await auth('content.publish');return rpc('publish_magazine',{p_id:v.id,p_version:v.version,p_publish:v.value});},
  async feature(input:unknown):Promise<StaffArticle>{const v=parseSwitch(input,'featured');await auth('content.publish');return rpc('feature_magazine',{p_id:v.id,p_version:v.version,p_featured:v.value});},
 };
}
export async function getMagazineRepository(){assertLocalBusinessRuntime();return magazineRepository(await createClient());}
export function publicMagazine(){assertLocalBusinessRuntime();const{url,publishableKey}=getSupabaseConfig();return magazineRepository(anonymous(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));}
export function magazineOrigin(){const origin=trustedAuthOrigin(authOriginEnvironment());if(!origin)throw new Error('Sharing configuration unavailable');return origin.origin;}
