-- Admin dashboard schema subset.
-- The migration-ready full file is supabase/migrations/202605250001_admin_dashboard.sql.

create extension if not exists "pgcrypto";

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists moderation_reason text;
alter table public.profiles add column if not exists warning_count integer not null default 0;
alter table public.profiles add column if not exists last_warned_at timestamptz;
alter table public.profiles add column if not exists ban_expires_at timestamptz;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_user_unique unique (user_id),
  constraint admin_users_role_check check (role in ('super_admin', 'admin', 'moderator'))
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null constraint reports_reporter_id_fkey references public.profiles(id) on delete cascade,
  target_user_id uuid not null constraint reports_target_user_id_fkey references public.profiles(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_by uuid constraint reports_resolved_by_fkey references auth.users(id) on delete set null,
  resolved_at timestamptz,
  admin_notes text,
  updated_at timestamptz not null default now(),
  constraint reports_no_self_report check (reporter_id <> target_user_id),
  constraint reports_status_check check (status in ('pending', 'resolved', 'rejected', 'warned', 'suspended'))
);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint feedbacks_user_id_fkey references public.profiles(id) on delete cascade,
  type text not null default 'general',
  title text,
  message text not null,
  status text not null default 'open',
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_by uuid constraint feedbacks_resolved_by_fkey references auth.users(id) on delete set null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint feedbacks_type_check check (type in ('bug', 'feature', 'safety', 'general')),
  constraint feedbacks_status_check check (status in ('open', 'resolved'))
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all',
  target_user_id uuid constraint notifications_target_user_id_fkey references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  status text not null default 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid constraint notifications_created_by_fkey references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_audience_check check (audience in ('all', 'user')),
  constraint notifications_status_check check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  constraint notifications_target_required_check check (
    (audience = 'all' and target_user_id is null)
    or (audience = 'user' and target_user_id is not null)
  )
);

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
