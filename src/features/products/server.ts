import "server-only";
import {createClient as createAnonymousClient,type SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/server";
import {getSupabaseConfig} from "@/lib/supabase/env";
import {requireTeamMember,AuthorizationError} from "@/lib/auth/core";
import {createSupabaseAuthGateway} from "@/lib/auth/supabase-gateway";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {BusinessConflictError} from "../services/server";
import {record,identifier} from "../services/validation";
import {parseIdentity,parseCopy,parseTechnical,parsePublication,parseWaitlistSetting,text,slug,type Product,type StaffProduct,type Subscriber,type Asset} from "./model";
export function productsRepository(client:SupabaseClient){
 async function auth(codes:string[],any=false){const m=await requireTeamMember(createSupabaseAuthGateway(client));if(any?!codes.some(p=>m.permissionCodes.includes(p)):codes.some(p=>!m.permissionCodes.includes(p)))throw new AuthorizationError();}
 async function reader(){return auth(["content.read","products.technical.manage","waitlists.read"],true);}
 async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(12000));if(r.error?.code==="PT409")throw new BusinessConflictError();if(r.error)throw new Error("Product operation unavailable.");return r.data;}
 return {
  async catalog():Promise<Product[]>{return rpc("list_published_products");},
  async published(value:string):Promise<Product|null>{return rpc("get_published_product",{p_slug:slug(value)});},
  async list():Promise<StaffProduct[]>{await reader();return rpc("list_staff_products");},
  async detail(id:string):Promise<StaffProduct>{identifier(id);await reader();return rpc("get_staff_product",{p_id:id});},
  async assets():Promise<Asset[]>{await reader();return rpc("list_product_assets");},
  async identity(input:unknown){const v=parseIdentity(input);await auth(v.id?["products.manage"]:["products.manage","content.create"]);return rpc("save_product_identity",{p_id:v.id,p_version:v.version,p_name:v.name,p_slug:v.slug,p_category:v.category,p_external_url:v.externalUrl});},
  async copy(input:unknown){const v=parseCopy(input);await auth(["content.read","content.update"]);return rpc("save_product_copy",{p_id:v.id,p_version:v.version,p_short:v.shortDescription,p_description:v.description,p_features:v.features,p_cover:v.coverAssetId,p_media:v.mediaIds});},
  async technical(input:unknown){const v=parseTechnical(input);await auth(["products.technical.manage"]);return rpc("set_product_technical",{p_id:v.id,p_version:v.version,p_status:v.developmentStatus,p_summary:v.technicalSummary});},
  async publish(input:unknown){const v=parsePublication(input);await auth(["content.read","content.publish"]);return rpc("publish_product",{p_id:v.id,p_version:v.version,p_publication:v.publication,p_visibility:v.visibility});},
  async setting(input:unknown){const v=parseWaitlistSetting(input);await auth(["waitlists.read","waitlists.manage"]);return rpc("set_product_waitlist",{p_id:v.id,p_version:v.version,p_enabled:v.enabled});},
  async subscribers(id:string):Promise<Subscriber[]>{identifier(id);await auth(["waitlists.read"]);return rpc("list_product_waitlist",{p_id:id});},
  async withdraw(input:unknown){const v=record(input);if(Object.keys(v).length!==2||Object.keys(v).some(k=>!["id","evidence"].includes(k)))throw new Error();const id=identifier(v.id),evidence=text(v.evidence,240,true);await auth(["waitlists.read","waitlists.manage"]);return rpc("staff_withdraw_product_waitlist",{p_id:id,p_evidence:evidence});},
 };
}
export async function getProductsRepository(){assertLocalBusinessRuntime();return productsRepository(await createClient());}
export function getPublicProductsRepository(){assertLocalBusinessRuntime();const {url,publishableKey}=getSupabaseConfig();return productsRepository(createAnonymousClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));}
