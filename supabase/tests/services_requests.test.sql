begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id) select ('40000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,5)n;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
 select id,id,'totp','verified',now(),now() from auth.users where id::text like '40000000-%';
insert into auth.sessions(id,user_id,factor_id,aal)
 select id,id,id,'aal2' from auth.users where id::text like '40000000-%';
insert into public.team_profiles(id,full_name)
 select id,'Synthetic service staff' from auth.users where id::text like '40000000-%' and id::text not like '%5';
insert into public.team_role_assignments(user_id,role_id)
 select ('40000000-0000-4000-8000-00000000000'||v.n)::uuid,r.id from
 (values(1,'platform_owner'),(2,'operations_lead'),(3,'content_community_lead'),(4,'technical_lead'))v(n,code)
 join public.roles r on r.code=v.code;
insert into public.services(id,slug,title,description,status,accepting_requests) values
 ('41000000-0000-4000-8000-000000000001','local-published','Local service','Plain description','published',true),
 ('41000000-0000-4000-8000-000000000002','local-draft','Draft service','Private draft','draft',false);
insert into public.service_budget_options(id,service_id,label,currency,min_minor,max_minor) values
 ('42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','Local estimate','USD',100,200),
 ('42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','Draft estimate','USD',100,200);
create function pg_temp.payload() returns jsonb language sql as $$select '{"serviceId":"41000000-0000-4000-8000-000000000001","budgetOptionId":"42000000-0000-4000-8000-000000000001","fullName":"Local Visitor","email":"local@example.invalid","whatsapp":"+237600000000","requirements":"A detailed local test requirement.","preferredDeadline":null,"consentVersion":"local-v1"}'::jsonb$$;
create function pg_temp.claims(n integer,aal text default 'aal2') returns text language sql as $$
 select json_build_object('sub','40000000-0000-4000-8000-00000000000'||n,'role','authenticated','aal',aal,'session_id','40000000-0000-4000-8000-00000000000'||n,'exp',extract(epoch from now()+interval '1 hour')::bigint)::text$$;
select extensions.is((select count(*) from public.permissions),27::bigint,'reviewed current permission catalog');
select extensions.is((select count(*) from public.role_permissions),52::bigint,'reviewed current role mappings');
select extensions.ok(not has_table_privilege('authenticated','public.services','INSERT,UPDATE,DELETE'),'staff have no direct catalog mutations');
select extensions.ok(not has_table_privilege('service_role','business_private.project_requests','SELECT,INSERT,UPDATE,DELETE'),'ingress credential has no direct request grant');
select extensions.ok(not has_function_privilege('anon','public.submit_project_request(jsonb,text,text,text)','execute'),'anonymous cannot invoke privileged ingress');
select extensions.ok(not has_function_privilege('authenticated','public.submit_project_request(jsonb,text,text,text)','execute'),'staff cannot bypass public ingress');
select extensions.is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='business_private' and c.relkind='r' and c.relrowsecurity),11::bigint,'all business tables enable RLS');
select extensions.ok(not (select public from storage.buckets where id='project-request-documents'),'document bucket is private');
set local role anon;
select extensions.is((select count(*) from public.services where slug in ('local-published','local-draft')),1::bigint,'anonymous sees published service only');
select extensions.is((select count(*) from public.service_budget_options where service_id in ('41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002')),1::bigint,'anonymous sees only published budget');
select extensions.throws_ok('select * from business_private.project_requests','42501',null,'no anonymous private-table access');
select extensions.throws_ok('select public.list_project_requests(25)','42501',null,'no anonymous request RPC');
reset role;
set local role service_role;
select extensions.matches(public.submit_project_request(pg_temp.payload(),repeat('a',64),repeat('b',64),repeat('c',64)),'^BWR-[a-f0-9]{32}$','public ingress creates opaque receipt');
select extensions.is(public.submit_project_request(pg_temp.payload(),repeat('a',64),repeat('b',64),repeat('c',64)),public.submit_project_request(pg_temp.payload(),repeat('a',64),repeat('b',64),repeat('c',64)),'retry returns same receipt');
select extensions.throws_ok($$select public.submit_project_request(pg_temp.payload()||'{"fullName":"Changed"}',repeat('a',64),repeat('b',64),repeat('c',64))$$,'22023',null,'conflicting idempotency payload rejected');
select extensions.throws_ok($$select public.submit_project_request(pg_temp.payload()||'{"budgetOptionId":"42000000-0000-4000-8000-000000000002"}',repeat('d',64),repeat('b',64),repeat('c',64))$$,'22023',null,'cross-service budget rejected');
select extensions.throws_ok($$select public.submit_project_request(pg_temp.payload()||'{"status":"approved"}',repeat('d',64),repeat('b',64),repeat('c',64))$$,'22023',null,'caller cannot choose approval state');
reset role;
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),1::bigint,'no duplicate or invalid requests persisted');
select extensions.is((select attempts from business_private.submission_buckets where scope='email' and key_hash=decode(repeat('b',64),'hex')),1,'idempotency retry consumes no extra quota');
select extensions.ok((select budget_snapshot->>'label'='Local estimate' from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),'budget label snapshot retained');
insert into business_private.request_attachments(id,request_id,object_key,display_name,mime_type,byte_size,sha256_hex)
 select '43000000-0000-4000-8000-000000000001',id,id::text||'/43000000-0000-4000-8000-000000000001','local.pdf','application/pdf',100,repeat('f',64) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',pg_temp.claims(2),true);
select extensions.is((select count(*)::integer from jsonb_array_elements(public.list_project_requests(100)) x where x->>'service_id'='41000000-0000-4000-8000-000000000001'),1,'operations can read private requests');
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),1::bigint,'operations direct RLS agrees');
select extensions.throws_ok($$select public.authorize_request_attachment('43000000-0000-4000-8000-000000000001')$$,'42501',null,'quarantined attachment download denied');
select extensions.lives_ok($$select public.set_project_request_status((select id from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),1,'triaging')$$,'operations may triage');
select extensions.throws_ok($$select public.set_project_request_status((select id from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),1,'discussing')$$,'PT409',null,'stale request update rejected');
select extensions.throws_ok($$select public.set_project_request_status((select id from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),2,'approved')$$,'22023',null,'future approval flow unavailable');
reset role;
create function pg_temp.reject_request_audit() returns trigger language plpgsql as $$begin
 if new.action='request.status_changed' then raise exception 'Synthetic audit failure'; end if; return new; end;$$;
create trigger reject_request_audit before insert on public.audit_logs for each row execute function pg_temp.reject_request_audit();
set local role authenticated;
select extensions.throws_ok($$select public.set_project_request_status((select id from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),2,'discussing')$$,'P0001',null,'audit failure rejects status transaction');
select extensions.is((select status from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),'triaging','status rolls back after audit failure');
reset role;
drop trigger reject_request_audit on public.audit_logs;
set local role authenticated;
select extensions.lives_ok($$select public.save_service_budget(null,null,'41000000-0000-4000-8000-000000000001','Not sure',null,null,null,true,true,1)$$,'operations can configure budget options');
select extensions.throws_ok($$select public.save_service(null,null,'ops-forbidden','Ops','Description','draft',false)$$,'42501',null,'operations cannot change editorial service content');
select set_config('request.jwt.claims',pg_temp.claims(3),true);
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),0::bigint,'content staff direct RLS hides requests');
select extensions.throws_ok('select public.list_project_requests()','42501',null,'content cannot read private request RPC');
select extensions.throws_ok($$select public.save_service_budget(null,null,'41000000-0000-4000-8000-000000000001','No',null,null,null,true,true,0)$$,'42501',null,'content cannot change budgets');
select extensions.lives_ok($$select public.save_service(null,null,'new-draft','Draft','Description','draft',false)$$,'content may create service draft');
select set_config('request.jwt.claims',pg_temp.claims(4),true);
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),0::bigint,'technical lead has no private client access');
select extensions.throws_ok('select public.list_project_requests()','42501',null,'technical lead request RPC denied');
select set_config('request.jwt.claims',pg_temp.claims(5),true);
select extensions.throws_ok('select public.list_project_requests()','42501',null,'unassigned AAL2 user denied');
select set_config('request.jwt.claims',pg_temp.claims(2,'aal1'),true);
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),0::bigint,'AAL1 operations direct RLS denied');
select extensions.throws_ok('select public.list_project_requests()','42501',null,'AAL1 operations RPC denied');
reset role;
update public.team_profiles set is_active=false where id='40000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims',pg_temp.claims(2),true);
select extensions.throws_ok('select public.list_project_requests()','42501',null,'inactive operations denied');
select extensions.throws_ok($$insert into public.team_role_assignments select auth.uid(),id from public.roles where code='platform_owner'$$,'42501',null,'no role self-assignment');
reset role;
select extensions.is((select count(*) from public.audit_logs where action='request.status_changed'),1::bigint,'successful triage audited once');
select extensions.ok(not exists(select from public.audit_logs where metadata::text like '%local@example.invalid%'),'audits contain no client email');
select extensions.is((select service_snapshot->>'title' from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),'Local service','service snapshot retained');
update public.services set title='Changed service' where id='41000000-0000-4000-8000-000000000001';
select extensions.is((select service_snapshot->>'title' from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),'Local service','live changes do not rewrite receipt snapshot');
set local role service_role;
select public.submit_project_request(pg_temp.payload(),repeat('d',64),repeat('b',64),repeat('c',64));
select public.submit_project_request(pg_temp.payload(),repeat('e',64),repeat('b',64),repeat('c',64));
select extensions.throws_ok($$select public.submit_project_request(pg_temp.payload(),repeat('f',64),repeat('b',64),repeat('c',64))$$,'P0001',null,'email quota exhausted');
reset role;
select extensions.is((select count(*) from business_private.project_requests where service_id='41000000-0000-4000-8000-000000000001'),3::bigint,'quota failure creates no fourth record');
select extensions.is((select attempts from business_private.submission_buckets where scope='global' and key_hash=decode(repeat('c',64),'hex')),3,'quota counts only committed submissions');
select * from extensions.finish();
rollback;
