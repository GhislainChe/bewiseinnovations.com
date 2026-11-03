import'server-only';
import{randomUUID}from'node:crypto';
import{createClient as anonymous,type SupabaseClient}from'@supabase/supabase-js';
import{createClient}from'@/lib/supabase/server';
import{getSupabaseConfig}from'@/lib/supabase/env';
import{requireTeamMember,AuthorizationError}from'@/lib/auth/core';
import{createSupabaseAuthGateway}from'@/lib/auth/supabase-gateway';
import{assertLocalBusinessRuntime}from'../services/runtime';
import{BusinessConflictError}from'../services/server';
import{identifier,record}from'../services/validation';
import{normalizeEmail}from'../delivery/model';
import{articleSlug}from'../magazine/model';
import{parseCopy,parseConfiguration,parsePublish,parseScan,version,instant,type EventView,type StaffEvent,type Registration,type Invite,type Asset,type ScanEvent,type Verification,type Attendance}from'./model';
import{text,exact}from'../products/model';
import{sha,newSecret,qrPayload}from'./crypto';
import{renderEventTicket,type TicketDocument}from'./pdf';
export function eventsRepository(client:SupabaseClient){
 async function auth(codes:string[],any=false){const m=await requireTeamMember(createSupabaseAuthGateway(client));if(any?!codes.some(c=>m.permissionCodes.includes(c)):codes.some(c=>!m.permissionCodes.includes(c)))throw new AuthorizationError();}
 async function rpc(name:string,args:Record<string,unknown>={}){const r=await client.rpc(name,args).abortSignal(AbortSignal.timeout(15000));if(r.error?.code==='PT409')throw new BusinessConflictError();if(r.error)throw new Error('Event operation unavailable.');return r.data;}
 const reader=()=>auth(['content.read','events.operations.manage'],true);
 return{
  async catalog():Promise<EventView[]>{return rpc('list_public_events');},async published(slug:string):Promise<EventView|null>{return rpc('get_public_event',{p_slug:articleSlug(slug)});},
  async list():Promise<StaffEvent[]>{await reader();return rpc('list_staff_events',{p_scanner:false});},async scannerEvents():Promise<ScanEvent[]>{await auth(['events.checkin']);return rpc('list_staff_events',{p_scanner:true});},
  async assets():Promise<Asset[]>{await auth(['content.read']);return rpc('list_event_assets');},
  async save(input:unknown){const v=parseCopy(input);await auth(['content.read',v.id?'content.update':'content.create']);return rpc('save_event_copy',{p_id:v.id,p_version:v.version,p_slug:v.slug,p_copy:v.copy});},
  async configure(input:unknown){const v=parseConfiguration(input);await auth(['events.operations.manage']);return rpc('configure_event',{p_id:v.id,p_version:v.version,p_ops:v.operations,p_visibility:v.visibility,p_open:v.open,p_lifecycle:v.lifecycle,p_attested:true});},
  async publish(input:unknown){const v=parsePublish(input);await auth(['content.read','content.publish']);return rpc('publish_event',{p_id:v.id,p_version:v.version,p_published:v.published});},
  async registrations(id:string):Promise<Registration[]>{identifier(id);await auth(['registrations.read']);return rpc('list_event_registrations',{p_event:id});},
  async invites(id:string):Promise<Invite[]>{identifier(id);await auth(['events.operations.manage','registrations.read']);return rpc('list_event_invites',{p_event:id});},
  async invite(input:unknown){const v=record(input);exact(v,['eventId','version','email','expiresAt','evidence','verified']);if(v.verified!==true)throw new Error('Independent recipient verification required.');const id=randomUUID(),token=newSecret('ei1'),code=newSecret('ec1');await auth(['events.operations.manage','registrations.read','registrations.manage']);await rpc('create_event_invite',{p_id:id,p_event:identifier(v.eventId),p_version:version(v.version),p_email:normalizeEmail(v.email as string),p_token_hex:sha(token),p_code_hex:sha(code),p_expires:instant(v.expiresAt),p_evidence:text(v.evidence,240,true)});return{id,token,code};},
  async revoke(input:unknown){const v=record(input);exact(v,['id','version']);await auth(['events.operations.manage','registrations.manage']);await rpc('revoke_event_invite',{p_id:identifier(v.id),p_version:version(v.version)});},
  async change(input:unknown){const v=record(input);exact(v,['id','version','action','reason']);if(!['promote','cancel'].includes(v.action as string))throw new Error();await auth(['registrations.read','registrations.manage','events.operations.manage']);await rpc('change_event_registration',{p_id:identifier(v.id),p_version:version(v.version),p_action:v.action,p_reason:text(v.reason,240,true)});},
  async payment(input:unknown){const v=record(input);exact(v,['id','version','confirmed','amount','evidence']);if(typeof v.confirmed!=='boolean'||!Number.isSafeInteger(v.amount)||(v.amount as number)<0)throw new Error();await auth(['registrations.read','registrations.manage','events.operations.manage']);await rpc('record_event_payment',{p_id:identifier(v.id),p_version:version(v.version),p_confirmed:v.confirmed,p_amount:v.amount,p_evidence:text(v.evidence,240,true)});},
  async portal(input:unknown){const v=record(input);exact(v,['id','version','evidence','verified']);if(v.verified!==true)throw new Error();await auth(['registrations.read','registrations.manage','events.operations.manage']);const code=newSecret('pc1');await rpc('authorize_event_portal',{p_id:identifier(v.id),p_version:version(v.version),p_code_hex:sha(code),p_evidence:text(v.evidence,240,true)});return{code};},
  async issue(input:unknown){const v=record(input);exact(v,['eventId','registrationId','version','reissue','reason']);if(typeof v.reissue!=='boolean')throw new Error();await auth(['registrations.read','registrations.manage','events.operations.manage']);const rows:Registration[]=await rpc('list_event_registrations',{p_event:identifier(v.eventId)}),r=rows.find(r=>r.id===identifier(v.registrationId));if(!r)throw new Error();const id=randomUUID(),n=Math.max(0,...r.ticketHistory.map(t=>t.version))+1;return rpc('issue_event_ticket',{p_registration:r.id,p_version:version(v.version),p_ticket:id,p_reference:'BWT-'+randomUUID().replaceAll('-',''),p_token_hex:sha(qrPayload(id,n)),p_reissue:v.reissue,p_reason:text(v.reason,240)});},
  async pdf(input:unknown){const v=record(input);exact(v,['id']);await auth(['registrations.read','documents.export']);const d:TicketDocument=await rpc('get_staff_event_ticket',{p_id:identifier(v.id)});return renderEventTicket(d);},
  async verify(input:unknown):Promise<Verification>{const v=parseScan(input);await auth(['events.checkin']);return rpc('verify_event_ticket',{p_event:v.eventId,p_token_hex:v.qr?sha(v.qr):null,p_reference:v.reference});},
  async checkin(input:unknown):Promise<Verification>{const v=parseScan(input);await auth(['events.checkin']);return rpc('check_in_event_ticket',{p_event:v.eventId,p_token_hex:v.qr?sha(v.qr):null,p_reference:v.reference});},
  async attendance(id:string):Promise<Attendance[]>{identifier(id);await auth(['events.checkin']);return rpc('list_event_attendance',{p_event:id});}
 };
}
export async function getEventsRepository(){assertLocalBusinessRuntime();return eventsRepository(await createClient());}
export function publicEvents(){assertLocalBusinessRuntime();const{url,publishableKey}=getSupabaseConfig();return eventsRepository(anonymous(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));}
