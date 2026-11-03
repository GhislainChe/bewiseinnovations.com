import "server-only";
import {createHash,createHmac} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {assertLocalBusinessRuntime} from "../services/runtime";
import {parseJoin,withdrawalToken} from "./model";
export function productWaitlistIngress(){
 assertLocalBusinessRuntime();const key=process.env.SUPABASE_BUSINESS_INGRESS_SECRET_KEY,secret=process.env.BUSINESS_SUBMISSION_SECRET;
 if(!key||key.length<32||key.startsWith('sb_publishable_')||!secret||secret.length<32)throw new Error("Waitlist unavailable.");
 const hash=(purpose:string)=>createHmac('sha256',secret).update('products-v1:'+purpose).digest('hex');
 const client=createClient('http://127.0.0.1:65421',key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(u.origin!=='http://127.0.0.1:65421'||!['/rest/v1/rpc/submit_product_waitlist','/rest/v1/rpc/withdraw_product_waitlist'].includes(u.pathname)||u.search||(init?.method??'GET').toUpperCase()!=='POST')throw new Error();
  return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(10000)});
 }}});
 return {
  async join(input:unknown,idempotencyKey:string){const p=parseJoin(input);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(idempotencyKey))throw new Error();
   const token='w1_'+hash('withdrawal:'+p.productId+':'+idempotencyKey);
   const r=await client.rpc('submit_product_waitlist',{p_payload:p,p_identity_hex:hash('identity:'+p.productId+':'+p.email),p_idempotency_hex:hash('idempotency:'+idempotencyKey),p_payload_hex:hash('payload:'+JSON.stringify(p)),p_withdrawal_hex:createHash('sha256').update(token).digest('hex'),p_global_hex:hash('join-global'),p_email_hex:hash('join-email:'+p.email),p_product_hex:hash('join-product:'+p.productId)});
   if(r.error)throw new Error('Waitlist unavailable.');return token; // Identical shape for new/duplicate/withdrawn addresses.
  },
  async withdraw(input:unknown){const token=withdrawalToken(input),r=await client.rpc('withdraw_product_waitlist',{p_token_hex:createHash('sha256').update(token).digest('hex'),p_global_hex:hash('withdraw-global'),p_token_budget_hex:hash('withdraw-token:'+token)});if(r.error)throw new Error('Withdrawal unavailable.');},
 };
}
