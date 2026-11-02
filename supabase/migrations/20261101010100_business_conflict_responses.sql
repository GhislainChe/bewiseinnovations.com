-- Stale optimistic versions are application conflicts, not serialization failures.
-- PT409 prevents PostgREST 14 from endlessly retrying deliberate 40001 exceptions.
-- All authorization, version predicates, locking, audit, signatures and grants stay intact.
create or replace function public.save_service(p_id uuid,p_version integer,p_slug text,p_title text,p_description text,p_status text,p_accepting boolean)
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
  if not found then raise exception 'Stale service version' using errcode='PT409'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'service.saved','service',v.id::text,jsonb_build_object('version',v.version,'status',v.status));
 return to_jsonb(v);
end;$$;

create or replace function public.save_service_budget(p_id uuid,p_version integer,p_service_id uuid,p_label text,p_currency text,
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
  if not found then raise exception 'Stale budget version' using errcode='PT409'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'service.budget_saved','service_budget',v.id::text,jsonb_build_object('version',v.version));
 return to_jsonb(v);
end;$$;

create or replace function public.set_project_request_status(p_id uuid,p_version integer,p_status text) returns jsonb
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
 if not found then raise exception 'Stale request version' using errcode='PT409'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'request.status_changed','project_request',p_id::text,jsonb_build_object('from',old_status,'to',p_status,'version',v.version));
 return to_jsonb(v)-'idempotency_hash'-'payload_hash';
end;$$;
