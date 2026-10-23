-- Stage 2D.5: server-only, durable Auth flow state. Apply locally first.
-- The public RPCs are executable only by service_role; their tables are private.

create table app_private.auth_flow_tickets (
  id_hash bytea primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  flow_type text not null check (flow_type in ('invite', 'recovery')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint auth_flow_ticket_hash_length check (pg_catalog.octet_length(id_hash) = 32)
);
create index auth_flow_tickets_expiry_idx on app_private.auth_flow_tickets (expires_at);

create table app_private.auth_recovery_buckets (
  scope text not null check (scope in ('global', 'email')),
  key_hash bytea not null check (pg_catalog.octet_length(key_hash) = 32),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 30),
  primary key (scope, key_hash, window_start)
);
create index auth_recovery_buckets_window_idx on app_private.auth_recovery_buckets (window_start);

alter table app_private.auth_flow_tickets enable row level security;
alter table app_private.auth_recovery_buckets enable row level security;
revoke all on app_private.auth_flow_tickets, app_private.auth_recovery_buckets
  from public, anon, authenticated, service_role;

create function public.auth_flow_store_ready()
returns boolean language sql security definer set search_path = ''
as $$ select true $$;

create function public.register_auth_flow_ticket(
  p_hash_hex text, p_user_id uuid, p_flow_type text, p_expires_at timestamptz
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_hash_hex !~ '^[0-9a-f]{64}$' or p_user_id is null
     or p_flow_type not in ('invite', 'recovery')
     or p_expires_at is null
     or p_expires_at <= pg_catalog.clock_timestamp()
     or p_expires_at > pg_catalog.clock_timestamp() + interval '11 minutes' then
    raise exception 'Invalid ticket registration';
  end if;
  insert into app_private.auth_flow_tickets (id_hash, user_id, flow_type, expires_at)
  values (pg_catalog.decode(p_hash_hex, 'hex'), p_user_id, p_flow_type, p_expires_at);
end;
$$;

create function public.redeem_auth_flow_ticket(
  p_hash_hex text, p_user_id uuid, p_flow_type text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_redeemed boolean;
begin
  if p_hash_hex !~ '^[0-9a-f]{64}$' or p_user_id is null
     or p_flow_type not in ('invite', 'recovery') then return false; end if;
  update app_private.auth_flow_tickets
     set redeemed_at = pg_catalog.clock_timestamp()
   where id_hash = pg_catalog.decode(p_hash_hex, 'hex')
     and user_id = p_user_id and flow_type = p_flow_type
     and expires_at > pg_catalog.clock_timestamp()
     and redeemed_at is null
   returning true into v_redeemed;
  return coalesce(v_redeemed, false);
end;
$$;

create function public.consume_recovery_budget(p_email_hash_hex text, p_global_hash_hex text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz;
  v_global bytea;
  v_email bytea;
  v_count integer;
begin
  if p_email_hash_hex !~ '^[0-9a-f]{64}$'
     or p_global_hash_hex !~ '^[0-9a-f]{64}$'
     or p_email_hash_hex = p_global_hash_hex then return false; end if;
  v_global := pg_catalog.decode(p_global_hash_hex, 'hex');
  v_email := pg_catalog.decode(p_email_hash_hex, 'hex');
  -- All callers use the same transaction lock. Concurrent requests cannot
  -- both observe the last remaining slot; the lock is held until commit.
  perform pg_catalog.pg_advisory_xact_lock(2210255001);
  v_window := pg_catalog.date_trunc('hour', pg_catalog.clock_timestamp());
  select attempts into v_count from app_private.auth_recovery_buckets
    where scope = 'global' and key_hash = v_global and window_start = v_window;
  if coalesce(v_count, 0) >= 30 then return false; end if;
  select attempts into v_count from app_private.auth_recovery_buckets
    where scope = 'email' and key_hash = v_email and window_start = v_window;
  if coalesce(v_count, 0) >= 3 then return false; end if;
  insert into app_private.auth_recovery_buckets (scope, key_hash, window_start, attempts)
    values ('global', v_global, v_window, 1)
    on conflict (scope, key_hash, window_start) do update
      set attempts = app_private.auth_recovery_buckets.attempts + 1;
  insert into app_private.auth_recovery_buckets (scope, key_hash, window_start, attempts)
    values ('email', v_email, v_window, 1)
    on conflict (scope, key_hash, window_start) do update
      set attempts = app_private.auth_recovery_buckets.attempts + 1;
  return true;
end;
$$;

-- An argument-free RPC lets the server check deployment and key access before
-- consuming an email OTP. The other three functions accept hashes only.
revoke execute on function public.auth_flow_store_ready() from public, anon, authenticated;
revoke execute on function public.register_auth_flow_ticket(text, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.redeem_auth_flow_ticket(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.consume_recovery_budget(text, text) from public, anon, authenticated;
grant execute on function public.auth_flow_store_ready() to service_role;
grant execute on function public.register_auth_flow_ticket(text, uuid, text, timestamptz) to service_role;
grant execute on function public.redeem_auth_flow_ticket(text, uuid, text) to service_role;
grant execute on function public.consume_recovery_budget(text, text) to service_role;

comment on table app_private.auth_flow_tickets is 'Only SHA-256 hashes of random flow ticket identifiers are stored.';
comment on table app_private.auth_recovery_buckets is 'HMAC-only fixed-hour recovery quotas: three per email and thirty global.';
