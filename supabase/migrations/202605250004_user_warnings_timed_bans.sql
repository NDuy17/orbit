-- User warning counters and timed bans for Orbit Admin.

alter table public.profiles add column if not exists warning_count integer not null default 0;
alter table public.profiles add column if not exists last_warned_at timestamptz;
alter table public.profiles add column if not exists ban_expires_at timestamptz;

comment on column public.profiles.warning_count is 'Number of admin warnings issued to this user.';
comment on column public.profiles.last_warned_at is 'Timestamp of the latest admin warning.';
comment on column public.profiles.ban_expires_at is 'Timestamp when a temporary ban should stop blocking app access.';

create index if not exists profiles_warning_count_idx
  on public.profiles (warning_count desc, last_warned_at desc);

create index if not exists profiles_ban_expires_idx
  on public.profiles (ban_expires_at)
  where account_status = 'banned';

create or replace function public.is_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and (
        account_status = 'active'
        or (
          account_status = 'banned'
          and ban_expires_at is not null
          and ban_expires_at <= now()
        )
      )
  );
$$;

grant execute on function public.is_account_active() to authenticated;

create or replace function public.prevent_non_admin_profile_moderation_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    old.account_status is distinct from new.account_status
    or old.disabled_at is distinct from new.disabled_at
    or old.banned_at is distinct from new.banned_at
    or old.deleted_at is distinct from new.deleted_at
    or old.moderation_reason is distinct from new.moderation_reason
    or old.warning_count is distinct from new.warning_count
    or old.last_warned_at is distinct from new.last_warned_at
    or old.ban_expires_at is distinct from new.ban_expires_at
  ) and not public.is_admin(array['super_admin', 'admin']) then
    raise exception 'Only admins can update moderation fields';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_moderation_fields on public.profiles;
create trigger profiles_guard_moderation_fields
before update on public.profiles
for each row execute function public.prevent_non_admin_profile_moderation_changes();
