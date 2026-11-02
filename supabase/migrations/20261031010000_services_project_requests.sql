-- Stage 4A.1: LOCAL ONLY. Never rewrite the deployed identity migrations.
create schema business_private;
revoke all on schema business_private from public, anon, authenticated, service_role;
grant usage on schema business_private to authenticated;

insert into public.permissions(code,description) values
 ('services.budgets.manage','Manage service-specific estimated-budget options, not quotation prices.');
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('platform_owner','operations_lead') and p.code='services.budgets.manage';

create table public.services (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=100),
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null check(length(btrim(description)) between 1 and 10000),
 status text not null default 'draft' check(status in ('draft','published','retired')),
 accepting_requests boolean not null default false,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not accepting_requests or status='published')
);
create table public.service_budget_options (
 id uuid primary key default gen_random_uuid(),
 service_id uuid not null references public.services(id) on delete restrict,
 label text not null check(length(btrim(label)) between 1 and 160),
 currency text check(currency ~ '^[A-Z]{3}$'),
 min_minor bigint check(min_minor between 0 and 9007199254740991),
 max_minor bigint check(max_minor between 0 and 9007199254740991),
 is_unsure boolean not null default false,
 is_active boolean not null default true, sort_order integer not null default 0 check(sort_order between 0 and 10000),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,service_id),
 check((is_unsure and min_minor is null and max_minor is null) or
       (not is_unsure and currency is not null and (min_minor is not null or max_minor is not null))),
 check(min_minor is null or max_minor is null or max_minor>=min_minor)
);
create index service_budgets_service_idx on public.service_budget_options(service_id,sort_order,id);

create table business_private.project_requests (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique default ('BWR-'||replace(gen_random_uuid()::text,'-','')),
 service_id uuid not null references public.services(id) on delete restrict,
 budget_option_id uuid,
 service_snapshot jsonb not null check(jsonb_typeof(service_snapshot)='object'),
 budget_snapshot jsonb check(budget_snapshot is null or jsonb_typeof(budget_snapshot)='object'),
 full_name text not null check(length(btrim(full_name)) between 1 and 160),
 email text not null check(length(email)<=254 and email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 whatsapp text not null check(whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
 requirements text not null check(length(btrim(requirements)) between 20 and 10000),
 preferred_deadline date,
 status text not null default 'received' check(status in ('received','triaging','discussing','declined','cancelled','closed')),
 consent_version text not null check(length(consent_version) between 1 and 64),
 consented_at timestamptz not null default now(),
 idempotency_hash bytea not null unique check(octet_length(idempotency_hash)=32),
 payload_hash bytea not null check(octet_length(payload_hash)=32),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(budget_option_id,service_id) references public.service_budget_options(id,service_id) on delete restrict
);
create index project_requests_queue_idx on business_private.project_requests(status,created_at desc,id);
create index project_requests_service_idx on business_private.project_requests(service_id);
create index project_requests_budget_idx on business_private.project_requests(budget_option_id,service_id);
create table business_private.submission_buckets (
 scope text not null check(scope in ('email','global')),
 key_hash bytea not null check(octet_length(key_hash)=32),
 window_start timestamptz not null, attempts integer not null check(attempts between 1 and 30),
 primary key(scope,key_hash,window_start)
);

create table business_private.request_attachments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references business_private.project_requests(id) on delete restrict,
 bucket_id text not null default 'project-request-documents' check(bucket_id='project-request-documents'),
 object_key text not null unique,
 display_name text not null check(length(display_name) between 1 and 200 and display_name !~ '[\r\n/\\]'),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 byte_size bigint not null check(byte_size between 1 and 10485760),
 sha256_hex text not null check(sha256_hex ~ '^[a-f0-9]{64}$'),
 scan_status text not null default 'quarantined' check(scan_status in ('quarantined','clean','rejected')),
 scanned_at timestamptz,
 created_at timestamptz not null default now(),
 check(object_key=request_id::text||'/'||id::text),
 check((scan_status='quarantined' and scanned_at is null) or (scan_status<>'quarantined' and scanned_at is not null))
);
create index request_attachments_request_idx on business_private.request_attachments(request_id);

alter table public.services enable row level security;
alter table public.service_budget_options enable row level security;
alter table business_private.project_requests enable row level security;
alter table business_private.request_attachments enable row level security;
alter table business_private.submission_buckets enable row level security;
revoke all on public.services,public.service_budget_options from public,anon,authenticated,service_role;
revoke all on all tables in schema business_private from public,anon,authenticated,service_role;
grant select on public.services,public.service_budget_options to anon,authenticated;
grant select on business_private.project_requests,business_private.request_attachments to authenticated;

create policy services_public on public.services for select to anon,authenticated using(status='published');
create policy services_staff on public.services for select to authenticated using(
 (select app_private.has_aal2_session()) and
 ((select app_private.has_permission('content.read')) or (select app_private.has_permission('services.budgets.manage'))));
create policy budgets_public on public.service_budget_options for select to anon,authenticated using(
 is_active and exists(select from public.services s where s.id=service_id and s.status='published'));
create policy budgets_staff on public.service_budget_options for select to authenticated using(
 (select app_private.has_aal2_session()) and
 ((select app_private.has_permission('content.read')) or (select app_private.has_permission('services.budgets.manage'))));
create policy requests_read on business_private.project_requests for select to authenticated using((select app_private.has_permission('inquiries.read')));
create policy requests_mfa on business_private.project_requests as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy attachments_read on business_private.request_attachments for select to authenticated using((select app_private.has_permission('inquiries.read')));
create policy attachments_mfa on business_private.request_attachments as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

-- Empty search paths; exact commands only. No ordinary table mutation grants.
create function business_private.require_permission(p_code text) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.has_aal2_session() or not app_private.has_permission(p_code) then
  raise exception 'Access denied' using errcode='42501';
 end if;
end;$$;
revoke all on function business_private.require_permission(text) from public,anon,authenticated,service_role;

create function public.save_service(p_id uuid,p_version integer,p_slug text,p_title text,p_description text,p_status text,p_accepting boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.services; old_status text;
begin
 if p_id is null then
  perform business_private.require_permission('content.create');
  if p_status<>'draft' then perform business_private.require_permission('content.publish'); end if;
  insert into public.services(slug,title,description,status,accepting_requests)
   values(p_slug,btrim(p_title),btrim(p_description),p_status,p_accepting) returning * into v;
 else
  perform business_private.require_permission('content.update');
  select status into old_status from public.services where id=p_id for update;
  if not found then raise exception 'Service unavailable'; end if;
  if old_status<>p_status or old_status='published' then perform business_private.require_permission('content.publish'); end if;
  update public.services set slug=p_slug,title=btrim(p_title),description=btrim(p_description),status=p_status,
   accepting_requests=p_accepting,version=version+1,updated_at=now() where id=p_id and version=p_version returning * into v;
  if not found then raise exception 'Stale service version' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'service.saved','service',v.id::text,jsonb_build_object('version',v.version,'status',v.status));
 return to_jsonb(v);
end;$$;

create function public.save_service_budget(p_id uuid,p_version integer,p_service_id uuid,p_label text,p_currency text,
 p_min_minor bigint,p_max_minor bigint,p_unsure boolean,p_active boolean,p_sort integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.service_budget_options;
begin
 perform business_private.require_permission('services.budgets.manage');
 perform 1 from public.services where id=p_service_id for update;
 if not found then raise exception 'Service unavailable'; end if;
 if p_id is null then
  insert into public.service_budget_options(service_id,label,currency,min_minor,max_minor,is_unsure,is_active,sort_order)
   values(p_service_id,btrim(p_label),p_currency,p_min_minor,p_max_minor,p_unsure,p_active,p_sort) returning * into v;
 else
  update public.service_budget_options set label=btrim(p_label),currency=p_currency,min_minor=p_min_minor,max_minor=p_max_minor,
   is_unsure=p_unsure,is_active=p_active,sort_order=p_sort,version=version+1,updated_at=now()
   where id=p_id and service_id=p_service_id and version=p_version returning * into v;
  if not found then raise exception 'Stale budget version' using errcode='40001'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'service.budget_saved','service_budget',v.id::text,jsonb_build_object('version',v.version));
 return to_jsonb(v);
end;$$;

-- Service-role-only ingress; caller-supplied staff IDs, status and attachment keys are never accepted.
create function public.submit_project_request(p_payload jsonb,p_idempotency_hex text,p_email_hex text,p_global_hex text)
returns text language plpgsql security definer set search_path='' as $$
declare s public.services; b public.service_budget_options; existing business_private.project_requests;
 sid uuid; bid uuid; deadline date; result text; payload_digest bytea; w timestamptz;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>16000
  or p_idempotency_hex is null or p_idempotency_hex !~ '^[a-f0-9]{64}$'
  or p_email_hex is null or p_email_hex !~ '^[a-f0-9]{64}$'
  or p_global_hex is null or p_global_hex !~ '^[a-f0-9]{64}$'
  or (p_payload - array['serviceId','budgetOptionId','fullName','email','whatsapp','requirements','preferredDeadline','consentVersion'])<>'{}'::jsonb
  or not p_payload ?& array['serviceId','fullName','email','whatsapp','requirements','consentVersion']
  or exists(select from jsonb_each(p_payload) x where jsonb_typeof(x.value) not in ('string','null'))
  or p_payload->>'serviceId' is null or p_payload->>'fullName' is null or p_payload->>'email' is null
  or p_payload->>'whatsapp' is null or p_payload->>'requirements' is null or p_payload->>'consentVersion' is null then
  raise exception 'Invalid submission' using errcode='22023';
 end if;
 sid:=(p_payload->>'serviceId')::uuid;bid:=(p_payload->>'budgetOptionId')::uuid;
 deadline:=(p_payload->>'preferredDeadline')::date;
 if deadline is not null and (deadline<current_date or deadline>current_date+3650) then raise exception 'Invalid deadline' using errcode='22023'; end if;
 payload_digest:=sha256(convert_to(p_payload::text,'UTF8'));
 -- One bounded global lock makes deduplication and hourly quota consumption atomic.
 perform pg_advisory_xact_lock(42041,1);
 select * into existing from business_private.project_requests where idempotency_hash=decode(p_idempotency_hex,'hex');
 if found then
  if existing.payload_hash<>payload_digest then raise exception 'Conflicting submission' using errcode='22023'; end if;
  return existing.reference;
 end if;
 select * into s from public.services where id=sid and status='published' and accepting_requests for share;
 if not found then raise exception 'Service unavailable' using errcode='22023'; end if;
 if bid is not null then
  select * into b from public.service_budget_options where id=bid and service_id=sid and is_active for share;
  if not found then raise exception 'Budget unavailable' using errcode='22023'; end if;
 elsif exists(select from public.service_budget_options where service_id=sid and is_active) then
  raise exception 'Budget required' using errcode='22023';
 end if;
 w:=date_trunc('hour',clock_timestamp());
 if coalesce((select attempts from business_private.submission_buckets where scope='global' and key_hash=decode(p_global_hex,'hex') and window_start=w),0)>=30
 or coalesce((select attempts from business_private.submission_buckets where scope='email' and key_hash=decode(p_email_hex,'hex') and window_start=w),0)>=3 then
  raise exception 'Submission temporarily unavailable' using errcode='P0001';
 end if;
 insert into business_private.submission_buckets values('global',decode(p_global_hex,'hex'),w,1)
 on conflict(scope,key_hash,window_start) do update set attempts=business_private.submission_buckets.attempts+1;
 insert into business_private.submission_buckets values('email',decode(p_email_hex,'hex'),w,1)
 on conflict(scope,key_hash,window_start) do update set attempts=business_private.submission_buckets.attempts+1;
 insert into business_private.project_requests(service_id,budget_option_id,service_snapshot,budget_snapshot,full_name,email,whatsapp,requirements,preferred_deadline,consent_version,idempotency_hash,payload_hash)
 values(sid,bid,jsonb_build_object('title',s.title,'slug',s.slug,'version',s.version),
  case when bid is null then null else jsonb_build_object('label',b.label,'currency',b.currency,'minMinor',b.min_minor,'maxMinor',b.max_minor,'unsure',b.is_unsure,'version',b.version) end,
  btrim(p_payload->>'fullName'),lower(btrim(p_payload->>'email')),p_payload->>'whatsapp',btrim(p_payload->>'requirements'),deadline,p_payload->>'consentVersion',decode(p_idempotency_hex,'hex'),payload_digest)
 returning reference into result;
 return result;
end;$$;

create function public.get_project_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform business_private.require_permission('inquiries.read');
 select to_jsonb(r)-'idempotency_hash'-'payload_hash' into result from business_private.project_requests r where id=p_id;
 return result;
end;$$;
create function public.list_project_requests(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform business_private.require_permission('inquiries.read');
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from
  (select id,reference,service_id,full_name,status,created_at,version from business_private.project_requests order by created_at desc,id limit p_limit)x);
end;$$;
create function public.set_project_request_status(p_id uuid,p_version integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_status text; v business_private.project_requests;
begin
 perform business_private.require_permission('inquiries.manage');
 select status into old_status from business_private.project_requests where id=p_id for update;
 if not found then raise exception 'Request unavailable'; end if;
 if not ((old_status='received' and p_status in ('triaging','declined','cancelled'))
  or (old_status='triaging' and p_status in ('discussing','declined','cancelled'))
  or (old_status='discussing' and p_status in ('declined','cancelled','closed'))) then raise exception 'Invalid transition' using errcode='22023'; end if;
 update business_private.project_requests set status=p_status,version=version+1,updated_at=now()
 where id=p_id and version=p_version returning * into v;
 if not found then raise exception 'Stale request version' using errcode='40001'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'request.status_changed','project_request',p_id::text,jsonb_build_object('from',old_status,'to',p_status,'version',v.version));
 return to_jsonb(v)-'idempotency_hash'-'payload_hash';
end;$$;

-- Metadata-only foundation: no public upload reservation/finalization or scanner bypass.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('project-request-documents','project-request-documents',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy request_document_download on storage.objects for select to authenticated using(
 bucket_id='project-request-documents' and (select app_private.has_aal2_session())
 and (select app_private.has_permission('inquiries.read')) and exists(
  select from business_private.request_attachments a where a.object_key=name and a.bucket_id=bucket_id and a.scan_status='clean'));
create function public.authorize_request_attachment(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a business_private.request_attachments;
begin
 perform business_private.require_permission('inquiries.read');
 select * into a from business_private.request_attachments where id=p_id and scan_status='clean';
 if not found then raise exception 'Document unavailable' using errcode='42501'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'request.attachment_download_authorized','request_attachment',p_id::text,'{}');
 return jsonb_build_object('bucket',a.bucket_id,'key',a.object_key);
end;$$;

revoke all on function public.save_service(uuid,integer,text,text,text,text,boolean),
 public.save_service_budget(uuid,integer,uuid,text,text,bigint,bigint,boolean,boolean,integer),
 public.get_project_request(uuid),public.list_project_requests(integer),public.set_project_request_status(uuid,integer,text),
 public.authorize_request_attachment(uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_service(uuid,integer,text,text,text,text,boolean),
 public.save_service_budget(uuid,integer,uuid,text,text,bigint,bigint,boolean,boolean,integer),
 public.get_project_request(uuid),public.list_project_requests(integer),public.set_project_request_status(uuid,integer,text),
 public.authorize_request_attachment(uuid) to authenticated;
revoke all on function public.submit_project_request(jsonb,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_project_request(jsonb,text,text,text) to service_role;
