begin;
create table business_private.magazine_categories(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
 name text not null check(length(btrim(name)) between 1 and 80),active boolean not null default true,sort_order integer not null default 0 check(sort_order between 0 and 9999),version integer not null default 1 check(version>0)
);
insert into business_private.magazine_categories(slug,name,sort_order) values('tech-innovation','Tech & Innovation',10),('inside-our-world','Inside Our World',20),('what-if','What If?',30),('community-stories','Community Stories',40);
create table business_private.magazine_assets(
 id uuid primary key default gen_random_uuid(),path text not null unique check(path ~ '^/magazine-media/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|avif)$'),
 alt text not null check(length(btrim(alt)) between 1 and 240),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 rights_reference text not null check(length(btrim(rights_reference)) between 1 and 240),approved boolean not null default false
);
create table business_private.magazine_articles(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
 draft jsonb not null,version integer not null default 1 check(version>0),published_revision_id uuid,
 featured boolean not null default false,first_published_at timestamptz,updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 check(not featured or published_revision_id is not null)
);
create unique index magazine_one_featured on business_private.magazine_articles(featured) where featured;
create table business_private.magazine_revisions(
 id uuid primary key default gen_random_uuid(),article_id uuid not null references business_private.magazine_articles(id) on delete restrict,
 revision integer not null check(revision>0),snapshot jsonb not null,published_at timestamptz not null default now(),
 unique(article_id,revision),unique(article_id,id)
);
alter table business_private.magazine_articles add constraint magazine_own_published_revision foreign key(id,published_revision_id) references business_private.magazine_revisions(article_id,id) on delete restrict;
create function business_private.magazine_revision_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Published revisions cannot be overwritten' using errcode='42501';end;$$;
create trigger magazine_revision_immutable before update on business_private.magazine_revisions for each row execute function business_private.magazine_revision_immutable();
revoke all on business_private.magazine_categories,business_private.magazine_assets,business_private.magazine_articles,business_private.magazine_revisions from public,anon,authenticated,service_role;
alter table business_private.magazine_categories enable row level security;
alter table business_private.magazine_assets enable row level security;
alter table business_private.magazine_articles enable row level security;
alter table business_private.magazine_revisions enable row level security;
create policy magazine_categories_mfa on business_private.magazine_categories as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy magazine_assets_mfa on business_private.magazine_assets as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy magazine_articles_mfa on business_private.magazine_articles as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy magazine_revisions_mfa on business_private.magazine_revisions as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

-- A small structured document language, never arbitrary HTML, CSS, SVG or embeds.
create function business_private.valid_magazine_document(d jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare b jsonb;k text;v text;
begin
 if d is null or jsonb_typeof(d)<>'object' or not(d ?& array['title','summary','author','categoryId','coverId','body']) or (d-array['title','summary','author','categoryId','coverId','body'])<>'{}' or pg_column_size(d)>100000 then return false;end if;
 foreach k in array array['title','summary','author'] loop
  if jsonb_typeof(d->k)<>'string' or not business_private.project_text(d->>k,1,case k when 'title' then 180 when 'summary' then 500 else 120 end) then return false;end if;
 end loop;
 if jsonb_typeof(d->'categoryId')<>'string' or not exists(select from business_private.magazine_categories where id=(d->>'categoryId')::uuid) then return false;end if;
 if d->'coverId'<>'null'::jsonb and (jsonb_typeof(d->'coverId')<>'string' or not exists(select from business_private.magazine_assets where id=(d->>'coverId')::uuid and approved)) then return false;end if;
 if jsonb_typeof(d->'body')<>'array' or jsonb_array_length(d->'body') not between 1 and 80 then return false;end if;
 for b in select * from jsonb_array_elements(d->'body') loop
  if jsonb_typeof(b)<>'object' or not b ? 'type' or jsonb_typeof(b->'type')<>'string' then return false;end if;
  case b->>'type'
  when 'paragraph','heading' then
   if not b ? 'text' or jsonb_typeof(b->'text')<>'string' or not business_private.project_text(b->>'text',1,case when b->>'type'='heading' then 240 else 4000 end) then return false;end if;
   if b->>'type'='heading' then if (b-array['type','text','level'])<>'{}' or b->'level' is null or b->'level' not in ('2'::jsonb,'3'::jsonb) then return false;end if;
   elsif (b-array['type','text'])<>'{}' then return false;end if;
  when 'list' then
   if (b-array['type','items','ordered'])<>'{}' or jsonb_typeof(b->'ordered') is distinct from 'boolean' or jsonb_typeof(b->'items') is distinct from 'array' or jsonb_array_length(b->'items') not between 1 and 30 then return false;end if;
   for v in select value#>>'{}' from jsonb_array_elements(b->'items') where jsonb_typeof(value)='string' loop if not business_private.project_text(v,1,1000) then return false;end if;end loop;
   if exists(select from jsonb_array_elements(b->'items') where jsonb_typeof(value)<>'string') then return false;end if;
  when 'link' then
   if (b-array['type','text','href'])<>'{}' or jsonb_typeof(b->'text') is distinct from 'string' or not business_private.project_text(b->>'text',1,240) or jsonb_typeof(b->'href') is distinct from 'string' or length(b->>'href')>2048 or b->>'href' !~ '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}([/?#][^[:space:]<>]*)?$' then return false;end if;
  when 'image' then
   if (b-array['type','assetId','caption'])<>'{}' or jsonb_typeof(b->'assetId') is distinct from 'string' or not exists(select from business_private.magazine_assets where id=(b->>'assetId')::uuid and approved) or jsonb_typeof(b->'caption') is distinct from 'string' or not business_private.project_text(b->>'caption',0,400) then return false;end if;
  else return false;
  end case;
 end loop;return true;
 exception when invalid_text_representation or invalid_parameter_value then return false;
end;$$;

create function public.list_magazine_categories(p_staff boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if p_staff then perform business_private.require_permission('content.read');end if;
 return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'name',name,'active',active,'sortOrder',sort_order)||case when p_staff then jsonb_build_object('version',version) else '{}'::jsonb end order by sort_order,name,id),'[]'::jsonb) from business_private.magazine_categories where active or p_staff);end;$$;
create function public.list_magazine_assets() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform business_private.require_permission('content.read');return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',path,'alt',alt) order by path),'[]'::jsonb) from business_private.magazine_assets where approved);end;$$;
create function business_private.magazine_public_json(a business_private.magazine_articles,r business_private.magazine_revisions) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',a.id,'slug',a.slug,'title',r.snapshot->>'title','summary',r.snapshot->>'summary','author',r.snapshot->>'author','body',r.snapshot->'body',
 'category',(select jsonb_build_object('id',id,'slug',slug,'name',name) from business_private.magazine_categories where id=(r.snapshot->>'categoryId')::uuid),
 'coverId',r.snapshot->'coverId','assets',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path,'alt',m.alt) order by m.id),'[]'::jsonb) from business_private.magazine_assets m where m.approved and (m.id::text=r.snapshot->>'coverId' or exists(select from jsonb_array_elements(r.snapshot->'body')b where b->>'assetId'=m.id::text))),
 'featured',a.featured,'publishedAt',a.first_published_at,'updatedAt',r.published_at);$$;
create function public.list_published_magazine(p_category text default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(business_private.magazine_public_json(a,r) order by a.featured desc,a.first_published_at desc,a.id),'[]'::jsonb)
 from business_private.magazine_articles a join business_private.magazine_revisions r on r.id=a.published_revision_id and r.article_id=a.id
 join business_private.magazine_categories c on c.id=(r.snapshot->>'categoryId')::uuid
 where c.active and a.first_published_at<=now() and r.published_at<=now() and (p_category is null or c.slug=p_category);$$;
create function public.get_published_magazine(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select business_private.magazine_public_json(a,r) from business_private.magazine_articles a join business_private.magazine_revisions r on r.id=a.published_revision_id and r.article_id=a.id join business_private.magazine_categories c on c.id=(r.snapshot->>'categoryId')::uuid where a.slug=p_slug and c.active and a.first_published_at<=now() and r.published_at<=now();$$;
create function public.get_staff_magazine(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a business_private.magazine_articles;
begin perform business_private.require_permission('content.read');select * into a from business_private.magazine_articles where id=p_id;if not found then raise exception 'Article unavailable';end if;
 return jsonb_build_object('id',a.id,'slug',a.slug,'draft',a.draft,'version',a.version,'published',a.published_revision_id is not null,'featured',a.featured,'updatedAt',a.updated_at,
 'revisions',(select coalesce(jsonb_agg(jsonb_build_object('revision',r.revision,'publishedAt',r.published_at) order by r.revision desc),'[]'::jsonb) from business_private.magazine_revisions r where article_id=a.id));end;$$;
create function public.list_staff_magazine() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform business_private.require_permission('content.read');return(select coalesce(jsonb_agg(public.get_staff_magazine(id) order by updated_at desc,id),'[]'::jsonb) from business_private.magazine_articles);end;$$;
create function public.save_magazine_category(p_id uuid,p_version integer,p_name text,p_slug text,p_active boolean,p_sort integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('content.read');perform business_private.require_permission('content.update');perform business_private.require_permission('content.publish');
 if not business_private.project_text(p_name,1,80) or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>80 or p_active is null or p_sort is null or p_sort not between 0 and 9999 then raise exception 'Invalid category' using errcode='22023';end if;
 if p_id is null then perform business_private.require_permission('content.create');if p_version is distinct from 0 then raise exception 'Category changed' using errcode='PT409';end if;insert into business_private.magazine_categories(name,slug,active,sort_order)values(p_name,p_slug,p_active,p_sort)returning id into target;
 else update business_private.magazine_categories set name=p_name,active=p_active,sort_order=p_sort,version=version+1 where id=p_id and version=p_version and slug=p_slug returning id into target;if not found then raise exception 'Category changed' using errcode='PT409';end if;end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)values(auth.uid(),'magazine.category_saved','magazine_category',target::text,jsonb_build_object('active',p_active));return public.list_magazine_categories(true);
 exception when unique_violation then raise exception 'Category slug unavailable' using errcode='PT409';end;$$;
create function public.save_magazine_draft(p_id uuid,p_version integer,p_slug text,p_document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('content.read');
 if p_slug is null or length(p_slug)>80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or not business_private.valid_magazine_document(p_document) then raise exception 'Invalid article document' using errcode='22023';end if;
 if p_id is null then perform business_private.require_permission('content.create');if p_version is distinct from 0 then raise exception 'Article changed' using errcode='PT409';end if;insert into business_private.magazine_articles(slug,draft)values(p_slug,p_document)returning id into target;
 else perform business_private.require_permission('content.update');update business_private.magazine_articles set draft=p_document,version=version+1,updated_at=now() where id=p_id and version=p_version and slug=p_slug returning id into target;if not found then raise exception 'Article changed or slug is immutable' using errcode='PT409';end if;end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'magazine.draft_saved','magazine_article',target::text);return public.get_staff_magazine(target);
 exception when unique_violation then raise exception 'Article slug unavailable' using errcode='PT409';end;$$;
create function public.publish_magazine(p_id uuid,p_version integer,p_publish boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a business_private.magazine_articles;target uuid;n integer;
begin perform business_private.require_permission('content.read');perform business_private.require_permission('content.publish');
 perform pg_advisory_xact_lock(42044,1);select * into a from business_private.magazine_articles where id=p_id for update;if not found or a.version is distinct from p_version then raise exception 'Article changed' using errcode='PT409';end if;
 if p_publish is null then raise exception 'Invalid publication' using errcode='22023';end if;
 if p_publish then
  if not business_private.valid_magazine_document(a.draft) or not exists(select from business_private.magazine_categories where id=(a.draft->>'categoryId')::uuid and active) then raise exception 'Complete approved document before publication' using errcode='22023';end if;
  select coalesce(max(revision),0)+1 into n from business_private.magazine_revisions where article_id=p_id;
  insert into business_private.magazine_revisions(article_id,revision,snapshot)values(p_id,n,a.draft)returning id into target;
 end if;
 update business_private.magazine_articles set published_revision_id=target,featured=case when p_publish then featured else false end,first_published_at=case when p_publish then coalesce(first_published_at,now()) else first_published_at end,version=version+1,updated_at=now() where id=p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)values(auth.uid(),'magazine.publication_changed','magazine_article',p_id::text,jsonb_build_object('published',p_publish,'revision',n));return public.get_staff_magazine(p_id);end;$$;
create function public.feature_magazine(p_id uuid,p_version integer,p_featured boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a business_private.magazine_articles;
begin perform business_private.require_permission('content.read');perform business_private.require_permission('content.publish');perform pg_advisory_xact_lock(42044,1);
 select * into a from business_private.magazine_articles where id=p_id for update;if not found or a.version is distinct from p_version then raise exception 'Article changed' using errcode='PT409';end if;
 if p_featured is null or (p_featured and public.get_published_magazine(a.slug) is null) then raise exception 'Only public articles can be featured' using errcode='22023';end if;
 -- One featured story. Replacing it bumps the displaced article's concurrency version too.
 if p_featured then
  insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)select auth.uid(),'magazine.feature_changed','magazine_article',id::text,jsonb_build_object('featured',false) from business_private.magazine_articles where featured and id<>p_id;
  update business_private.magazine_articles set featured=false,version=version+1,updated_at=now() where featured and id<>p_id;
 end if;
 update business_private.magazine_articles set featured=p_featured,version=version+1,updated_at=now() where id=p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata)values(auth.uid(),'magazine.feature_changed','magazine_article',p_id::text,jsonb_build_object('featured',p_featured));return public.get_staff_magazine(p_id);end;$$;

revoke all on function business_private.magazine_revision_immutable(),business_private.valid_magazine_document(jsonb),business_private.magazine_public_json(business_private.magazine_articles,business_private.magazine_revisions) from public,anon,authenticated,service_role;
revoke all on function public.list_magazine_categories(boolean),public.list_published_magazine(text),public.get_published_magazine(text) from public,anon,authenticated,service_role;
grant execute on function public.list_magazine_categories(boolean),public.list_published_magazine(text),public.get_published_magazine(text) to anon,authenticated;
revoke all on function public.list_magazine_assets(),public.get_staff_magazine(uuid),public.list_staff_magazine(),public.save_magazine_category(uuid,integer,text,text,boolean,integer),public.save_magazine_draft(uuid,integer,text,jsonb),public.publish_magazine(uuid,integer,boolean),public.feature_magazine(uuid,integer,boolean) from public,anon,authenticated,service_role;
grant execute on function public.list_magazine_assets(),public.get_staff_magazine(uuid),public.list_staff_magazine(),public.save_magazine_category(uuid,integer,text,text,boolean,integer),public.save_magazine_draft(uuid,integer,text,jsonb),public.publish_magazine(uuid,integer,boolean),public.feature_magazine(uuid,integer,boolean) to authenticated;
commit;
