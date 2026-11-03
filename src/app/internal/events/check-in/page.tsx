import Link from'next/link';
import{createClient}from'@/lib/supabase/server';
import{requireTeamMember}from'@/lib/auth/core';
import{createSupabaseAuthGateway}from'@/lib/auth/supabase-gateway';
import{assertLocalBusinessRuntime}from'@/features/services/runtime';
import{EventScanner}from'@/features/events/scanner';
export const dynamic='force-dynamic';
export const metadata={title:'Event check-in | BE WISE',robots:{index:false,follow:false}};
export default async function Page(){let permissions:string[]|null=null;try{assertLocalBusinessRuntime();const m=await requireTeamMember(createSupabaseAuthGateway(await createClient()));if(!m.permissionCodes.includes('events.checkin'))throw new Error();permissions=m.permissionCodes;}catch{}return permissions?<EventScanner permissions={permissions}/>:<main><h1>Staff access required</h1><p>Event check-in requires verified AAL2 and explicit event check-in authorization.</p><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;}
