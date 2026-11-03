begin;
insert into public.permissions(code,description) values
 ('products.manage','Create product identities and manage strategic product settings'),
 ('products.technical.manage','Maintain technical product information and development status');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p
 where (p.code='products.manage' and r.code='platform_owner') or (p.code='products.technical.manage' and r.code in ('platform_owner','technical_lead'));
create table business_private.product_assets(
 id uuid primary key default gen_random_uuid(),asset_key text not null unique,
 path text not null unique check(path ~ '^/product-media/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|avif)$'),
 alt text not null check(length(alt) between 1 and 240),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 approved boolean not null default false
);
create table business_private.products(
 id uuid primary key default gen_random_uuid(),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
 name text not null check(length(btrim(name)) between 1 and 160),category text not null check(length(btrim(category)) between 1 and 80),
 short_description text not null default '' check(length(short_description)<=400),description text not null default '' check(length(description)<=10000),
 features jsonb not null default '[]' check(jsonb_typeof(features)='array' and jsonb_array_length(features)<=20),
 cover_asset_id uuid references business_private.product_assets(id) on delete restrict,media_ids uuid[] not null default '{}' check(cardinality(media_ids)<=8),
 development_status text not null default 'concept' check(development_status in ('concept','in_development','coming_soon','launched')),
 technical_summary text not null default '' check(length(technical_summary)<=4000),
 publication text not null default 'draft' check(publication in ('draft','published')),
 visibility text not null default 'private' check(visibility in ('private','public')),published_at timestamptz,
 external_url text,waitlist_enabled boolean not null default false,
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(publication<>'published' or published_at is not null)
);
create index products_publication_idx on business_private.products(publication,visibility,published_at);
create table business_private.product_waitlist_entries(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references business_private.products(id) on delete restrict,
 identity_hash bytea not null check(octet_length(identity_hash)=32),idempotency_hash bytea not null unique check(octet_length(idempotency_hash)=32),
 payload_hash bytea not null check(octet_length(payload_hash)=32),withdrawal_hash bytea unique check(withdrawal_hash is null or octet_length(withdrawal_hash)=32),
 full_name text,email text,whatsapp text,
 consent_version text not null check(consent_version='product-updates-v1'),consented_at timestamptz not null default now(),
 status text not null default 'active' check(status in ('active','withdrawn')),withdrawn_at timestamptz,
 created_at timestamptz not null default now(),unique(product_id,identity_hash),
 check((status='active' and full_name is not null and email is not null and withdrawal_hash is not null and withdrawn_at is null)
 or (status='withdrawn' and full_name is null and email is null and whatsapp is null and withdrawal_hash is null and withdrawn_at is not null))
);
create index waitlist_product_status_idx on business_private.product_waitlist_entries(product_id,status,created_at desc);
create table business_private.product_waitlist_buckets(
 scope text not null check(scope in ('join_global','join_email','join_product','withdraw_global','withdraw_token')),
 key_hash bytea not null check(octet_length(key_hash)=32),window_start timestamptz not null,attempts integer not null check(attempts>0),
 primary key(scope,key_hash,window_start)
);
revoke all on business_private.products,business_private.product_assets,business_private.product_waitlist_entries,business_private.product_waitlist_buckets from public,anon,authenticated,service_role;
alter table business_private.products enable row level security;
alter table business_private.product_assets enable row level security;
alter table business_private.product_waitlist_entries enable row level security;
alter table business_private.product_waitlist_buckets enable row level security;
-- No direct reads/writes: narrow functions project each audience's allowed fields.
create policy products_mfa on business_private.products as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy product_assets_mfa on business_private.product_assets as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));
create policy product_waitlists_mfa on business_private.product_waitlist_entries as restrictive for all to authenticated using((select app_private.has_aal2_session())) with check((select app_private.has_aal2_session()));

create function business_private.require_product_reader() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not app_private.has_aal2_session() or not (app_private.has_permission('content.read') or app_private.has_permission('products.technical.manage') or app_private.has_permission('waitlists.read')) then raise exception 'Access denied' using errcode='42501';end if;
end;$$;
create function business_private.product_public_json(p business_private.products) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'category',p.category,'shortDescription',p.short_description,'description',p.description,
 'features',p.features,'developmentStatus',p.development_status,'publishedAt',p.published_at,'externalUrl',p.external_url,'waitlistEnabled',p.waitlist_enabled,
 'cover',(select jsonb_build_object('id',a.id,'path',a.path,'alt',a.alt) from business_private.product_assets a where a.id=p.cover_asset_id and a.approved),
 'media',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'path',a.path,'alt',a.alt) order by o.n),'[]'::jsonb) from unnest(p.media_ids) with ordinality o(id,n) join business_private.product_assets a on a.id=o.id and a.approved));$$;
create function public.list_published_products() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(business_private.product_public_json(p) order by p.published_at desc,p.id),'[]'::jsonb) from business_private.products p where p.publication='published' and p.visibility='public' and p.published_at<=now();$$;
create function public.get_published_product(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select business_private.product_public_json(p) from business_private.products p where p.slug=p_slug and p.publication='published' and p.visibility='public' and p.published_at<=now();$$;
create function public.get_staff_product(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p business_private.products;v jsonb;
begin perform business_private.require_product_reader();select * into p from business_private.products where id=p_id;if not found then raise exception 'Product unavailable';end if;
 v:=jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'category',p.category,'developmentStatus',p.development_status,'publication',p.publication,'visibility',p.visibility,'publishedAt',p.published_at,'waitlistEnabled',p.waitlist_enabled,'version',p.version);
 if app_private.has_permission('content.read') or app_private.has_permission('products.technical.manage') then v:=v||business_private.product_public_json(p)||jsonb_build_object('coverAssetId',p.cover_asset_id,'mediaIds',p.media_ids);end if;
 if app_private.has_permission('products.technical.manage') then v:=v||jsonb_build_object('technicalSummary',p.technical_summary);end if;
 if app_private.has_permission('waitlists.read') then v:=v||jsonb_build_object('subscriberCount',(select count(*) from business_private.product_waitlist_entries where product_id=p.id and status='active'),'withdrawnCount',(select count(*) from business_private.product_waitlist_entries where product_id=p.id and status='withdrawn'));end if;
 return v;end;$$;
create function public.list_staff_products() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform business_private.require_product_reader();return(select coalesce(jsonb_agg(public.get_staff_product(p.id) order by p.created_at desc,p.id),'[]'::jsonb) from business_private.products p);end;$$;
create function public.list_product_assets() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform business_private.require_product_reader();return(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',path,'alt',alt) order by asset_key),'[]'::jsonb) from business_private.product_assets where approved);end;$$;

create function public.save_product_identity(p_id uuid,p_version integer,p_name text,p_slug text,p_category text,p_external_url text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('products.manage');
 if not business_private.project_text(p_name,1,160) or not business_private.project_text(p_category,1,80) or p_slug is null or length(p_slug)>80 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_slug='withdraw'
 or (p_external_url is not null and (length(p_external_url)>2048 or p_external_url !~ '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}([/?#][^[:space:]<>]*)?$')) then raise exception 'Invalid product identity' using errcode='22023';end if;
 if p_id is null then
  perform business_private.require_permission('content.create');if p_version is distinct from 0 then raise exception 'Product changed' using errcode='PT409';end if;
  insert into business_private.products(name,slug,category,external_url) values(p_name,p_slug,p_category,p_external_url) returning id into target;
 else
  -- Keep published URLs stable; an approved redirect system is a later stage.
  update business_private.products set name=p_name,category=p_category,external_url=p_external_url,version=version+1,updated_at=now()
  where id=p_id and version=p_version and slug=p_slug returning id into target;
  if not found then raise exception 'Product changed or slug is immutable' using errcode='PT409';end if;
 end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'product.identity_saved','product',target::text,jsonb_build_object('created',p_id is null));
 return public.get_staff_product(target);
 exception when unique_violation then raise exception 'Slug unavailable' using errcode='PT409';end;$$;
create function public.save_product_copy(p_id uuid,p_version integer,p_short text,p_description text,p_features jsonb,p_cover uuid,p_media uuid[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('content.read');perform business_private.require_permission('content.update');
 if not business_private.project_text(p_short,0,400) or not business_private.project_text(p_description,0,10000) or p_features is null or jsonb_typeof(p_features)<>'array' or jsonb_array_length(p_features)>20
 or exists(select from jsonb_array_elements(p_features)x where jsonb_typeof(x)<>'string' or not business_private.project_text(x#>>'{}',1,240))
 or p_media is null or cardinality(p_media)>8 or cardinality(p_media)<>(select count(distinct x) from unnest(p_media)x)
 or exists(select from unnest(p_media)x where x is null or not exists(select from business_private.product_assets a where a.id=x and a.approved))
 or (p_cover is not null and not exists(select from business_private.product_assets where id=p_cover and approved)) then raise exception 'Invalid approved presentation' using errcode='22023';end if;
 if exists(select from business_private.products where id=p_id and publication='published') and (length(btrim(p_short))=0 or length(btrim(p_description))=0) then raise exception 'Published presentation cannot be empty' using errcode='22023';end if;
 update business_private.products set short_description=p_short,description=p_description,features=p_features,cover_asset_id=p_cover,media_ids=p_media,version=version+1,updated_at=now()
 where id=p_id and version=p_version returning id into target;if not found then raise exception 'Product changed' using errcode='PT409';end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id) values(auth.uid(),'product.copy_saved','product',p_id::text);return public.get_staff_product(p_id);end;$$;
create function public.set_product_technical(p_id uuid,p_version integer,p_status text,p_summary text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('products.technical.manage');
 if p_status is null or p_status not in ('concept','in_development','coming_soon','launched') or not business_private.project_text(p_summary,0,4000) then raise exception 'Invalid technical information' using errcode='22023';end if;
 update business_private.products set development_status=p_status,technical_summary=p_summary,version=version+1,updated_at=now() where id=p_id and version=p_version returning id into target;
 if not found then raise exception 'Product changed' using errcode='PT409';end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'product.technical_saved','product',p_id::text,jsonb_build_object('status',p_status));return public.get_staff_product(p_id);end;$$;
create function public.publish_product(p_id uuid,p_version integer,p_publication text,p_visibility text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p business_private.products;
begin perform business_private.require_permission('content.read');perform business_private.require_permission('content.publish');
 select * into p from business_private.products where id=p_id for update;
 if not found or p.version is distinct from p_version then raise exception 'Product changed' using errcode='PT409';end if;
 if p_publication is null or p_publication not in ('draft','published') or p_visibility is null or p_visibility not in ('public','private')
 or (p_publication='published' and (length(btrim(p.short_description))=0 or length(btrim(p.description))=0)) then raise exception 'Complete presentation before publication' using errcode='22023';end if;
 update business_private.products set publication=p_publication,visibility=p_visibility,published_at=case when p_publication='published' then coalesce(p.published_at,now()) else p.published_at end,version=version+1,updated_at=now() where id=p_id;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'product.publication_changed','product',p_id::text,jsonb_build_object('publication',p_publication,'visibility',p_visibility));return public.get_staff_product(p_id);end;$$;
create function public.set_product_waitlist(p_id uuid,p_version integer,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;
begin perform business_private.require_permission('waitlists.read');perform business_private.require_permission('waitlists.manage');if p_enabled is null then raise exception 'Invalid setting' using errcode='22023';end if;
 update business_private.products set waitlist_enabled=p_enabled,version=version+1,updated_at=now() where id=p_id and version=p_version returning id into target;if not found then raise exception 'Product changed' using errcode='PT409';end if;
 insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'product.waitlist_changed','product',p_id::text,jsonb_build_object('enabled',p_enabled));return public.get_staff_product(p_id);end;$$;
create function public.list_product_waitlist(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform business_private.require_permission('waitlists.read');return(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) from
 (select id,product_id,full_name,email,whatsapp,status,consent_version,consented_at,withdrawn_at,created_at from business_private.product_waitlist_entries where product_id=p_id order by created_at desc,id limit 200)x);end;$$;
create function public.staff_withdraw_product_waitlist(p_id uuid,p_evidence text) returns void language plpgsql security definer set search_path='' as $$
declare changed uuid;
begin perform business_private.require_permission('waitlists.read');perform business_private.require_permission('waitlists.manage');if not business_private.project_text(p_evidence,1,240) then raise exception 'Verified request reference required' using errcode='22023';end if;
 update business_private.product_waitlist_entries set status='withdrawn',full_name=null,email=null,whatsapp=null,withdrawal_hash=null,withdrawn_at=now() where id=p_id and status='active' returning id into changed;
 if changed is not null then insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(auth.uid(),'waitlist.withdrawn','product_waitlist',changed::text,jsonb_build_object('channel','verified_staff_request','caseReference',p_evidence));end if;end;$$;

create function business_private.consume_product_budget(p_scope text,p_hash text,p_limit integer) returns void language plpgsql set search_path='' as $$
declare w timestamptz:=date_trunc('hour',clock_timestamp());used integer;
begin if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid quota key' using errcode='22023';end if;
 insert into business_private.product_waitlist_buckets(scope,key_hash,window_start,attempts) values(p_scope,decode(p_hash,'hex'),w,1)
 on conflict(scope,key_hash,window_start) do update set attempts=business_private.product_waitlist_buckets.attempts+1 where business_private.product_waitlist_buckets.attempts<p_limit returning attempts into used;
 if used is null then raise exception 'Submission unavailable' using errcode='P0001';end if;end;$$;
create function public.submit_product_waitlist(p_payload jsonb,p_identity_hex text,p_idempotency_hex text,p_payload_hex text,p_withdrawal_hex text,p_global_hex text,p_email_hex text,p_product_hex text) returns void language plpgsql security definer set search_path='' as $$
declare p business_private.products;e business_private.product_waitlist_entries;target uuid;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_column_size(p_payload)>4000 or (p_payload-array['productId','fullName','email','whatsapp','consent','consentVersion'])<>'{}'
 or not p_payload ?& array['productId','fullName','email','whatsapp','consent','consentVersion'] or p_payload->'consent' is distinct from 'true'::jsonb or (p_payload->>'consentVersion') is distinct from 'product-updates-v1'
 or jsonb_typeof(p_payload->'fullName')<>'string' or jsonb_typeof(p_payload->'email')<>'string' or jsonb_typeof(p_payload->'whatsapp') not in ('string','null')
 or not business_private.project_text(p_payload->>'fullName',1,160) or length(p_payload->>'email')>254 or p_payload->>'email' !~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$'
 or (p_payload->>'whatsapp' is not null and p_payload->>'whatsapp' !~ '^\+[1-9][0-9]{6,14}$')
 or p_identity_hex is null or p_identity_hex !~ '^[a-f0-9]{64}$' or p_idempotency_hex is null or p_idempotency_hex !~ '^[a-f0-9]{64}$'
 or p_payload_hex is null or p_payload_hex !~ '^[a-f0-9]{64}$' or p_withdrawal_hex is null or p_withdrawal_hex !~ '^[a-f0-9]{64}$' then raise exception 'Invalid submission' using errcode='22023';end if;
 -- Global lock bounds quota/dedup transactions consistently across instances.
 perform pg_advisory_xact_lock(42043,1);
 perform business_private.consume_product_budget('join_global',p_global_hex,120);
 perform business_private.consume_product_budget('join_email',p_email_hex,3);
 perform business_private.consume_product_budget('join_product',p_product_hex,60);
 select * into p from business_private.products where id=(p_payload->>'productId')::uuid for share;
 if not found or p.publication<>'published' or p.visibility<>'public' or p.published_at>now() or not p.waitlist_enabled then raise exception 'Submission unavailable' using errcode='22023';end if;
 select * into e from business_private.product_waitlist_entries where idempotency_hash=decode(p_idempotency_hex,'hex');
 if found then if e.payload_hash<>decode(p_payload_hex,'hex') or e.product_id<>p.id then raise exception 'Conflicting submission' using errcode='22023';end if;return;end if;
 insert into business_private.product_waitlist_entries(product_id,identity_hash,idempotency_hash,payload_hash,withdrawal_hash,full_name,email,whatsapp,consent_version)
 values(p.id,decode(p_identity_hex,'hex'),decode(p_idempotency_hex,'hex'),decode(p_payload_hex,'hex'),decode(p_withdrawal_hex,'hex'),btrim(p_payload->>'fullName'),lower(btrim(p_payload->>'email')),p_payload->>'whatsapp','product-updates-v1') on conflict(product_id,identity_hash) do nothing returning id into target;
 if target is not null then insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(null,'waitlist.joined','product_waitlist',target::text,jsonb_build_object('product_id',p.id,'consentVersion','product-updates-v1'));end if;
end;$$;
create function public.withdraw_product_waitlist(p_token_hex text,p_global_hex text,p_token_budget_hex text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin if p_token_hex is null or p_token_hex !~ '^[a-f0-9]{64}$' then raise exception 'Invalid withdrawal' using errcode='22023';end if;
 perform pg_advisory_xact_lock(42043,1);
 perform business_private.consume_product_budget('withdraw_global',p_global_hex,120);perform business_private.consume_product_budget('withdraw_token',p_token_budget_hex,8);
 update business_private.product_waitlist_entries set status='withdrawn',full_name=null,email=null,whatsapp=null,withdrawal_hash=null,withdrawn_at=now() where withdrawal_hash=decode(p_token_hex,'hex') and status='active' returning id into target;
 if target is not null then insert into public.audit_logs(actor_id,action,resource_type,resource_id,metadata) values(null,'waitlist.withdrawn','product_waitlist',target::text,jsonb_build_object('channel','private_capability'));end if;end;$$;

revoke all on function business_private.require_product_reader(),business_private.product_public_json(business_private.products),business_private.consume_product_budget(text,text,integer) from public,anon,authenticated,service_role;
revoke all on function public.list_published_products(),public.get_published_product(text) from public,anon,authenticated,service_role;
grant execute on function public.list_published_products(),public.get_published_product(text) to anon,authenticated;
revoke all on function public.get_staff_product(uuid),public.list_staff_products(),public.list_product_assets(),public.save_product_identity(uuid,integer,text,text,text,text),public.save_product_copy(uuid,integer,text,text,jsonb,uuid,uuid[]),public.set_product_technical(uuid,integer,text,text),public.publish_product(uuid,integer,text,text),public.set_product_waitlist(uuid,integer,boolean),public.list_product_waitlist(uuid),public.staff_withdraw_product_waitlist(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_staff_product(uuid),public.list_staff_products(),public.list_product_assets(),public.save_product_identity(uuid,integer,text,text,text,text),public.save_product_copy(uuid,integer,text,text,jsonb,uuid,uuid[]),public.set_product_technical(uuid,integer,text,text),public.publish_product(uuid,integer,text,text),public.set_product_waitlist(uuid,integer,boolean),public.list_product_waitlist(uuid),public.staff_withdraw_product_waitlist(uuid,text) to authenticated;
revoke all on function public.submit_product_waitlist(jsonb,text,text,text,text,text,text,text),public.withdraw_product_waitlist(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_product_waitlist(jsonb,text,text,text,text,text,text,text),public.withdraw_product_waitlist(text,text,text) to service_role;
commit;
