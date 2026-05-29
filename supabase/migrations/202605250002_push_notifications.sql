-- Orbit push notification support.
-- Run after 202605250001_admin_dashboard.sql.

create extension if not exists "pgcrypto";

-- Admin users are Supabase Auth users. They may not always have a mobile
-- profile row, so admin action references should point at auth.users.
alter table public.notifications drop constraint if exists notifications_created_by_fkey;
alter table public.notifications
  add constraint notifications_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.reports drop constraint if exists reports_resolved_by_fkey;
alter table public.reports
  add constraint reports_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id) on delete set null;

alter table public.feedbacks drop constraint if exists feedbacks_resolved_by_fkey;
alter table public.feedbacks
  add constraint feedbacks_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id) on delete set null;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  is_active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_token_unique unique (expo_push_token),
  constraint push_tokens_platform_check check (platform is null or platform in ('android', 'ios')),
  constraint push_tokens_expo_token_check check (expo_push_token ~ '^Expo(nent)?PushToken\[[^]]+\]$')
);

comment on table public.push_tokens is 'Expo push tokens registered by Orbit client devices.';
comment on column public.push_tokens.user_id is 'Supabase Auth user that owns the device token.';

create index if not exists push_tokens_user_active_idx
  on public.push_tokens (user_id, is_active, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_set_updated_at on public.push_tokens;
create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

drop policy if exists "Users can read own push tokens" on public.push_tokens;
create policy "Users can read own push tokens"
on public.push_tokens for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens"
on public.push_tokens for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
on public.push_tokens for update
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
on public.push_tokens for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());
