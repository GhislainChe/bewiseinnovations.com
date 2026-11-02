import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createClient} from "@/lib/supabase/server";
import {createSupabaseAuthGateway} from "@/lib/auth/supabase-gateway";
import {requireTeamMember,AuthorizationError} from "@/lib/auth/core";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {BusinessConflictError} from "../services/server";
import {identifier} from "../services/validation";
import {parseProject,parseMilestone,parseOrder,parseNotification,parseRelease,type Project,type ProjectRow,type Intake} from "./model";
import {progressEmail} from "./email";
export function projectsRepository(client:SupabaseClient){
 async function auth(...codes:string[]){const m=await requireTeamMember(createSupabaseAuthGateway(client));if(codes.some(p=>!m.permissionCodes.includes(p)))throw new AuthorizationError();}
 async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(12000));if(r.error?.code==="PT409")throw new BusinessConflictError();if(r.error)throw new Error("Project operation unavailable.");return r.data;}
 return {
  async list():Promise<ProjectRow[]>{await auth("projects.read");return rpc("list_staff_projects");},
  async overview():Promise<ProjectRow[]>{await auth("company.overview.read");return rpc("company_project_overview");},
  async detail(id:string):Promise<Project>{identifier(id);await auth("projects.read");const p=await rpc("get_staff_project",{p_id:id}) as Project;return p;},
  async intakes():Promise<Intake[]>{await auth("projects.manage");return rpc("list_project_intakes");},
  async intake(id:string){identifier(id);await auth("inquiries.read","inquiries.manage");return rpc("get_project_intake",{p_request_id:id});},
  async release(input:unknown){const v=parseRelease(input);await auth("inquiries.read","inquiries.manage");return rpc("release_project_intake",{p_request_id:v.requestId,p_request_version:v.requestVersion,p_release_version:v.releaseVersion,p_scope:v.scope,p_evidence:v.evidence,p_agreement:v.agreement,p_attested:v.attested,p_active:v.active});},
  async save(input:unknown){const v=parseProject(input);await auth("projects.read","projects.manage");return rpc("save_staff_project",{p_id:v.id,p_version:v.version,p_kind:v.kind,p_request_id:v.requestId,p_name:v.name,p_description:v.description,p_status:v.status,p_starts_on:v.startsOn,p_ends_on:v.endsOn});},
  async milestone(input:unknown){const v=parseMilestone(input);await auth("projects.read","projects.manage");return rpc("save_project_milestone",{p_project_id:v.projectId,p_version:v.version,p_id:v.id,p_title:v.title,p_notes:v.internalNotes,p_client_summary:v.clientSummary,p_state:v.state,p_exclusion_reason:v.exclusionReason});},
  async reorder(input:unknown){const v=parseOrder(input);await auth("projects.read","projects.manage");return rpc("reorder_project_milestones",{p_project_id:v.projectId,p_version:v.version,p_ids:v.ids});},
  async notify(input:unknown){const v=parseNotification(input);await auth("projects.read","projects.manage","projects.notify");return rpc("prepare_project_progress",{p_project_id:v.projectId,p_version:v.version,p_milestone_id:v.milestoneId,p_attested:v.attested});},
  async preview(projectId:string,intentId:string){identifier(intentId);await auth("projects.read");const p=await this.detail(projectId),n=p.notifications.find(n=>n.id===intentId);if(!n)throw new Error();return progressEmail(n.summary,n.progress);},
 };
}
export async function getProjectsRepository(){assertLocalBusinessRuntime();return projectsRepository(await createClient());}
