-- Local Stage 4A.4. Private preparation only: no dispatch or payment workflow.
insert into public.permissions(code,description) values
 ('documents.export','Export authorized private request and quotation documents'),
 ('quotations.read','Read private request quotations and revision history'),
 ('quotations.manage','Prepare and finalize request quotation revisions');
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('platform_owner','operations_lead') and p.code in ('documents.export','quotations.read','quotations.manage');

create table business_private.quotations (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references business_private.project_requests(id) on delete restrict,
 number text not null unique default ('BWQ-'||replace(gen_random_uuid()::text,'-','')),
 created_at timestamptz not null default now()
);
create table business_private.quotation_revisions (
 id uuid primary key default gen_random_uuid(),
 quotation_id uuid not null references business_private.quotations(id) on delete restrict,
 revision integer not null check(revision between 1 and 100),
 state text not null default 'draft' check(state in ('draft','finalized')),
 version integer not null default 1 check(version>0),
 document_date date not null default current_date,
 client_snapshot jsonb not null check(jsonb_typeof(client_snapshot)='object'),
 request_snapshot jsonb not null check(jsonb_typeof(request_snapshot)='object'),
 content jsonb not null check(jsonb_typeof(content)='object'),
 template_version integer not null default 1 check(template_version=1),
 pdf_sha256 text check(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 finalized_at timestamptz, finalized_by uuid references public.team_profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(quotation_id,revision),
 check((state='draft' and pdf_sha256 is null and finalized_at is null) or
       (state='finalized' and pdf_sha256 is not null and finalized_at is not null))
);
create unique index quotation_one_draft on business_private.quotation_revisions(quotation_id) where state='draft';
alter table business_private.quotations enable row level security;
alter table business_private.quotation_revisions enable row level security;
revoke all on business_private.quotations,business_private.quotation_revisions from public,anon,authenticated,service_role;
grant select on business_private.quotations,business_private.quotation_revisions to authenticated;
create policy quotation_read on business_private.quotations for select to authenticated using(
 (select app_private.has_permission('quotations.read')) and (select app_private.has_permission('inquiries.read')));
create policy quotation_mfa on business_private.quotations as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy quotation_revision_read on business_private.quotation_revisions for select to authenticated using(
 (select app_private.has_permission('quotations.read')) and (select app_private.has_permission('inquiries.read')));
create policy quotation_revision_mfa on business_private.quotation_revisions as restrictive for all to authenticated
 using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

create function business_private.validate_quotation(p jsonb, complete boolean default false) returns bigint
language plpgsql immutable set search_path='' as $$
declare item jsonb; total numeric:=0; qty numeric; price numeric; k text;
begin
 if p is null or jsonb_typeof(p)<>'object' or pg_column_size(p)>16000 or
 (p-array['projectDescription','scope','deliverables','timeline','paymentTerms','validUntil','notes','exclusions','teamAgreement','items','currency'])<>'{}'::jsonb
 or not p ?& array['projectDescription','scope','deliverables','timeline','paymentTerms','validUntil','notes','exclusions','teamAgreement','items','currency']
 or p->>'currency' is distinct from 'XAF' or jsonb_typeof(p->'teamAgreement')<>'boolean'
 or jsonb_typeof(p->'items')<>'array' then raise exception 'Invalid quotation' using errcode='22023'; end if;
 foreach k in array array['projectDescription','scope','deliverables','timeline','paymentTerms','notes','exclusions'] loop
  if jsonb_typeof(p->k)<>'string' or length(p->>k)>(case when k='projectDescription' then 10000 else 3000 end) or (p->>k) ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]' then raise exception 'Invalid quotation text' using errcode='22023'; end if;
 end loop;
 if jsonb_typeof(p->'validUntil') not in ('string','null') then raise exception 'Invalid validity' using errcode='22023'; end if;
 if p->>'validUntil' is not null and (p->>'validUntil' !~ '^\d{4}-\d{2}-\d{2}$' or (p->>'validUntil')::date::text<>p->>'validUntil') then raise exception 'Invalid validity' using errcode='22023'; end if;
 if jsonb_array_length(p->'items')>25 then raise exception 'Too many items' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p->'items') loop
  if jsonb_typeof(item)<>'object' or (item-array['description','quantity','unitAmount'])<>'{}'::jsonb or not item ?& array['description','quantity','unitAmount']
   or jsonb_typeof(item->'description')<>'string' or length(btrim(item->>'description')) not between 1 and 300
   or (item->>'description') ~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
   or jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'unitAmount')<>'number'
   then raise exception 'Invalid line item' using errcode='22023'; end if;
  qty:=(item->>'quantity')::numeric;price:=(item->>'unitAmount')::numeric;
  if qty<>trunc(qty) or qty not between 1 and 100000 or price<>trunc(price) or price not between 0 and 1000000000000 then raise exception 'Invalid amount' using errcode='22023'; end if;
  total:=total+qty*price;
 end loop;
 if total>9000000000000 then raise exception 'Total exceeds limit' using errcode='22023'; end if;
 if complete and (jsonb_array_length(p->'items')=0 or not (p->>'teamAgreement')::boolean or p->>'validUntil' is null
 or exists(select from unnest(array['projectDescription','scope','deliverables','timeline','paymentTerms']) s where length(btrim(p->>s))=0)) then
  raise exception 'Complete the quotation and confirm team agreement' using errcode='22023';
 end if;
 return total::bigint;
end;$$;

create function business_private.quotation_document(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('company',jsonb_build_object('name','BE WISE INNOVATIONS','email','contact@bewiseinnovation.com','website','bewiseinnovation.com'),
 'number',q.number,'revision',r.revision,'date',r.document_date,'client',r.client_snapshot,'request',r.request_snapshot,
 'content',r.content,'total',business_private.validate_quotation(r.content,false),'templateVersion',r.template_version)
 from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where r.id=p_id;
$$;
create function business_private.freeze_final_quotation() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.finalized_by is null and old.finalized_by is not null
 and (to_jsonb(new)-'finalized_by')=(to_jsonb(old)-'finalized_by') then return new; end if;
 if old.state='finalized' then raise exception 'Finalized quotation is immutable' using errcode='42501'; end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
create trigger freeze_final_quotation before update or delete on business_private.quotation_revisions
 for each row execute function business_private.freeze_final_quotation();
revoke all on function business_private.validate_quotation(jsonb,boolean),business_private.quotation_document(uuid),business_private.freeze_final_quotation() from public,anon,authenticated,service_role;

create function public.get_quotation_revision(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; doc jsonb;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');
 doc:=business_private.quotation_document(p_id);
 select jsonb_build_object('id',id,'quotation_id',quotation_id,'revision',revision,'version',version,'state',state,
 'document',doc,'digest',encode(sha256(convert_to(doc::text,'UTF8')),'hex'),'pdf_sha256',pdf_sha256,'finalized_at',finalized_at)
 into result from business_private.quotation_revisions where id=p_id;
 return result;
end;$$;
create function public.list_request_quotations(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.revision desc),'[]'::jsonb) from
 (select r.id,q.number,r.revision,r.state,r.version,r.finalized_at from business_private.quotations q
 join business_private.quotation_revisions r on r.quotation_id=q.id where q.request_id=p_request_id)x);
end;$$;
create function public.create_quotation_draft(p_request_id uuid,p_base_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare req business_private.project_requests; q business_private.quotations; base business_private.quotation_revisions; rid uuid; rev integer;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');perform business_private.require_permission('quotations.manage');
 select * into req from business_private.project_requests where id=p_request_id for update;
 if not found then raise exception 'Request unavailable'; end if;
 select * into q from business_private.quotations where request_id=p_request_id;
 if not found then
  if p_base_id is not null then raise exception 'Revision unavailable'; end if;
  insert into business_private.quotations(request_id) values(p_request_id) returning * into q;
 end if;
 select id into rid from business_private.quotation_revisions where quotation_id=q.id and state='draft';
 if found then return public.get_quotation_revision(rid); end if;
 select coalesce(max(revision),0)+1 into rev from business_private.quotation_revisions where quotation_id=q.id;
 if rev>1 then
  select * into base from business_private.quotation_revisions where id=p_base_id and quotation_id=q.id and state='finalized' and revision=rev-1;
  if not found then raise exception 'Choose the latest finalized revision' using errcode='PT409'; end if;
 elsif p_base_id is not null then raise exception 'Unexpected base revision'; end if;
 insert into business_private.quotation_revisions(quotation_id,revision,client_snapshot,request_snapshot,content)
 values(q.id,rev,coalesce(base.client_snapshot,jsonb_build_object('name',req.full_name,'email',req.email,'whatsapp',req.whatsapp)),
 coalesce(base.request_snapshot,jsonb_build_object('reference',req.reference,'service',req.service_snapshot->>'title')),
 coalesce(base.content,jsonb_build_object('projectDescription',req.requirements,'scope','','deliverables','','timeline','','paymentTerms','','validUntil',null,'notes','','exclusions','','teamAgreement',false,'items','[]'::jsonb,'currency','XAF'))) returning id into rid;
 -- A copied revision needs fresh off-platform team confirmation.
 if rev>1 then update business_private.quotation_revisions set content=jsonb_set(content,'{teamAgreement}','false') where id=rid; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'quotation.draft_created','quotation_revision',rid::text,jsonb_build_object('revision',rev));
 return public.get_quotation_revision(rid);
end;$$;
create function public.save_quotation_draft(p_id uuid,p_version integer,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v business_private.quotation_revisions;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');perform business_private.require_permission('quotations.manage');
 perform business_private.validate_quotation(p_content,false);
 update business_private.quotation_revisions set content=p_content,version=version+1,updated_at=now()
 where id=p_id and version=p_version and state='draft' returning * into v;
 if not found then raise exception 'Quotation changed' using errcode='PT409'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'quotation.draft_saved','quotation_revision',p_id::text,jsonb_build_object('version',v.version));
 return public.get_quotation_revision(p_id);
end;$$;
create function public.finalize_quotation(p_id uuid,p_version integer,p_digest text,p_pdf_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v business_private.quotation_revisions; doc jsonb;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');
 perform business_private.require_permission('quotations.manage');perform business_private.require_permission('documents.export');
 select * into v from business_private.quotation_revisions where id=p_id for update;
 if not found or p_version is null or p_version<1 or v.version<>p_version or v.state<>'draft' then raise exception 'Quotation changed' using errcode='PT409'; end if;
 perform business_private.validate_quotation(v.content,true);
 if (v.content->>'validUntil')::date<current_date or (v.content->>'validUntil')::date>current_date+730 then raise exception 'Review validity date' using errcode='22023'; end if;
 doc:=business_private.quotation_document(p_id);
 if p_digest is distinct from encode(sha256(convert_to(doc::text,'UTF8')),'hex') or p_pdf_sha256 is null or p_pdf_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Document changed' using errcode='PT409'; end if;
 update business_private.quotation_revisions set state='finalized',version=version+1,pdf_sha256=p_pdf_sha256,finalized_at=now(),finalized_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'quotation.finalized','quotation_revision',p_id::text,jsonb_build_object('revision',v.revision,'pdf_sha256',p_pdf_sha256,'teamAgreementConfirmed',true));
 return public.get_quotation_revision(p_id);
end;$$;
create function public.export_project_request(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare req jsonb; attachments jsonb;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('documents.export');
 req:=public.get_project_request(p_id);if req is null then raise exception 'Request unavailable'; end if;
 attachments:=public.list_request_attachments(p_id);
 insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'request.pdf_export_authorized','project_request',p_id::text);
 return jsonb_build_object('request',req,'attachments',attachments);
end;$$;
create function public.export_quotation(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('quotations.read');perform business_private.require_permission('documents.export');
 v:=public.get_quotation_revision(p_id);
 if v is null or v->>'state'<>'finalized' then raise exception 'Finalized document unavailable'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'quotation.pdf_export_authorized','quotation_revision',p_id::text);
 return v;
end;$$;
revoke all on function public.get_quotation_revision(uuid),public.list_request_quotations(uuid),public.create_quotation_draft(uuid,uuid),
 public.save_quotation_draft(uuid,integer,jsonb),public.finalize_quotation(uuid,integer,text,text),public.export_project_request(uuid),public.export_quotation(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.get_quotation_revision(uuid),public.list_request_quotations(uuid),public.create_quotation_draft(uuid,uuid),
 public.save_quotation_draft(uuid,integer,jsonb),public.finalize_quotation(uuid,integer,text,text),public.export_project_request(uuid),public.export_quotation(uuid) to authenticated;
