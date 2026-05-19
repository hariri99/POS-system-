create or replace function public.normalize_login_name(value text)
returns text
language sql
immutable
as $$
  select trim(both '._-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9._-]+', '.', 'g'))
$$;

alter table public.profiles
  add column if not exists login_name text;

with base_logins as (
  select
    id,
    created_at,
    coalesce(
      nullif(public.normalize_login_name(login_name), ''),
      nullif(public.normalize_login_name(split_part(email, '@', 1)), ''),
      nullif(public.normalize_login_name(full_name), ''),
      'staff'
    ) as base_login
  from public.profiles
),
ranked_logins as (
  select
    id,
    case
      when row_number() over (partition by base_login order by created_at, id) = 1 then base_login
      else base_login || '.' || row_number() over (partition by base_login order by created_at, id)
    end as resolved_login
  from base_logins
)
update public.profiles p
set login_name = ranked_logins.resolved_login
from ranked_logins
where p.id = ranked_logins.id
  and (p.login_name is null or p.login_name = '');

alter table public.profiles
  alter column login_name set not null;

drop index if exists idx_profiles_login_name_unique;
create unique index idx_profiles_login_name_unique
on public.profiles (login_name);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_branch uuid;
  requested_login_name text;
begin
  select id into default_branch from public.branches order by created_at asc limit 1;

  requested_login_name := coalesce(
    nullif(public.normalize_login_name(new.raw_user_meta_data ->> 'login_name'), ''),
    nullif(public.normalize_login_name(split_part(new.email, '@', 1)), ''),
    nullif(public.normalize_login_name(new.raw_user_meta_data ->> 'full_name'), ''),
    'staff'
  );

  insert into public.profiles (
    id,
    branch_id,
    email,
    full_name,
    login_name,
    role
  )
  values (
    new.id,
    default_branch,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    requested_login_name,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'employee')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    login_name = excluded.login_name,
    role = excluded.role;

  return new;
end;
$$;
