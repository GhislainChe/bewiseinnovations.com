import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requireTeamMember} from "@/lib/auth/core";
import {createSupabaseAuthGateway} from "@/lib/auth/supabase-gateway";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {ProjectsWorkspace} from "./workspace";
export async function ProjectsPage({overview=false}:{overview?:boolean}){let permissions:string[]|null=null;try{assertLocalBusinessRuntime();const m=await requireTeamMember(createSupabaseAuthGateway(await createClient()));if(!m.permissionCodes.includes(overview?"company.overview.read":"projects.read"))throw new Error();permissions=m.permissionCodes;}catch{}
 if(!permissions)return <main><h1>Staff access required</h1><p>An active authorized staff identity and verified MFA session are required. No project records have been loaded.</p><Link href="/auth/mfa">Sign in or complete MFA</Link></main>;
 return <ProjectsWorkspace permissions={permissions} overview={overview}/>;}
