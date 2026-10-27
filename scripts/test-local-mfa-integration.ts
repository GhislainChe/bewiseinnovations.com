// Real LOCAL Auth + HTTP SSR + PostgreSQL. All secrets remain in RAM; no emails.
import { readFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { localSql, localScalar } from "./local-database.mjs";
import { createSupabaseAuthGateway } from "../src/lib/auth/supabase-gateway";
import { requirePermission } from "../src/lib/auth/core";

const env: Record<string,string> = {};
for (const line of readFileSync(".env.integration.local","utf8").split(/\r?\n/)) {
  const match=line.match(/^([A-Z_]+)=(.*)$/); if(match)env[match[1]]=match[2].trim().replace(/^(["'])(.*)\1$/,"$2");
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:65421","Local API required");
assert.ok(env.SUPABASE_AUTH_STORE_SECRET_KEY && env.AUTH_FLOW_SIGNING_SECRET);
const api=env.NEXT_PUBLIC_SUPABASE_URL, app="http://localhost:3000";
const admin=createClient(api,env.SUPABASE_AUTH_STORE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`mfa-local-${randomBytes(8).toString("hex")}@example.invalid`;
const password=`Local!${randomBytes(24).toString("base64url")}`;
const approval=`local-mfa-${randomBytes(8).toString("hex")}`;
let userId:string|undefined, next:ReturnType<typeof spawn>|undefined;
let phase="local prerequisites", assertions=0;
const jar=new Map<string,string>();
function ok(value:unknown){assert.ok(value);assertions++;}
function equal(a:unknown,b:unknown){assert.deepEqual(a,b);assertions++;}
function code(secret:string) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=0,value=0;const bytes=[];
  for(const char of secret.toUpperCase().replace(/=+$/,"")){const n=alphabet.indexOf(char);assert.ok(n>=0);value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;bytes.push((value>>>bits)&255);}value&=(1<<bits)-1;}
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest();const offset=digest[19]&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
async function request(path:string, fields?:Record<string,string>, cookies=jar) {
  const response=await fetch(app+path,{method:fields?"POST":"GET",redirect:"manual",signal:AbortSignal.timeout(20000),
    headers:{...(fields?{origin:app,"content-type":"application/x-www-form-urlencoded","x-auth-form":"1"}:{}),
      ...(cookies.size?{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")}:{})},body:fields?new URLSearchParams(fields):undefined});
  for(const header of response.headers.getSetCookie()){const pair=header.split(";",1)[0],i=pair.indexOf("=");if(i<0)continue;const name=pair.slice(0,i),value=pair.slice(i+1);if(!value||/max-age=0/i.test(header))cookies.delete(name);else cookies.set(name,value);}
  return response;
}
async function mfa(fields?:Record<string,string>){const response=await request("/auth/mfa/session",fields);return {response,data:await response.json()};}
function ssr(){return createServerClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:()=>{}}});}
async function main(){
  equal(await localScalar("select count(*) from public.team_profiles;"),"0");
  equal(await localScalar("select count(*) from public.audit_logs where action='platform_owner.bootstrap';"),"0");
  try{await fetch(app,{signal:AbortSignal.timeout(500)});throw new Error("Port already occupied");}catch(error){if(error instanceof Error&&error.message==="Port already occupied")throw error;}
  phase="start local Next.js";
  next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port","3000"],{env:{...process.env,...env,NODE_ENV:"development",AUTH_TRUSTED_ORIGIN:app,AUTH_RECOVERY_MODE:"disabled",AUTH_RECOVERY_TEST_ORIGIN:"",AUTH_LOCAL_PREFLIGHT:"0"},stdio:"ignore",windowsHide:true});
  let ready=false;
  for(let i=0;i<70;i++){try{if((await fetch(app+"/auth/mfa",{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  ok(ready);
  phase="create disposable local identity";
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});ok(!created.error);userId=created.data.user!.id;
  equal((await request("/auth/mfa/session")).status,401);
  phase="password-only SSR session";
  const login=await request("/auth/sign-in/complete",{email,password});equal(login.status,200);equal((await login.json()).destination,"/auth/mfa");ok(jar.size>0);
  let state=await mfa();equal(state.data.aal,"aal1");equal(state.data.factors,[]);equal(state.data.staffAccess,false);
  phase="unverified enrollment and invalid challenges";
  const enrollment=await mfa({operation:"enroll"});equal(enrollment.response.status,200);
  const factor=enrollment.data.enrollment;ok(factor.id&&factor.secret);
  state=await mfa();equal(state.data.factors[0].verified,false);equal(state.data.aal,"aal1");ok(!JSON.stringify(state.data).includes(factor.secret));
  const invalid=code(factor.secret)==="000000"?"111111":"000000";
  equal((await mfa({operation:"verify",factor_id:factor.id,code:invalid})).response.status,400);
  equal((await mfa({operation:"verify",factor_id:"00000000-0000-4000-8000-999999999999",code:"123456"})).response.status,400);
  phase="verified TOTP and unassigned denial";
  equal((await mfa({operation:"verify",factor_id:factor.id,code:code(factor.secret)})).response.status,200);
  state=await mfa();equal(state.data.aal,"aal2");equal(state.data.factors[0].verified,true);equal(state.data.staffAccess,false);
  await assert.rejects(requirePermission(createSupabaseAuthGateway(ssr()),"team.manage"));assertions++;
  phase="real verified-factor owner bootstrap";
  const bootstrap=readFileSync("supabase/admin/bootstrap-platform-owner.sql","utf8");
  await localSql(`select set_config('bewise.bootstrap_user_id','${userId}',false);select set_config('bewise.bootstrap_email','${email}',false);select set_config('bewise.bootstrap_approval','${approval}',false);${bootstrap}`);
  equal((await mfa()).data.staffAccess,true);
  equal((await requirePermission(createSupabaseAuthGateway(ssr()),"roles.assign")).id,userId);
  phase="AAL1 and forged assurance denial";
  const plain=createClient(api,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await plain.auth.signInWithPassword({email,password});ok(!signed.error);
  equal((await plain.from("team_profiles").select("id")).data,[]);
  await assert.rejects(requirePermission(createSupabaseAuthGateway(plain),"team.manage"));assertions++;
  equal((await plain.auth.mfa.enroll({factorType:"totp"})).error?.status,403);
  const token=signed.data.session!.access_token,parts=token.split(".");
  const payload=JSON.parse(Buffer.from(parts[1],"base64url").toString());payload.aal="aal2";
  const forged=parts[0]+"."+Buffer.from(JSON.stringify(payload)).toString("base64url")+"."+parts[2];
  ok((await plain.auth.getClaims(forged)).error);
  const forgedRest=await fetch(api+"/rest/v1/team_profiles?select=id",{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${forged}`},signal:AbortSignal.timeout(10000)});equal(forgedRest.status,401);
  phase="inactive account and expired session";
  await localSql(`update public.team_profiles set is_active=false where id='${userId}';`);equal((await mfa()).data.staffAccess,false);
  await localSql(`update public.team_profiles set is_active=true where id='${userId}';`);
  // Expire a separate, genuinely stepped-up device. Do not resurrect a session
  // that Auth may have invalidated while testing expiry.
  phase="second-device step-up before expiry";
  const previousCode=code(factor.secret);
  while(code(factor.secret)===previousCode) await new Promise(r=>setTimeout(r,500));
  const elevated=await plain.auth.mfa.challengeAndVerify({factorId:factor.id,code:code(factor.secret)});ok(!elevated.error);
  const current=await plain.auth.getClaims();const sessionId=current.data!.claims.session_id;
  await localSql(`update auth.sessions set not_after=now()-interval '1 second' where id='${sessionId}';`);
  await assert.rejects(requirePermission(createSupabaseAuthGateway(plain),"team.manage"));assertions++;
  phase="backup factor enrollment";
  const backup=await mfa({operation:"enroll"});equal(backup.response.status,200);
  phase="backup factor verification";
  equal((await mfa({operation:"verify",factor_id:backup.data.enrollment.id,code:code(backup.data.enrollment.secret)})).response.status,200);
  phase="backup factor status";
  equal((await mfa()).data.factors.filter((f:{verified:boolean})=>f.verified).length,2);
  const old=ssr();
  await old.auth.getClaims();
  const oldBearer=(await old.auth.getSession()).data.session!.access_token;
  const loggedOutSession=(await old.auth.getClaims()).data!.claims.session_id;
  phase="checked sign-out";
  const logout=await request("/auth/sign-out/complete",{});equal(logout.status,200);
  equal(new URL((await logout.json()).destination,app).searchParams.get("message"),"You have been signed out.");
  phase="signed-out cookies";
  equal((await request("/auth/mfa/session")).status,401);
  ok(![...jar.keys()].some(k=>k.includes("auth-token")));
  phase="revoked session and stale JWT denial";
  equal(await localScalar(`select count(*) from auth.sessions where id='${loggedOutSession}';`),"0");
  const replay=await fetch(api+"/rest/v1/team_profiles?select=id",{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${oldBearer}`},signal:AbortSignal.timeout(10000)});
  if(replay.ok) equal(await replay.json(),[]); else ok([401,403].includes(replay.status));
  phase="private trace and log privacy";
  for(const path of [".next/dev/trace",".next/dev/logs/next-development.log"]) {
    const retained=readFileSync(path,"utf8");
    ok(![factor.secret,backup.data.enrollment.secret,password,oldBearer,env.SUPABASE_AUTH_STORE_SECRET_KEY,env.AUTH_FLOW_SIGNING_SECRET].some(value=>retained.includes(value)));
  }
  console.log(`PASS: ${assertions} real local MFA/Auth/SSR/database assertions; enrollment/challenges, AAL1/forgery/expiry/inactive denial, exact bootstrap, backup factor and sign-out.`);
}
void main().catch(()=>{console.error(`Local MFA integration stopped at ${phase}; raw output, passwords, seeds, codes and tokens suppressed.`);process.exitCode=1;}).finally(async()=>{
  try {
    if(userId){
      await localSql(`delete from public.audit_logs where resource_id='${userId}' and metadata->>'approval_reference'='${approval}';`);
      const result=await admin.auth.admin.deleteUser(userId);if(result.error){console.error("Local test identity cleanup requires review.");process.exitCode=1;}
    }
    const quotaHash=createHmac("sha256",env.AUTH_FLOW_SIGNING_SECRET.trim()).update("recovery-email:").update(`sign-in:${email}`).digest("hex");
    await localSql(`delete from app_private.auth_recovery_buckets where scope='email' and key_hash=decode('${quotaHash}','hex');`);
  } catch { console.error("Local cleanup incomplete; inspect only this test's records before retrying.");process.exitCode=1; }
  finally {
    if(next?.pid){try{execFileSync("taskkill.exe",["/PID",String(next.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});}catch{}}
  }
});
