import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareRestoredSecurity,comparePolicyEvidence,policyEquivalenceSql} from './restore-security-snapshot.mjs';
const baseline={project:'onfxxtvfprjnqsxdmhkp',read_only:'on',
  tables:[{name:'team_profiles',owner:'postgres',rls:true,anon_select:false}],
  policies:[{name:'team_profiles_staff_select',mode:'PERMISSIVE',using:'active'}],
  functions:[{name:'has_permission',owner:'postgres',definer:true,public_execute:false,definition:'select\r\ntrue;'}],
  role_permissions:{platform_owner:['team.read','team.manage']},private_schema_grants:[{role:'authenticated',usage:true,create:false}]};
test('restore comparison allows isolated ownership/line-ending differences, preserving authorization semantics',()=>{
  const restored=structuredClone(baseline);restored.tables[0].owner='supabase_admin';restored.functions[0].owner='supabase_admin';restored.functions[0].definition='select\ntrue;';
  compareRestoredSecurity(restored,baseline);
});

const policy={schema:'public',table:'team_profiles',name:'own_profile',mode:'PERMISSIVE',roles:['authenticated'],command:'SELECT',using:'(id = auth.uid())',check:null};
function evidence() {
  const row={index:0,schema:policy.schema,table:policy.table,name:policy.name,command:'r',permissive:true,roles:['authenticated'],using:policy.using,check:null,
    functions:[{oid:1234,schema:'auth',name:'uid',arguments:''}]};
  return {search_path:'pg_catalog',policies:[{...structuredClone(row),side:'actual'},{...structuredClone(row),side:'expected'}]};
}
test('policy display qualification may differ only with matching resolved evidence',()=>{
  comparePolicyEvidence([{...policy,using:'(id = uid())'}],[policy],evidence());
});
test('different function OID or namespace fails even with identical displayed expressions',()=>{
  for(const mutate of [r=>r.functions[0].oid=4321,r=>r.functions[0].schema='public']) {
    const e=evidence();mutate(e.policies[0]);assert.throws(()=>comparePolicyEvidence([policy],[policy],e),/Resolved policy differs/);
  }
});
test('missing policies, weakened USING/WITH CHECK and changed characteristics fail',()=>{
  for(const mutate of [e=>e.policies.pop(),e=>e.policies[0].using='true',e=>e.policies[0].check='true',e=>e.policies[0].permissive=false,e=>e.policies[0].command='*',e=>e.policies[0].roles=['anon'],e=>e.search_path='public,auth']) {
    const e=evidence();mutate(e);assert.throws(()=>comparePolicyEvidence([policy],[policy],e));
  }
  assert.throws(()=>comparePolicyEvidence([],[policy],evidence()));
});
test('semantic policy comparison cannot bypass table or function grant checks',()=>{
  const source={...structuredClone(baseline),policies:[policy]};
  for(const mutate of [r=>r.tables[0].anon_select=true,r=>r.functions[0].public_execute=true,r=>r.private_schema_grants[0].create=true]) {
    const restored=structuredClone(source);mutate(restored);
    assert.throws(()=>compareRestoredSecurity(restored,source,evidence()));
  }
});
test('reference policy SQL uses a restricted path and disposable transaction',()=>{
  const sql=policyEquivalenceSql([policy]);
  assert.match(sql,/set local search_path=pg_catalog/);assert.match(sql,/create temporary table/);
  assert.match(sql,/pg_depend/);assert.match(sql,/rollback;$/);
  assert.throws(()=>policyEquivalenceSql([{...policy,schema:'auth'}]));
  assert.throws(()=>policyEquivalenceSql([{...policy,command:'invalid'}]));
});
test('restore comparison fails closed on RLS, policy, function, grant, mapping or target drift',()=>{
  for(const change of [r=>r.tables[0].rls=false,r=>r.tables[0].anon_select=true,r=>r.policies[0].using='true',r=>r.functions[0].public_execute=true,r=>r.functions[0].definition='select false;',r=>r.role_permissions.platform_owner.push('roles.assign'),r=>r.private_schema_grants[0].create=true]) {
    const restored=structuredClone(baseline);change(restored);assert.throws(()=>compareRestoredSecurity(restored,baseline));
  }
  assert.throws(()=>compareRestoredSecurity(baseline,{...baseline,project:'wrong-project'}));
});
