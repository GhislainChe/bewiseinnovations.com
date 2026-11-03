import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requireTeamMember} from "@/lib/auth/core";
import {createSupabaseAuthGateway} from "@/lib/auth/supabase-gateway";
import {assertLocalBusinessRuntime} from "@/features/services/runtime";
import {ProductsWorkspace} from "@/features/products/staff";
export const dynamic="force-dynamic";
export const metadata={title:"Product management | BE WISE",robots:{index:false,follow:false}};
export default async function Page(){let permissions:string[]|null=null;try{assertLocalBusinessRuntime();const m=await requireTeamMember(createSupabaseAuthGateway(await createClient()));if(!m.permissionCodes.some(p=>['content.read','products.technical.manage','waitlists.read'].includes(p)))throw new Error();permissions=m.permissionCodes;}catch{}
 return permissions?<ProductsWorkspace permissions={permissions}/>:<main><h1>Staff access required</h1><p>An active authorized account and verified MFA session are required.</p><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;}
