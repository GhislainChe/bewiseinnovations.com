import'server-only';
import{randomBytes}from'node:crypto';
import{createClient}from'@supabase/supabase-js';
import{assertLocalBusinessRuntime}from'../services/runtime';
import{normalizeEmail}from'../delivery/model';
import{record}from'../services/validation';
import{exact}from'../products/model';
import{parseRegistration,secret,type EventView,type Receipt}from'./model';
import{eventHash,sha}from'./crypto';
import{renderEventTicket}from'./pdf';
export type Guest={id:string;token:string}|null;
export function eventIngress(){assertLocalBusinessRuntime();const key=process.env.SUPABASE_BUSINESS_INGRESS_SECRET_KEY;if(!key||key.length<32||key.startsWith('sb_publishable_'))throw new Error('Event service unavailable.');const allowed=['claim_private_event','read_private_event','submit_event_registration','read_event_receipt'];
 const client=createClient('http://127.0.0.1:65421',key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.origin!=='http://127.0.0.1:65421'||!allowed.some(n=>u.pathname==='/rest/v1/rpc/'+n)||u.search||(init?.method??'GET').toUpperCase()!=='POST')throw new Error();return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});}}});
 async function rpc(name:string,args:Record<string,unknown>){const r=await client.rpc(name,args);if(r.error)throw new Error('Event request unavailable.');return r.data;}
 return{
  async claim(input:unknown){const v=record(input);exact(v,['invite','code','email']);const invite=secret(v.invite,'ei1'),code=secret(v.code,'ec1'),email=normalizeEmail(v.email as string),token=randomBytes(32).toString('hex');const id=await rpc('claim_private_event',{p_token_hex:sha(invite),p_code_hex:sha(code),p_email:email,p_access_hex:sha(token),p_global_hex:eventHash('claim-global'),p_invite_budget_hex:eventHash('claim:'+invite)});if(!id)throw new Error('Eligibility unavailable.');return{id,token};},
  async privateView(g:Guest):Promise<EventView>{if(!g)throw new Error();return rpc('read_private_event',{p_invite:g.id,p_access_hex:sha(g.token)});},
  async register(input:unknown,key:string,g:Guest=null){const p=parseRegistration(input);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(key))throw new Error();const reference='BWE-'+eventHash('reference:'+key).slice(0,32),receipt='er1_'+eventHash('receipt:'+key+':'+JSON.stringify(p));await rpc('submit_event_registration',{p_payload:p,p_reference:reference,p_identity_hex:eventHash('identity:'+p.eventId+':'+p.email),p_idempotency_hex:eventHash('idempotency:'+key),p_payload_hex:eventHash('payload:'+JSON.stringify(p)),p_receipt_hex:sha(receipt),p_global_hex:eventHash('registration-global'),p_email_hex:eventHash('registration-email:'+p.email),p_event_hex:eventHash('registration-event:'+p.eventId),p_invite:g?.id??null,p_access_hex:g?sha(g.token):null});return{reference,receipt};},
  async receipt(token:string,code:string|null,g:Guest=null,pdf=false):Promise<Receipt|Uint8Array>{const data=await rpc('read_event_receipt',{p_receipt_hex:sha(secret(token,'er1')),p_code_hex:code?sha(secret(code,'pc1')):null,p_invite:g?.id??null,p_access_hex:g?sha(g.token):null,p_pdf:pdf});return pdf?renderEventTicket(data):data;},
 };
}
