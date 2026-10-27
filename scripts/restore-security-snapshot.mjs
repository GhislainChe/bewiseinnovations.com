import assert from 'node:assert/strict';

// Catalog/authorization metadata only; no identities, passwords or record data.
export const restoreSecuritySql = `select json_build_object(
 'search_path',current_setting('search_path'),
 'tables',(select json_agg(json_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,
   'anon_select',has_table_privilege('anon',c.oid,'SELECT'),'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
   'authenticated_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
   'service_direct',has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) order by n.nspname,c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','app_private')),
 'policies',(select json_agg(json_build_object('schema',schemaname,'table',tablename,'name',policyname,'mode',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) order by schemaname,tablename,policyname)
   from pg_policies where schemaname in ('public','app_private')),
 'functions',(select json_agg(json_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
   'definer',p.prosecdef,'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
   'public_execute',exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'),
   'definition',pg_get_functiondef(p.oid)) order by n.nspname,p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private')),
 'role_permissions',(select json_object_agg(code,permissions) from (select r.code,array_agg(p.code order by p.code) as permissions from public.roles r
   join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id group by r.code) x),
 'private_schema_grants',(select json_agg(json_build_object('role',r.name,'usage',has_schema_privilege(r.name,'app_private','USAGE'),'create',has_schema_privilege(r.name,'app_private','CREATE'))) from (values('anon'),('authenticated'),('service_role')) r(name)));`;

function comparableRows(rows) {
  assert.ok(Array.isArray(rows));
  return rows.map(row=>{
    const copy={...row};delete copy.owner; // Isolated import runs as supabase_admin.
    if(typeof copy.definition==='string')copy.definition=copy.definition.replaceAll('\r\n','\n');
    return copy;
  });
}
const identifier = value => '"'+String(value).replaceAll('"','""')+'"';
const literal = value => "'"+String(value).replaceAll("'","''")+"'";
const policyHeader = ({schema,table,name,mode,roles,command}) => ({schema,table,name,mode,roles,command});

// LOCAL disposable database only. Parse the historical, qualified expressions on
// empty LIKE tables. No restored application policy is changed; ROLLBACK removes
// the reference tables. Both expressions are deparsed in exactly the same context.
export function policyEquivalenceSql(policies) {
  assert.ok(Array.isArray(policies) && policies.length>0);
  const statements=['begin; set local search_path=pg_catalog;'];
  const pairs=[];
  for(const [index,p] of policies.entries()) {
    assert.ok(['public','app_private'].includes(p.schema));
    assert.ok(['SELECT','INSERT','UPDATE','DELETE','ALL'].includes(p.command));
    assert.ok(['PERMISSIVE','RESTRICTIVE'].includes(p.mode));
    assert.ok(Array.isArray(p.roles) && p.roles.length>0);
    const reference=`policy_reference_${index}`;
    statements.push(`create temporary table ${identifier(reference)} (like ${identifier(p.schema)}.${identifier(p.table)});`);
    statements.push(`create policy ${identifier(p.name)} on pg_temp.${identifier(reference)} as ${p.mode} for ${p.command} to ${p.roles.map(identifier).join(',')}${p.using===null?'':` using (${p.using})`}${p.check===null?'':` with check (${p.check})`};`);
    pairs.push(`(${index},${literal(p.schema)},${literal(p.table)},${literal(p.name)},${literal(reference)})`);
  }
  statements.push(`with pairs(i,s,t,n,r) as (values ${pairs.join(',')}),
    resolved as (
      select pairs.*,p.oid policy_oid,'actual' side from pairs join pg_namespace ns on ns.nspname=pairs.s
      join pg_class c on c.relnamespace=ns.oid and c.relname=pairs.t
      join pg_policy p on p.polrelid=c.oid and p.polname=pairs.n
      union all select pairs.*,p.oid,'expected' from pairs
      join pg_class c on c.relnamespace=pg_my_temp_schema() and c.relname=pairs.r
      join pg_policy p on p.polrelid=c.oid and p.polname=pairs.n
    )
    select json_build_object('search_path',current_setting('search_path'),
      'uid_functions',(select json_agg(json_build_object('oid',p.oid,'schema',n.nspname,'name',p.proname,
        'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by n.nspname,p.oid)
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='uid'),
      'policies',(select json_agg(json_build_object('index',x.i,'side',x.side,
        'schema',x.s,'table',x.t,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
        'roles',(select json_agg(case when r=0 then 'public' else pg_get_userbyid(r) end order by r) from unnest(p.polroles) r),
        'using',pg_get_expr(p.polqual,p.polrelid,false),'check',pg_get_expr(p.polwithcheck,p.polrelid,false),
        'functions',(select coalesce(json_agg(json_build_object('oid',f.oid,'schema',ns.nspname,'name',f.proname,
          'arguments',pg_get_function_identity_arguments(f.oid)) order by f.oid),'[]'::json)
          from pg_depend d join pg_proc f on f.oid=d.refobjid join pg_namespace ns on ns.oid=f.pronamespace
          where d.classid='pg_policy'::regclass and d.objid=p.oid and d.refclassid='pg_proc'::regclass))
        order by x.i,x.side) from resolved x join pg_policy p on p.oid=x.policy_oid)); rollback;`);
  return statements.join('\n');
}

export function comparePolicyEvidence(restored,baseline,evidence) {
  assert.deepEqual(restored.map(policyHeader),baseline.map(policyHeader),'Policy inventory/characteristics changed');
  assert.equal(evidence.search_path,'pg_catalog','Uncontrolled policy deparser context');
  assert.equal(evidence.policies.length,baseline.length*2,'Missing policy evidence');
  for(const [index,p] of baseline.entries()) {
    const rows=evidence.policies.filter(row=>row.index===index);
    const actual=rows.find(row=>row.side==='actual'), expected=rows.find(row=>row.side==='expected');
    assert.ok(actual && expected,'Missing resolved policy');
    assert.equal(expected.schema,p.schema);assert.equal(expected.table,p.table);assert.equal(expected.name,p.name);
    assert.equal(expected.command,({SELECT:'r',INSERT:'a',UPDATE:'w',DELETE:'d',ALL:'*'})[p.command]);
    assert.equal(expected.permissive,p.mode==='PERMISSIVE');
    assert.deepEqual([...expected.roles].sort(),[...p.roles].sort());
    const {side:actualSide,...actualPolicy}=actual;
    const {side:expectedSide,...expectedPolicy}=expected;
    assert.equal(actualSide,'actual');assert.equal(expectedSide,'expected');
    assert.deepEqual(actualPolicy,expectedPolicy,`Resolved policy differs: ${p.schema}.${p.table}.${p.name}`);
  }
}

export function compareRestoredSecurity(restored,baseline,policyEvidence) {
  assert.equal(baseline.project,'onfxxtvfprjnqsxdmhkp');
  assert.equal(baseline.read_only,'on');
  for(const key of ['tables','functions']) assert.deepEqual(comparableRows(restored[key]),comparableRows(baseline[key]));
  if(policyEvidence) comparePolicyEvidence(restored.policies,baseline.policies,policyEvidence);
  else assert.deepEqual(restored.policies,baseline.policies);
  assert.deepEqual(restored.role_permissions,baseline.role_permissions);
  assert.deepEqual(restored.private_schema_grants,baseline.private_schema_grants);
}
