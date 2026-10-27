import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mfaOperation, mfaStatus } from "./mfa";

function fixture(verified=false, level="aal1", invalidIdentity=false) {
  let aal=level,enrollments=0,verifications=0;
  const factors=verified?[{id:"own-factor",factor_type:"totp",status:"verified",secret:"never-return-in-status"}]:[];
  const client={auth:{
    getUser:async()=>({data:{user:invalidIdentity?null:{id:"user"}},error:null}),
    getClaims:async()=>({data:{claims:{sub:"user",role:"authenticated",session_id:"session",exp:Date.now()/1000+60,aal}},error:null}),
    mfa:{listFactors:async()=>({data:{all:factors},error:null}),
      enroll:async()=>{enrollments++;return {data:{type:"totp",id:"new-factor",totp:{secret:"synthetic-setup-key"}},error:null};},
      challengeAndVerify:async({code}:{code:string})=>{verifications++;if(code==="123456"){aal="aal2";return {error:null};}return {error:{code:"invalid"}};}}}} as unknown as SupabaseClient;
  return {client,counts:()=>({enrollments,verifications})};
}
function form(values:Record<string,string>){const result=new FormData();for(const[k,v]of Object.entries(values))result.set(k,v);return result;}
test("MFA requires a verified session; status never returns enrollment secrets",async()=>{
  const missing=fixture(false,"aal1",true);
  assert.equal(await mfaOperation(missing.client,form({operation:"enroll"})),null);
  assert.equal(missing.counts().enrollments,0);
  assert.doesNotMatch(JSON.stringify(await mfaStatus(fixture(true).client)),/never-return|secret/);
});
test("initial own-factor enrollment is allowed before a team role; backup enrollment requires AAL2",async()=>{
  const first=fixture();assert.equal((await mfaOperation(first.client,form({operation:"enroll"})))?.enrollment?.id,"new-factor");
  const locked=fixture(true);assert.equal(await mfaOperation(locked.client,form({operation:"enroll"})),null);assert.equal(locked.counts().enrollments,0);
  const elevated=fixture(true,"aal2");assert.ok((await mfaOperation(elevated.client,form({operation:"enroll"})))?.enrollment);
});
test("verification accepts only the caller's factor, valid input and an actual upgraded session",async()=>{
  const own=fixture(true);
  for(const values of [{factor_id:"someone-else",code:"123456"},{factor_id:"own-factor",code:"short"}]) assert.equal(await mfaOperation(own.client,form({operation:"verify",...values})),null);
  assert.equal(own.counts().verifications,0);
  assert.equal(await mfaOperation(own.client,form({operation:"verify",factor_id:"own-factor",code:"000000"})),null);
  assert.equal((await mfaStatus(own.client))?.aal,"aal1");
  assert.deepEqual(await mfaOperation(own.client,form({operation:"verify",factor_id:"own-factor",code:"123456"})),{verified:true});
});
