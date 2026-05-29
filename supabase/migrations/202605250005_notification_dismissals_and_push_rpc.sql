-- Per-user notification deletion and safer Expo push token registration.
-- Run after 202605250004_user_warnings_timed_bans.sql.

create extension if not exists "pgcrypto";

create table if not exists public.notification_dismissals (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint notification_dismissals_unique unique (notification_id, user_id)
);

comment on table public.notification_dismissals is 'Per-user hidden notification rows. Admin notification history remains intact.';

create index if not exists notification_dismissals_user_idx
  on public.notification_dismissals (user_id, created_at desc);

create index if not exists notification_dismissals_notification_idx
  on public.notification_dismissals (notification_id);

alter table public.notification_dismissals enable row level security;

drop policy if exists "Users can read own notification dismissals" on public.notification_dismissals;
create policy "Users can read own notification dismissals"
on public.notification_dismissals for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can create own notification dismissals" on public.notification_dismissals;
create policy "Users can create own notification dismissals"
on public.notification_dismissals for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notification dismissals" on public.notification_dismissals;
create policy "Users can delete own notification dismissals"
on public.notification_dismissals for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Only active accounts can use notification dismissals" on public.notification_dismissals;
create policy "Only active accounts can use notification dismissals"
on public.notification_dismissals as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  token_row public.push_tokens;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user required.';
  end if;

  if p_expo_push_token is null or p_expo_push_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise exception 'Invalid Expo push token.';
  end if;

  if p_platform is not null and p_platform not in ('android', 'ios') then
    raise exception 'Invalid push token platform.';
  end if;

  delete from public.push_tokens
  where expo_push_token = p_expo_push_token
    and user_id <> auth.uid();

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    is_active,
    last_error,
    updated_at
  )
  values (
    auth.uid(),
    p_expo_push_token,
    p_platform,
    true,
    null,
    now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        is_active = true,
        last_error = null,
        updated_at = now()
  returning * into token_row;

  return token_row;
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
