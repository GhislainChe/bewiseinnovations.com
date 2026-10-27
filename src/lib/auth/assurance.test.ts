import assert from "node:assert/strict";
import { test } from "node:test";
import { verifiedIdentity, type AssuranceGateway } from "./assurance";
import { getCurrentTeamMember, hasPermission, MfaRequiredError, signInTeamMember, type AuthGateway } from "./core";

function auth(claims: Record<string, unknown> = {}, error: unknown = null): AssuranceGateway {
  return { getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    getClaims: async () => ({ data: { claims: { sub:"user",role:"authenticated",session_id:"session",exp:Date.now()/1000+300,aal:"aal2",...claims } },error }) };
}
test("assurance comes from verified claims with matching live identity, expiry and known AAL", async () => {
  assert.equal((await verifiedIdentity(auth()))?.aal,"aal2");
  assert.equal((await verifiedIdentity(auth({aal:"aal1"})))?.aal,"aal1");
  for(const claims of [{aal:"forged"},{sub:"another"},{role:"service_role"},{exp:0},{exp:Infinity},{exp:NaN},{session_id:null}]) assert.equal(await verifiedIdentity(auth(claims)),null);
  assert.equal(await verifiedIdentity(auth({},new Error("signature rejected"))),null);
  assert.equal(await verifiedIdentity({...auth(),getUser:async()=>({data:{user:null},error:null})}),null);
});
test("AAL1 cannot read staff authorization; sign-in retains only the session needed for MFA", async () => {
  let queries=0,logout=0;
  const client: AuthGateway={getVerifiedUserId:async()=>"user",hasVerifiedAal2:async()=>false,
    getProfile:async()=>{queries++;return null;},getRoleIds:async()=>[],getRoles:async()=>[],getPermissionIds:async()=>[],getPermissions:async()=>[],
    signInWithPassword:async()=>true,signOutCurrentSession:async()=>{logout++;}};
  assert.equal(await getCurrentTeamMember(client),null);
  assert.equal(await hasPermission(client,"roles.assign"),false);
  await assert.rejects(signInTeamMember(client,"local@example.invalid","synthetic"),MfaRequiredError);
  assert.equal(queries,0);assert.equal(logout,0);
});
