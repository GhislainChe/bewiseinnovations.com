begin;
-- Approval is explicit in the verified Operations release, never inferred from a PDF.
alter table business_private.project_requests drop constraint project_requests_status_check;
alter table business_private.project_requests add constraint project_requests_status_check check(status in ('received','triaging','discussing','approved','declined','cancelled','closed'));
insert into public.permissions(code,description) values
 ('company.overview.read','Read sanitized company project summaries'),
 ('projects.read','Read approved project technical and operational records'),
 ('projects.manage','Maintain projects and ordered milestones'),
 ('projects.notify','Confirm client-safe milestone notification preparation');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p where
 (p.code='company.overview.read' and r.code in ('platform_owner','technical_lead','operations_lead','content_community_lead')) or
 (p.code='projects.read' and r.code in ('platform_owner','technical_lead','operations_lead')) or
 (p.code in ('projects.manage','projects.notify') and r.code in ('platform_owner','technical_lead'));

create table business_private.project_intakes (
 request_id uuid primary key references business_private.project_requests(id) on delete restrict,
 request_version integer not null,version integer not null default 1 check(version>0),active boolean not null default true,
 approved_scope text not null check(length(approved_scope) between 1 and 6000),
 contact_email text not null,verification_evidence text not null check(length(verification_evidence) between 1 and 1000),
 agreement_reference text not null check(length(agreement_reference) between 1 and 500),
 verified_by uuid references public.team_profiles(id) on delete set null,verified_at timestamptz not null default now()
);
create table business_private.projects (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('internal','client')),
 request_id uuid unique references business_private.project_intakes(request_id) on delete restrict,
 name text not null check(length(name) between 1 and 160),description text not null default '' check(length(description)<=6000),
 status text not null default 'planned' check(status in ('planned','active','on_hold','completed','cancelled')),
 starts_on date,ends_on date,version integer not null default 1 check(version>0),
 created_by uuid references public.team_profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((kind='internal' and request_id is null) or (kind='client' and request_id is not null)),check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
create table business_private.project_milestones (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references business_private.projects(id) on delete restrict,
 title text not null check(length(title) between 1 and 200),internal_notes text not null default '' check(length(internal_notes)<=3000),
 client_summary text not null default '' check(length(client_summary)<=2000),
 state text not null default 'pending' check(state in ('pending','in_progress','completed','excluded')),
 exclusion_reason text not null default '' check(length(exclusion_reason)<=1000),
 position integer not null check(position between 1 and 100),version integer not null default 1 check(version>0),
 completed_at timestamptz,completed_by uuid references public.team_profiles(id) on delete set null,
 check(state<>'excluded' or length(btrim(exclusion_reason))>0),check((state='completed')=(completed_at is not null))
);
create index project_milestones_order on business_private.project_milestones(project_id,position,id);
create table business_private.project_notification_intents (
 id uuid primary key default gen_random_uuid(),milestone_id uuid not null unique references business_private.project_milestones(id) on delete restrict,
 project_id uuid not null references business_private.projects(id) on delete restrict,
 request_id uuid not null references business_private.project_intakes(request_id) on delete restrict,
 contact_version integer not null,recipient text not null,client_summary text not null,
 completed_count integer not null,total_count integer not null,progress integer not null,
 milestone_version integer not null,status text not null default 'PREPARED' check(status='PREPARED'),
 confirmed_by uuid references public.team_profiles(id) on delete set null,created_at timestamptz not null default now()
);
-- Personal contact/evidence/outbox payloads have no direct API-role grants.
revoke all on business_private.project_intakes,business_private.projects,business_private.project_milestones,business_private.project_notification_intents from public,anon,authenticated,service_role;
grant select on business_private.projects,business_private.project_milestones to authenticated;
alter table business_private.project_intakes enable row level security;
alter table business_private.projects enable row level security;
alter table business_private.project_milestones enable row level security;
alter table business_private.project_notification_intents enable row level security;
create policy projects_read on business_private.projects for select to authenticated using((select app_private.has_permission('projects.read')));
create policy milestones_read on business_private.project_milestones for select to authenticated using((select app_private.has_permission('projects.read')));
create policy projects_mfa on business_private.projects as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy milestones_mfa on business_private.project_milestones as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy intakes_mfa on business_private.project_intakes as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy intents_mfa on business_private.project_notification_intents as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

create function business_private.project_text(v text,lo integer,hi integer) returns boolean language sql immutable set search_path='' as $$
 select v is not null and length(btrim(v))>=lo and length(v)<=hi and v !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]';$$;
create function business_private.project_progress(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('completed',count(*) filter(where state='completed'),'total',count(*) filter(where state<>'excluded'),
 'percent',case when count(*) filter(where state<>'excluded')=0 then null else round(100.0*(count(*) filter(where state='completed'))/(count(*) filter(where state<>'excluded')))::integer end)
 from business_private.project_milestones where project_id=p_id;$$;
create function business_private.check_project_contact(p_id uuid) returns business_private.project_intakes language plpgsql set search_path='' as $$
 declare i business_private.project_intakes; r business_private.project_requests;
 begin
 select * into r from business_private.project_requests where id=p_id for share;
 select * into i from business_private.project_intakes where request_id=p_id for share;
 if i.request_id is null or r.status<>'approved' or not i.active or i.request_version<>r.version or i.contact_email is distinct from lower(btrim(r.email)) then raise exception 'Approved verified project intake required' using errcode='22023';end if;
 return i;
 end;$$;
create function business_private.project_audit(p_action text,p_id uuid,p_metadata jsonb) returns void language sql set search_path='' as $$
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),p_action,'project',p_id::text,p_metadata);$$;

create function public.release_project_intake(p_request_id uuid,p_request_version integer,p_release_version integer,p_scope text,p_evidence text,p_agreement text,p_attested boolean,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r business_private.project_requests;i business_private.project_intakes;
 begin
 perform business_private.require_permission('inquiries.read');perform business_private.require_permission('inquiries.manage');
 select * into r from business_private.project_requests where id=p_request_id for update;
 if not found or p_request_version is distinct from r.version then raise exception 'Request changed' using errcode='PT409';end if;
 select * into i from business_private.project_intakes where request_id=p_request_id;
 if coalesce(i.version,0) is distinct from p_release_version then raise exception 'Release changed' using errcode='PT409';end if;
 if p_active is null or (p_active and (r.status not in ('discussing','approved') or p_attested is distinct from true
 or not business_private.project_text(p_scope,1,6000) or not business_private.project_text(p_evidence,1,1000) or not business_private.project_text(p_agreement,1,500)
 or r.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then raise exception 'Verify contact and agreement before release' using errcode='22023';end if;
 if not p_active and i.request_id is null then raise exception 'No release exists' using errcode='22023';end if;
 if p_active then
 if r.status<>'approved' then
 update business_private.project_requests set status='approved',version=version+1,updated_at=now() where id=r.id returning * into r;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'request.status_changed','project_request',r.id::text,jsonb_build_object('from','discussing','to','approved','version',r.version));
 end if;
 insert into business_private.project_intakes(request_id,request_version,approved_scope,contact_email,verification_evidence,agreement_reference,verified_by)
 values(r.id,r.version,p_scope,lower(btrim(r.email)),p_evidence,p_agreement,auth.uid())
 on conflict(request_id) do update set request_version=excluded.request_version,approved_scope=excluded.approved_scope,contact_email=excluded.contact_email,
 verification_evidence=excluded.verification_evidence,agreement_reference=excluded.agreement_reference,verified_by=excluded.verified_by,verified_at=now(),active=true,version=business_private.project_intakes.version+1;
 else update business_private.project_intakes set active=false,version=version+1 where request_id=p_request_id;end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'project.intake_released','project_request',r.id::text,jsonb_build_object('active',p_active,'contactAttested',p_active));
 return public.get_project_intake(r.id);
 end;$$;
create function public.get_project_intake(p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin perform business_private.require_permission('inquiries.read');perform business_private.require_permission('inquiries.manage');
 return (select to_jsonb(i) from business_private.project_intakes i where request_id=p_request_id);end;$$;
create function public.list_project_intakes() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin perform business_private.require_permission('projects.manage');
 return (select coalesce(jsonb_agg(jsonb_build_object('requestId',i.request_id,'reference',r.reference,'scope',i.approved_scope) order by i.verified_at desc),'[]'::jsonb)
 from business_private.project_intakes i join business_private.project_requests r on r.id=i.request_id where i.active and r.status='approved' and i.request_version=r.version and i.contact_email=lower(btrim(r.email)) and not exists(select from business_private.projects p where p.request_id=i.request_id));end;$$;

create function public.get_staff_project(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare p business_private.projects;
 begin perform business_private.require_permission('projects.read');select * into p from business_private.projects where id=p_id;
 if not found then raise exception 'Project unavailable';end if;
 return to_jsonb(p)||jsonb_build_object('progress',business_private.project_progress(p.id),
 'approved_scope',(select approved_scope from business_private.project_intakes where request_id=p.request_id),
 'milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.position,m.id),'[]'::jsonb) from business_private.project_milestones m where m.project_id=p.id),
 'notifications',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'milestoneId',n.milestone_id,'status',n.status,'summary',n.client_summary,'progress',n.progress,'createdAt',n.created_at) order by n.created_at desc),'[]'::jsonb) from business_private.project_notification_intents n where n.project_id=p.id));end;$$;
create function public.list_staff_projects() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin perform business_private.require_permission('projects.read');
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'name',p.name,'status',p.status,'progress',business_private.project_progress(p.id),'updates',(select count(*) from business_private.project_notification_intents n where n.project_id=p.id)) order by p.created_at desc,p.id),'[]'::jsonb) from business_private.projects p);end;$$;
create function public.company_project_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin perform business_private.require_permission('company.overview.read');
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'name',case when p.kind='client' then 'Client project' else p.name end,'status',p.status,'progress',business_private.project_progress(p.id)) order by p.created_at desc,p.id),'[]'::jsonb) from business_private.projects p);end;$$;

create function public.save_staff_project(p_id uuid,p_version integer,p_kind text,p_request_id uuid,p_name text,p_description text,p_status text,p_starts_on date,p_ends_on date) returns jsonb language plpgsql security definer set search_path='' as $$
 declare p business_private.projects;new_id uuid;
 begin perform business_private.require_permission('projects.read');perform business_private.require_permission('projects.manage');
 if p_kind is null or p_kind not in ('internal','client') or p_status is null or p_status not in ('planned','active','on_hold','completed','cancelled')
 or not business_private.project_text(p_name,1,160) or not business_private.project_text(p_description,0,6000) or (p_ends_on is not null and p_starts_on is not null and p_ends_on<p_starts_on)
 or ((p_kind='internal')<>(p_request_id is null)) then raise exception 'Invalid project' using errcode='22023';end if;
 if p_id is null then
 if p_version is distinct from 0 then raise exception 'Project changed' using errcode='PT409';end if;
 if p_kind='client' then perform business_private.check_project_contact(p_request_id);end if;
 insert into business_private.projects(kind,request_id,name,description,status,starts_on,ends_on,created_by) values(p_kind,p_request_id,p_name,p_description,p_status,p_starts_on,p_ends_on,auth.uid()) returning id into new_id;
 else
 select * into p from business_private.projects where id=p_id for update;
 if not found or p.version is distinct from p_version or p.kind is distinct from p_kind or p.request_id is distinct from p_request_id then raise exception 'Project changed' using errcode='PT409';end if;
 update business_private.projects set name=p_name,description=p_description,status=p_status,starts_on=p_starts_on,ends_on=p_ends_on,version=version+1,updated_at=now() where id=p_id;new_id:=p_id;
 end if;
 perform business_private.project_audit('project.saved',new_id,jsonb_build_object('kind',p_kind,'created',p_id is null));
 return public.get_staff_project(new_id);
 exception when unique_violation then raise exception 'Request already has a project' using errcode='PT409';end;$$;

create function public.save_project_milestone(p_project_id uuid,p_version integer,p_id uuid,p_title text,p_notes text,p_client_summary text,p_state text,p_exclusion_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare p business_private.projects;m business_private.project_milestones;pos integer;
 begin perform business_private.require_permission('projects.read');perform business_private.require_permission('projects.manage');
 select * into p from business_private.projects where id=p_project_id for update;
 if not found or p.version is distinct from p_version then raise exception 'Project changed' using errcode='PT409';end if;
 if not business_private.project_text(p_title,1,200) or not business_private.project_text(p_notes,0,3000) or not business_private.project_text(p_client_summary,0,2000)
 or not business_private.project_text(p_exclusion_reason,0,1000) or p_state is null or p_state not in ('pending','in_progress','completed','excluded')
 or (p_state='excluded' and length(btrim(p_exclusion_reason))=0) then raise exception 'Invalid milestone' using errcode='22023';end if;
 if p_id is null then
 select count(*)+1 into pos from business_private.project_milestones where project_id=p_project_id;
 if pos>100 then raise exception 'Milestone limit reached' using errcode='22023';end if;
 insert into business_private.project_milestones(project_id,title,internal_notes,client_summary,state,exclusion_reason,position,completed_at,completed_by)
 values(p_project_id,p_title,p_notes,p_client_summary,p_state,p_exclusion_reason,pos,case when p_state='completed' then now() end,case when p_state='completed' then auth.uid() end) returning id into m.id;
 else
 select * into m from business_private.project_milestones where id=p_id and project_id=p_project_id;
 if not found then raise exception 'Milestone unavailable' using errcode='22023';end if;
 update business_private.project_milestones set title=p_title,internal_notes=p_notes,client_summary=p_client_summary,state=p_state,exclusion_reason=p_exclusion_reason,version=version+1,
 completed_at=case when p_state='completed' then coalesce(m.completed_at,now()) end,completed_by=case when p_state='completed' then coalesce(m.completed_by,auth.uid()) end where id=p_id;
 end if;
 update business_private.projects set version=version+1,updated_at=now() where id=p_project_id;
 perform business_private.project_audit('project.milestone_saved',p_project_id,jsonb_build_object('milestone_id',m.id,'state',p_state));return public.get_staff_project(p_project_id);end;$$;
create function public.reorder_project_milestones(p_project_id uuid,p_version integer,p_ids uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
 declare p business_private.projects;
 begin perform business_private.require_permission('projects.read');perform business_private.require_permission('projects.manage');
 select * into p from business_private.projects where id=p_project_id for update;
 if not found or p.version is distinct from p_version then raise exception 'Project changed' using errcode='PT409';end if;
 if p_ids is null or cardinality(p_ids)<>(select count(*) from business_private.project_milestones where project_id=p_project_id)
 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids)x)
 or exists(select from unnest(p_ids)x where x is null or not exists(select from business_private.project_milestones where id=x and project_id=p_project_id)) then raise exception 'Exact milestone order required' using errcode='22023';end if;
 update business_private.project_milestones m set position=o.n,version=m.version+1 from unnest(p_ids) with ordinality o(id,n) where m.id=o.id and m.project_id=p_project_id;
 update business_private.projects set version=version+1,updated_at=now() where id=p_project_id;
 perform business_private.project_audit('project.milestones_reordered',p_project_id,'{}');return public.get_staff_project(p_project_id);end;$$;
create function public.prepare_project_progress(p_project_id uuid,p_version integer,p_milestone_id uuid,p_attested boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare p business_private.projects;m business_private.project_milestones;i business_private.project_intakes;stats jsonb;nid uuid;
 begin perform business_private.require_permission('projects.read');perform business_private.require_permission('projects.manage');perform business_private.require_permission('projects.notify');
 select * into p from business_private.projects where id=p_project_id for update;
 if not found or p.kind<>'client' or p.status='cancelled' or p_attested is distinct from true then raise exception 'Confirmed client milestone required' using errcode='22023';end if;
 select * into m from business_private.project_milestones where id=p_milestone_id and project_id=p_project_id;
 if not found or m.state<>'completed' or length(btrim(m.client_summary))=0 then raise exception 'Completed client-safe milestone required' using errcode='22023';end if;
 i:=business_private.check_project_contact(p.request_id);
 if exists(select from business_private.project_notification_intents where milestone_id=m.id) then return public.get_staff_project(p_project_id);end if;
 if p.version is distinct from p_version then raise exception 'Project changed' using errcode='PT409';end if;
 stats:=business_private.project_progress(p.id);
 insert into business_private.project_notification_intents(milestone_id,project_id,request_id,contact_version,recipient,client_summary,completed_count,total_count,progress,milestone_version,confirmed_by)
 values(m.id,p.id,p.request_id,i.version,i.contact_email,m.client_summary,(stats->>'completed')::integer,(stats->>'total')::integer,(stats->>'percent')::integer,m.version,auth.uid()) returning id into nid;
 update business_private.projects set version=version+1,updated_at=now() where id=p.id;
 perform business_private.project_audit('project.progress_prepared',p.id,jsonb_build_object('milestone_id',m.id,'intent_id',nid,'emailSendingEnabled',false,'operationsActivity',true));
 return public.get_staff_project(p.id);end;$$;

-- Empty search paths, fixed commands and explicit caller permissions; no generic CRUD.
revoke all on function business_private.project_text(text,integer,integer),business_private.project_progress(uuid),business_private.check_project_contact(uuid),business_private.project_audit(text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.release_project_intake(uuid,integer,integer,text,text,text,boolean,boolean),public.get_project_intake(uuid),public.list_project_intakes(),public.get_staff_project(uuid),public.list_staff_projects(),public.company_project_overview(),public.save_staff_project(uuid,integer,text,uuid,text,text,text,date,date),public.save_project_milestone(uuid,integer,uuid,text,text,text,text,text),public.reorder_project_milestones(uuid,integer,uuid[]),public.prepare_project_progress(uuid,integer,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.release_project_intake(uuid,integer,integer,text,text,text,boolean,boolean),public.get_project_intake(uuid),public.list_project_intakes(),public.get_staff_project(uuid),public.list_staff_projects(),public.company_project_overview(),public.save_staff_project(uuid,integer,text,uuid,text,text,text,date,date),public.save_project_milestone(uuid,integer,uuid,text,text,text,text,text),public.reorder_project_milestones(uuid,integer,uuid[]),public.prepare_project_progress(uuid,integer,uuid,boolean) to authenticated;
create or replace function public.set_project_request_status(p_id uuid,p_version integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_status text; v business_private.project_requests;
begin
 perform business_private.require_permission('inquiries.manage');
 select status into old_status from business_private.project_requests where id=p_id for update;
 if not found then raise exception 'Request unavailable'; end if;
 if not ((old_status='received' and p_status in ('triaging','declined','cancelled'))
  or (old_status='triaging' and p_status in ('discussing','declined','cancelled'))
  or (old_status in ('discussing','approved') and p_status in ('declined','cancelled','closed'))) then raise exception 'Invalid transition' using errcode='22023'; end if;
 update business_private.project_requests set status=p_status,version=version+1,updated_at=now()
 where id=p_id and version=p_version returning * into v;
 if not found then raise exception 'Stale request version' using errcode='PT409'; end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),'request.status_changed','project_request',p_id::text,jsonb_build_object('from',old_status,'to',p_status,'version',v.version));
 return to_jsonb(v)-'idempotency_hash'-'payload_hash';
end;$$;
commit;
