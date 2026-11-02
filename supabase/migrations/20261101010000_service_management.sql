-- Narrow caller-authorized inbox queries. No new permissions or broad grants.
create function public.find_project_request(p_reference text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform business_private.require_permission('inquiries.read');
 if p_reference is null or p_reference !~ '^BWR-[a-f0-9]{32}$' then raise exception 'Invalid reference' using errcode='22023'; end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from
 (select id,reference,service_id,full_name,status,created_at,version from business_private.project_requests where reference=p_reference)x);
end;$$;
create function public.list_request_attachments(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform business_private.require_permission('inquiries.read');
 return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) from
 (select id,request_id,display_name,mime_type,byte_size,scan_status,created_at from business_private.request_attachments where request_id=p_request_id)x);
end;$$;
revoke all on function public.find_project_request(text),public.list_request_attachments(uuid) from public,anon,authenticated,service_role;
grant execute on function public.find_project_request(text),public.list_request_attachments(uuid) to authenticated;

-- Keep the last active uncertainty choice available; staff may edit its label/order.
create function business_private.preserve_unsure_budget() returns trigger
language plpgsql set search_path='' as $$
begin
 perform 1 from public.services where id=old.service_id for update;
 if old.is_unsure and old.is_active and (not new.is_unsure or not new.is_active)
 and not exists(select from public.service_budget_options where service_id=old.service_id and id<>old.id and is_unsure and is_active) then
  raise exception 'Keep an active uncertainty budget option' using errcode='22023';
 end if;
 return new;
end;$$;
revoke all on function business_private.preserve_unsure_budget() from public,anon,authenticated,service_role;
create trigger preserve_unsure_budget before update on public.service_budget_options
 for each row execute function business_private.preserve_unsure_budget();
