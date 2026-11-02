begin;
-- Local-only assisted delivery. No provider sending, Auth or public-schema exposure changes.
insert into public.permissions(code,description) values('quotations.send','Prepare and record manually dispatched finalized quotation revisions');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('platform_owner','operations_lead') and p.code='quotations.send';
alter table business_private.quotation_revisions drop constraint quotation_revisions_template_version_check;
alter table business_private.quotation_revisions add constraint quotation_revisions_template_version_check check(template_version in (1,2));
alter table business_private.quotation_revisions alter column template_version set default 2;

create table business_private.quotation_deliveries (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references business_private.project_requests(id) on delete restrict,
 revision_id uuid not null references business_private.quotation_revisions(id) on delete restrict,
 channel text not null check(channel in ('whatsapp','email')),
 recipient text not null check(length(recipient) between 8 and 254),
 recipient_source text not null default 'submitted' check(recipient_source='submitted'),
 pdf_sha256 text not null check(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'READY' check(status in ('READY','MANUALLY_SENT','NEEDS_FOLLOW_UP')),
 version integer not null default 1 check(version>0),
 notes text not null default '' check(length(notes)<=1000),
 initiated_by uuid references public.team_profiles(id) on delete set null,
 confirmed_by uuid references public.team_profiles(id) on delete set null,
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(revision_id,channel),
 check((status='MANUALLY_SENT' and confirmed_at is not null) or (status<>'MANUALLY_SENT' and confirmed_at is null))
);
create index quotation_deliveries_request_idx on business_private.quotation_deliveries(request_id,created_at desc);
create table business_private.quotation_delivery_events (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null references business_private.quotation_deliveries(id) on delete restrict,
 event_key uuid not null,
 payload_hash text not null,
 status text not null check(status in ('READY','MANUALLY_SENT','NEEDS_FOLLOW_UP')),
 notes text not null default '' check(length(notes)<=1000),
 actor_id uuid references public.team_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(delivery_id,event_key)
);
alter table business_private.quotation_deliveries enable row level security;
alter table business_private.quotation_delivery_events enable row level security;
revoke all on business_private.quotation_deliveries,business_private.quotation_delivery_events from public,anon,authenticated,service_role;
grant select on business_private.quotation_deliveries,business_private.quotation_delivery_events to authenticated;
create policy delivery_read on business_private.quotation_deliveries for select to authenticated using(
 (select app_private.has_permission('inquiries.read')) and (select app_private.has_permission('quotations.read')) and (select app_private.has_permission('quotations.send')));
create policy delivery_mfa on business_private.quotation_deliveries as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy delivery_events_read on business_private.quotation_delivery_events for select to authenticated using(
 (select app_private.has_permission('inquiries.read')) and (select app_private.has_permission('quotations.read')) and (select app_private.has_permission('quotations.send')));
create policy delivery_events_mfa on business_private.quotation_delivery_events as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

create function business_private.require_delivery_permission() returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');perform business_private.require_permission('quotations.send');
end;$$;
create function business_private.delivery_recipient(p_revision uuid,p_channel text) returns text
language plpgsql stable set search_path='' as $recipient$
declare req business_private.project_requests; rev business_private.quotation_revisions; recipient text;
begin
 select * into rev from business_private.quotation_revisions where id=p_revision and state='finalized';
 if not found then raise exception 'Finalized revision required' using errcode='22023'; end if;
 select r.* into req from business_private.project_requests r join business_private.quotations q on q.request_id=r.id where q.id=rev.quotation_id;
 if p_channel='whatsapp' then
  recipient:=btrim(req.whatsapp);
  if recipient !~ '^\+[1-9][0-9]{6,14}$' or recipient is distinct from rev.client_snapshot->>'whatsapp' then raise exception 'Review submitted contact' using errcode='22023'; end if;
 elsif p_channel='email' then
  recipient:=lower(btrim(req.email));
  if length(recipient)>254 or recipient !~ $email$^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$$email$
   or split_part(recipient,'@',1) ~ '(^\.|\.$|\.\.)' or length(split_part(recipient,'@',1))>64
   or recipient is distinct from lower(rev.client_snapshot->>'email') then raise exception 'Review submitted contact' using errcode='22023'; end if;
 else raise exception 'Invalid channel' using errcode='22023'; end if;
 return recipient;
end;$recipient$;
create function business_private.freeze_delivery_event() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.actor_id is null and old.actor_id is not null and (to_jsonb(new)-'actor_id')=(to_jsonb(old)-'actor_id') then return new; end if;
 raise exception 'Dispatch history is append-only' using errcode='42501';
end;$$;
create trigger freeze_delivery_event before update or delete on business_private.quotation_delivery_events for each row execute function business_private.freeze_delivery_event();
create function business_private.freeze_delivery_target() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.request_id,new.revision_id,new.channel,new.recipient,new.recipient_source,new.pdf_sha256,new.created_at)
 is distinct from row(old.request_id,old.revision_id,old.channel,old.recipient,old.recipient_source,old.pdf_sha256,old.created_at) then
  raise exception 'Dispatch target is immutable' using errcode='42501'; end if;
 if new.initiated_by is distinct from old.initiated_by and not (new.initiated_by is null and old.initiated_by is not null) then raise exception 'Dispatch initiator is immutable' using errcode='42501'; end if;
 return new;
end;$$;
create trigger freeze_delivery_target before update on business_private.quotation_deliveries for each row execute function business_private.freeze_delivery_target();
revoke all on function business_private.require_delivery_permission(),business_private.delivery_recipient(uuid,text),business_private.freeze_delivery_event(),business_private.freeze_delivery_target() from public,anon,authenticated,service_role;

create function public.get_quotation_delivery(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d business_private.quotation_deliveries; v jsonb;
begin
 perform business_private.require_delivery_permission();
 select * into d from business_private.quotation_deliveries where id=p_id;
 if not found then raise exception 'Dispatch unavailable'; end if;
 v:=public.get_quotation_revision(d.revision_id);
 if v->>'state'<>'finalized' or v->>'pdf_sha256' is distinct from d.pdf_sha256 then raise exception 'Revision mismatch'; end if;
 if business_private.delivery_recipient(d.revision_id,d.channel) is distinct from d.recipient then raise exception 'Recipient changed' using errcode='PT409'; end if;
 return to_jsonb(d)||jsonb_build_object('quotation_number',v->'document'->>'number','revision',v->>'revision','client_name',v->'document'->'client'->>'name','service_name',v->'document'->'request'->>'service',
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb) from business_private.quotation_delivery_events e where e.delivery_id=d.id));
end;$$;
create function public.list_quotation_deliveries(p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform business_private.require_delivery_permission();
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from
 (select d.*,r.revision,q.number quotation_number from business_private.quotation_deliveries d join business_private.quotation_revisions r on r.id=d.revision_id join business_private.quotations q on q.id=r.quotation_id where d.request_id=p_request_id)x);
end;$$;
create function public.prepare_quotation_delivery(p_revision_id uuid,p_channel text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r business_private.quotation_revisions; req uuid; target text; did uuid;
begin
 perform business_private.require_delivery_permission();
 select * into r from business_private.quotation_revisions where id=p_revision_id for share;
 if not found or r.state<>'finalized' then raise exception 'Finalized revision required' using errcode='22023'; end if;
 target:=business_private.delivery_recipient(p_revision_id,p_channel);
 select request_id into req from business_private.quotations where id=r.quotation_id;
 perform pg_advisory_xact_lock(hashtextextended(p_revision_id::text||p_channel,0));
 select id into did from business_private.quotation_deliveries where revision_id=p_revision_id and channel=p_channel;
 if found then
  if (select recipient is distinct from target or pdf_sha256 is distinct from r.pdf_sha256 from business_private.quotation_deliveries where id=did) then raise exception 'Dispatch target changed' using errcode='PT409'; end if;
  return public.get_quotation_delivery(did);
 end if;
 insert into business_private.quotation_deliveries(request_id,revision_id,channel,recipient,pdf_sha256,initiated_by)
 values(req,p_revision_id,p_channel,target,r.pdf_sha256,auth.uid()) returning id into did;
 insert into business_private.quotation_delivery_events(delivery_id,event_key,payload_hash,status,actor_id) values(did,gen_random_uuid(),'prepared','READY',auth.uid());
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'quotation.dispatch_prepared','quotation_delivery',did::text,jsonb_build_object('revision_id',p_revision_id,'channel',p_channel,'manualOnly',true));
 return public.get_quotation_delivery(did);
end;$$;
create function public.record_quotation_dispatch(p_id uuid,p_version integer,p_event_key uuid,p_status text,p_notes text,p_attested boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d business_private.quotation_deliveries; e business_private.quotation_delivery_events; note text; digest text;
begin
 perform business_private.require_delivery_permission();
 note:=btrim(coalesce(p_notes,''));
 if p_version is null or p_version<1 or p_event_key is null or p_status is null or p_status not in ('MANUALLY_SENT','NEEDS_FOLLOW_UP') or length(note)>1000
 or note ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' or (p_status='MANUALLY_SENT' and p_attested is distinct from true) then raise exception 'Review dispatch confirmation' using errcode='22023'; end if;
 digest:=encode(sha256(convert_to(jsonb_build_object('status',p_status,'notes',note,'attested',coalesce(p_attested,false))::text,'UTF8')),'hex');
 select * into d from business_private.quotation_deliveries where id=p_id for update;
 if not found then raise exception 'Dispatch unavailable'; end if;
 select * into e from business_private.quotation_delivery_events where delivery_id=p_id and event_key=p_event_key;
 if found then
  if e.payload_hash is distinct from digest then raise exception 'Confirmation key reused' using errcode='PT409'; end if;
  return public.get_quotation_delivery(p_id);
 end if;
 if d.version<>p_version or d.status='MANUALLY_SENT' then raise exception 'Dispatch changed' using errcode='PT409'; end if;
 if business_private.delivery_recipient(d.revision_id,d.channel) is distinct from d.recipient then raise exception 'Recipient changed' using errcode='PT409'; end if;
 update business_private.quotation_deliveries set status=p_status,version=version+1,notes=note,updated_at=now(),
 confirmed_at=case when p_status='MANUALLY_SENT' then now() end,confirmed_by=case when p_status='MANUALLY_SENT' then auth.uid() end where id=p_id;
 insert into business_private.quotation_delivery_events(delivery_id,event_key,payload_hash,status,notes,actor_id) values(p_id,p_event_key,digest,p_status,note,auth.uid());
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'quotation.dispatch_recorded','quotation_delivery',p_id::text,jsonb_build_object('revision_id',d.revision_id,'channel',d.channel,'status',p_status,'staffConfirmedOnly',true));
 return public.get_quotation_delivery(p_id);
end;$$;
revoke all on function public.get_quotation_delivery(uuid),public.list_quotation_deliveries(uuid),public.prepare_quotation_delivery(uuid,text),public.record_quotation_dispatch(uuid,integer,uuid,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_quotation_delivery(uuid),public.list_quotation_deliveries(uuid),public.prepare_quotation_delivery(uuid,text),public.record_quotation_dispatch(uuid,integer,uuid,text,text,boolean) to authenticated;

create or replace function public.save_quotation_draft(p_id uuid,p_version integer,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v business_private.quotation_revisions;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');perform business_private.require_permission('quotations.manage');
 perform business_private.validate_quotation(p_content,false);
 update business_private.quotation_revisions set content=p_content,template_version=2,version=version+1,updated_at=now()
 where id=p_id and version=p_version and state='draft' returning * into v;
 if not found then raise exception 'Quotation changed' using errcode='PT409'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'quotation.draft_saved','quotation_revision',p_id::text,jsonb_build_object('version',v.version));
 return public.get_quotation_revision(p_id);
end;$$;

create or replace function public.finalize_quotation(p_id uuid,p_version integer,p_digest text,p_pdf_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v business_private.quotation_revisions; doc jsonb;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');
 perform business_private.require_permission('quotations.manage');perform business_private.require_permission('documents.export');
 select * into v from business_private.quotation_revisions where id=p_id for update;
 if not found or p_version is null or p_version<1 or v.version<>p_version or v.state<>'draft' then raise exception 'Quotation changed' using errcode='PT409'; end if;
 if v.template_version<>2 then raise exception 'Save the draft to apply current branding before finalizing' using errcode='22023'; end if;
 perform business_private.validate_quotation(v.content,true);
 if (v.content->>'validUntil')::date<current_date or (v.content->>'validUntil')::date>current_date+730 then raise exception 'Review validity date' using errcode='22023'; end if;
 doc:=business_private.quotation_document(p_id);
 if p_digest is distinct from encode(sha256(convert_to(doc::text,'UTF8')),'hex') or p_pdf_sha256 is null or p_pdf_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Document changed' using errcode='PT409'; end if;
 update business_private.quotation_revisions set state='finalized',version=version+1,pdf_sha256=p_pdf_sha256,finalized_at=now(),finalized_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'quotation.finalized','quotation_revision',p_id::text,jsonb_build_object('revision',v.revision,'pdf_sha256',p_pdf_sha256,'teamAgreementConfirmed',true));
 return public.get_quotation_revision(p_id);
end;$$;

commit;
