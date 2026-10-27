// Real LOCAL Auth, caller-JWT Data API/RLS, application gateway and canonical SQL.
// No hosted target, emails, browser persistent storage or public probe endpoint.
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { localSql, localScalar } from "./local-database.mjs";
import { probeContentTestPermissions } from "./permission-test-harness";

const env: Record<string,string> = {};
for(const line of readFileSync(".env.integration.local","utf8").split(/\r?\n/)) {
  const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(["'])(.*)\1$/,"$2");
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:65421");
assert.ok(env.SUPABASE_AUTH_STORE_SECRET_KEY);
const api=env.NEXT_PUBLIC_SUPABASE_URL;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(api,env.SUPABASE_AUTH_STORE_SECRET_KEY,options);
const caller=createClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
const email=`content-local-${randomBytes(8).toString("hex")}@example.invalid`;
const password=`Local!${randomBytes(24).toString("base64url")}`;
const run=`permission-test-${randomUUID()}`,retired=randomUUID();
let userId:string|undefined,phase="local prerequisites",checks=0;
const eq=(a:unknown,b:unknown)=>{assert.deepEqual(a,b);checks++;};
const ok=(a:unknown)=>{assert.ok(a);checks++;};
function code(secret:string) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,value=0;const bytes=[];
  for(const char of secret.toUpperCase().replace(/=+$/,"")){const n=alphabet.indexOf(char);assert.ok(n>=0);value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}value&=(1<<bits)-1;}
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest();const offset=digest[19]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
function params(values:Record<string,string>) {
  // Values here are generated local UUIDs/labels, not user-controlled SQL.
  assert.ok(Object.values(values).every(v=>/^[a-zA-Z0-9@._-]+$/.test(v)));
  return Object.entries(values).map(([k,v])=>`select set_config('bewise.permission_test_${k}','${v}',false);`).join("");
}
async function main() {
  eq(await localScalar("select count(*) from public.team_profiles;"),"0");
  phase="local Auth identity";
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});ok(!created.error);userId=created.data.user!.id;
  ok(!(await caller.auth.signInWithPassword({email,password})).error);
  let result=await probeContentTestPermissions(caller,userId);eq(result.aal,"aal1");eq(result.decisions["content.read"],false);
  phase="real local TOTP verification";
  const enrollment=await caller.auth.mfa.enroll({factorType:"totp"});ok(!enrollment.error);const factor=enrollment.data!;
  ok(!(await caller.auth.mfa.challengeAndVerify({factorId:factor.id,code:code(factor.totp.secret)})).error);
  result=await probeContentTestPermissions(caller,userId);eq(result.aal,"aal2");eq(result.decisions["content.read"],false);eq(result.ownProfileCount,0);
  await assert.rejects(probeContentTestPermissions(caller,randomUUID()));checks++;
  phase="canonical content-only binding";
  const inputs={user_id:userId,email,run,approval:"local-content-permission-approval",factor_id:factor.id,retired_factor_id:retired,mitigation:"local-generated-private-factor"};
  await localSql(params(inputs)+readFileSync("supabase/admin/bind-disposable-content-test.sql","utf8"));
  result=await probeContentTestPermissions(caller,userId);
  for(const permission of ["content.read","content.create","content.update","content.publish"])eq(result.decisions[permission],true);
  for(const permission of ["team.manage","roles.assign","settings.manage","audit.read","inquiries.read","registrations.read","waitlists.read"])eq(result.decisions[permission],false);
  eq(result.ownProfileCount,1);eq(result.ownAssignmentCount,1);eq(result.visibleAuditCount,0);
  phase="direct caller RLS and mutation denial";
  const selfAssignment=await caller.from("team_role_assignments").insert({user_id:userId,role_id:(await admin.from("roles").select("id").eq("code","platform_owner").single()).data!.id});ok(selfAssignment.error);
  ok((await caller.from("team_profiles").update({is_active:true}).eq("id",userId)).error);
  ok((await caller.rpc("auth_flow_store_ready")).error);
  const hidden=await fetch(api+"/rest/v1/auth_flow_tickets?select=user_id",{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,"accept-profile":"app_private"},signal:AbortSignal.timeout(10000)});eq(hidden.status,406);
  phase="assigned AAL1 boundary";
  const plain=createClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
  ok(!(await plain.auth.signInWithPassword({email,password})).error);
  const low=await probeContentTestPermissions(plain,userId);eq(low.aal,"aal1");eq(low.decisions["content.read"],false);eq(low.ownProfileCount,0);eq(low.ownAssignmentCount,0);
  phase="inactive staff denial";
  await localSql(`update public.team_profiles set is_active=false where id='${userId}';`);
  const inactive=await probeContentTestPermissions(caller,userId);eq(inactive.decisions["content.read"],false);eq(inactive.ownProfileCount,0);
  await localSql(`update public.team_profiles set is_active=true where id='${userId}';`);
  phase="canonical unbinding and retained audit";
  const binding=await localScalar(`select id from public.audit_logs where metadata->>'test_run'='${run}' and action='test.staff_binding';`);
  await localSql(params({...inputs,binding_audit_id:binding,cleanup_approval:"local-cleanup-approval"})+readFileSync("supabase/admin/unbind-disposable-content-test.sql","utf8"));
  eq((await probeContentTestPermissions(caller,userId)).decisions["content.read"],false);
  eq(await localScalar(`select count(*) from public.audit_logs where metadata->>'test_run'='${run}';`),"2");
  phase="exact local Auth cleanup and ticket cascade";
  const hash=randomBytes(32).toString("hex");
  ok(!(await admin.rpc("register_auth_flow_ticket",{p_hash_hex:hash,p_user_id:userId,p_flow_type:"invite",p_expires_at:new Date(Date.now()+300000).toISOString()})).error);
  ok(!(await admin.auth.admin.deleteUser(userId)).error);
  eq(await localScalar(`select count(*) from auth.sessions where user_id='${userId}';`),"0");
  eq(await localScalar(`select count(*) from auth.mfa_factors where user_id='${userId}';`),"0");
  eq(await localScalar(`select count(*) from app_private.auth_flow_tickets where user_id='${userId}';`),"0");
  eq(await localScalar(`select count(*) from public.team_role_assignments where user_id='${userId}';`),"0");
  eq(await localScalar(`select count(*) from public.audit_logs where metadata->>'test_run'='${run}';`),"2");
  console.log(`PASS: ${checks} real LOCAL Auth/Data API/RLS/application permission and staged-cleanup checks. No hosted requests.`);
}
void main().catch(()=>{console.error(`Local content permission test failed at ${phase}; raw errors and credentials suppressed.`);process.exitCode=1;}).finally(async()=>{
  if(userId) {
    // Local fixture cleanup only. Retained-audit behavior above was asserted before
    // removing this runner's own records; hosted audit retention remains mandatory.
    await localSql(`delete from public.audit_logs where metadata->>'test_run'='${run}' and resource_id='${userId}';`);
    const existing=await admin.auth.admin.getUserById(userId);
    if(!existing.error){const removed=await admin.auth.admin.deleteUser(userId);if(removed.error)process.exitCode=1;}
  }
});
