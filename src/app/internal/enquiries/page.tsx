import Link from'next/link';
import{createClient}from'@/lib/supabase/server';
import{requireTeamMember}from'@/lib/auth/core';
import{createSupabaseAuthGateway}from'@/lib/auth/supabase-gateway';
import{assertLocalBusinessRuntime}from'@/features/services/runtime';
import{EnquiriesWorkspace}from'@/features/enquiries/staff';
export const dynamic='force-dynamic';
export const metadata={title:'Enquiries workspace | BE WISE',robots:{index:false,follow:false}};
export default async function Page(){let permissions:string[]|null=null;try{assertLocalBusinessRuntime();const m=await requireTeamMember(createSupabaseAuthGateway(await createClient()));if(!m.permissionCodes.some(p=>['enquiries.read','enquiries.assess'].includes(p)))throw new Error();permissions=m.permissionCodes;}catch{}return permissions?<EnquiriesWorkspace permissions={permissions}/>:<main><h1>Staff access required</h1><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;}
