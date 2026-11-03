import Link from'next/link';
import{createClient}from'@/lib/supabase/server';
import{requireTeamMember}from'@/lib/auth/core';
import{createSupabaseAuthGateway}from'@/lib/auth/supabase-gateway';
import{assertLocalBusinessRuntime}from'@/features/services/runtime';
import{EventsWorkspace}from'@/features/events/staff';
export const dynamic='force-dynamic';
export const metadata={title:'Events workspace | BE WISE',robots:{index:false,follow:false}};
export default async function Page(){let permissions:string[]|null=null;try{assertLocalBusinessRuntime();const m=await requireTeamMember(createSupabaseAuthGateway(await createClient()));if(!m.permissionCodes.some(p=>['content.read','events.operations.manage'].includes(p)))throw new Error();permissions=m.permissionCodes;}catch{}return permissions?<EventsWorkspace permissions={permissions}/>:<main><h1>Staff access required</h1><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;}
