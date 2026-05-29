-- Orbit Admin Dashboard migration
-- Run this with the postgres role in Supabase SQL Editor.
-- Safe to rerun: objects are created with IF NOT EXISTS and policies are replaced.

create extension if not exists "pgcrypto";

-- ============================================================================
-- PROFILE MODERATION COLUMNS
-- ============================================================================

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists moderation_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'disabled', 'banned', 'deleted'));
  end if;
end;
$$;

comment on column public.profiles.account_status is 'Admin moderation state for the user account.';
comment on column public.profiles.disabled_at is 'Timestamp set when an admin disables the account.';
comment on column public.profiles.banned_at is 'Timestamp set when an admin bans the account.';
comment on column public.profiles.deleted_at is 'Soft-delete timestamp. The auth user is not hard-deleted by the browser admin app.';
comment on column public.profiles.moderation_reason is 'Latest internal admin moderation note.';

-- ============================================================================
-- ADMIN TABLES
-- ============================================================================

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

comment on table public.admin_users is 'Allow-list for accounts that can access Orbit Admin.';
comment on column public.admin_users.role is 'Admin role: super_admin, admin, or moderator.';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_user_id uuid not null,
  reason text not null,
  description text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  admin_notes text,
  updated_at timestamptz not null default now(),
  constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id) on delete cascade,
  constraint reports_target_user_id_fkey foreign key (target_user_id) references public.profiles(id) on delete cascade,
  constraint reports_resolved_by_fkey foreign key (resolved_by) references public.profiles(id) on delete set null,
  constraint reports_no_self_report check (reporter_id <> target_user_id),
  constraint reports_status_check check (status in ('pending', 'resolved', 'rejected', 'warned', 'suspended'))
);

comment on table public.reports is 'User-generated safety reports reviewed by Orbit admins.';

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'general',
  title text,
  message text not null,
  status text not null default 'open',
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint feedbacks_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint feedbacks_resolved_by_fkey foreign key (resolved_by) references public.profiles(id) on delete set null,
  constraint feedbacks_type_check check (type in ('bug', 'feature', 'safety', 'general')),
  constraint feedbacks_status_check check (status in ('open', 'resolved'))
);

comment on table public.feedbacks is 'User feedback submitted from Orbit clients and resolved in admin.';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all',
  target_user_id uuid,
  title text not null,
  body text not null,
  status text not null default 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_target_user_id_fkey foreign key (target_user_id) references public.profiles(id) on delete set null,
  constraint notifications_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null,
  constraint notifications_audience_check check (audience in ('all', 'user')),
  constraint notifications_status_check check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  constraint notifications_target_required_check check (
    (audience = 'all' and target_user_id is null)
    or (audience = 'user' and target_user_id is not null)
  )
);

comment on table public.notifications is 'Admin-created notification history and scheduled notification metadata.';
comment on column public.notifications.scheduled_at is 'Future delivery timestamp. A worker or Edge Function can process scheduled rows.';

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists profiles_account_status_idx on public.profiles (account_status, created_at desc);
create index if not exists profiles_last_active_idx on public.profiles (last_active desc);

create index if not exists admin_users_user_id_idx on public.admin_users (user_id);
create index if not exists admin_users_role_idx on public.admin_users (role) where is_active = true;

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists reports_target_user_idx on public.reports (target_user_id, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

create index if not exists feedbacks_status_created_idx on public.feedbacks (status, created_at desc);
create index if not exists feedbacks_type_status_idx on public.feedbacks (type, status, created_at desc);
create index if not exists feedbacks_user_idx on public.feedbacks (user_id, created_at desc);

create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_status_schedule_idx on public.notifications (status, scheduled_at);
create index if not exists notifications_target_idx on public.notifications (target_user_id, created_at desc);

-- ============================================================================
-- HELPERS
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists feedbacks_set_updated_at on public.feedbacks;
create trigger feedbacks_set_updated_at
before update on public.feedbacks
for each row execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create or replace function public.is_admin(
  allowed_roles text[] default array['super_admin', 'admin', 'moderator']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and is_active = true
      and role = any(allowed_roles)
  );
$$;

grant execute on function public.is_admin(text[]) to authenticated;

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
      and account_status = 'active'
      and deleted_at is null
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

-- ============================================================================
-- RLS ENABLEMENT
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;
alter table public.encounters enable row level security;
alter table public.admin_users enable row level security;
alter table public.reports enable row level security;
alter table public.feedbacks enable row level security;
alter table public.notifications enable row level security;

-- ============================================================================
-- PROFILE POLICIES
-- ============================================================================
-- Important:
-- - New users must be able to insert and read their own profile immediately.
-- - Disabled/banned/deleted users should lose general app access.
-- - Admins can still read/update moderation fields.

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
on public.profiles for update
to authenticated
using (public.is_admin(array['super_admin', 'admin']))
with check (public.is_admin(array['super_admin', 'admin']));

drop policy if exists "Only active accounts can read profiles" on public.profiles;
create policy "Only active accounts can read profiles"
on public.profiles as restrictive for select
to authenticated
using (public.is_admin() or public.is_account_active() or auth.uid() = id);

drop policy if exists "Only active accounts can update profiles" on public.profiles;
create policy "Only active accounts can update profiles"
on public.profiles as restrictive for update
to authenticated
using (public.is_admin() or public.is_account_active() or auth.uid() = id)
with check (public.is_admin() or public.is_account_active() or auth.uid() = id);

-- ============================================================================
-- ACTIVE-ACCOUNT RESTRICTIONS FOR MOBILE APP TABLES
-- ============================================================================

drop policy if exists "Only active accounts can use locations" on public.locations;
create policy "Only active accounts can use locations"
on public.locations as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

drop policy if exists "Only active accounts can use friends" on public.friends;
create policy "Only active accounts can use friends"
on public.friends as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

drop policy if exists "Only active accounts can use friend requests" on public.friend_requests;
create policy "Only active accounts can use friend requests"
on public.friend_requests as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

drop policy if exists "Only active accounts can use messages" on public.messages;
create policy "Only active accounts can use messages"
on public.messages as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

drop policy if exists "Only active accounts can use encounters" on public.encounters;
create policy "Only active accounts can use encounters"
on public.encounters as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

-- ============================================================================
-- ADMIN READ POLICIES FOR EXISTING MOBILE TABLES
-- ============================================================================

drop policy if exists "Admins can read all locations" on public.locations;
create policy "Admins can read all locations"
on public.locations for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all friends" on public.friends;
create policy "Admins can read all friends"
on public.friends for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all friend requests" on public.friend_requests;
create policy "Admins can read all friend requests"
on public.friend_requests for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all messages" on public.messages;
create policy "Admins can read all messages"
on public.messages for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all encounters" on public.encounters;
create policy "Admins can read all encounters"
on public.encounters for select
to authenticated
using (public.is_admin());

-- ============================================================================
-- ADMIN USERS POLICIES
-- ============================================================================

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (public.is_admin(array['super_admin']) or (auth.uid() = user_id and is_active = true));

drop policy if exists "Super admins can insert admin users" on public.admin_users;
create policy "Super admins can insert admin users"
on public.admin_users for insert
to authenticated
with check (public.is_admin(array['super_admin']));

drop policy if exists "Super admins can update admin users" on public.admin_users;
create policy "Super admins can update admin users"
on public.admin_users for update
to authenticated
using (public.is_admin(array['super_admin']))
with check (public.is_admin(array['super_admin']));

drop policy if exists "Super admins can delete admin users" on public.admin_users;
create policy "Super admins can delete admin users"
on public.admin_users for delete
to authenticated
using (public.is_admin(array['super_admin']));

-- ============================================================================
-- REPORT POLICIES
-- ============================================================================

drop policy if exists "Reports are readable by owners and admins" on public.reports;
create policy "Reports are readable by owners and admins"
on public.reports for select
to authenticated
using (public.is_admin() or auth.uid() = reporter_id);

drop policy if exists "Users can create own reports" on public.reports;
create policy "Users can create own reports"
on public.reports for insert
to authenticated
with check (public.is_admin() or auth.uid() = reporter_id);

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
on public.reports for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Only active accounts can use reports" on public.reports;
create policy "Only active accounts can use reports"
on public.reports as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

-- ============================================================================
-- FEEDBACK POLICIES
-- ============================================================================

drop policy if exists "Feedbacks are readable by owners and admins" on public.feedbacks;
create policy "Feedbacks are readable by owners and admins"
on public.feedbacks for select
to authenticated
using (public.is_admin() or auth.uid() = user_id);

drop policy if exists "Users can create own feedbacks" on public.feedbacks;
create policy "Users can create own feedbacks"
on public.feedbacks for insert
to authenticated
with check (public.is_admin() or auth.uid() = user_id);

drop policy if exists "Admins can update feedbacks" on public.feedbacks;
create policy "Admins can update feedbacks"
on public.feedbacks for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Only active accounts can use feedbacks" on public.feedbacks;
create policy "Only active accounts can use feedbacks"
on public.feedbacks as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

-- ============================================================================
-- NOTIFICATION POLICIES
-- ============================================================================

drop policy if exists "Notifications are readable by recipients and admins" on public.notifications;
create policy "Notifications are readable by recipients and admins"
on public.notifications for select
to authenticated
using (
  public.is_admin()
  or (
    status = 'sent'
    and (
      audience = 'all'
      or target_user_id = auth.uid()
    )
  )
);

drop policy if exists "Admins can insert notifications" on public.notifications;
create policy "Admins can insert notifications"
on public.notifications for insert
to authenticated
with check (public.is_admin(array['super_admin', 'admin']));

drop policy if exists "Admins can update notifications" on public.notifications;
create policy "Admins can update notifications"
on public.notifications for update
to authenticated
using (public.is_admin(array['super_admin', 'admin']))
with check (public.is_admin(array['super_admin', 'admin']));

drop policy if exists "Only active accounts can use notifications" on public.notifications;
create policy "Only active accounts can use notifications"
on public.notifications as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

-- ============================================================================
-- REALTIME
-- ============================================================================

alter table public.reports replica identity full;
alter table public.feedbacks replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedbacks'
  ) then
    alter publication supabase_realtime add table public.feedbacks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ============================================================================
-- FIRST ADMIN HELPER
-- ============================================================================
-- After this migration succeeds, run this block with your real admin email:
--
-- insert into public.admin_users (user_id, role, is_active)
-- select id, 'super_admin', true
-- from auth.users
-- where email = 'admin@gmail.com'
-- on conflict (user_id) do update set
--   role = excluded.role,
--   is_active = true,
--   updated_at = now();
