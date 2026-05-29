-- Admin dashboard policy subset.
-- The migration-ready full file is supabase/migrations/202605250001_admin_dashboard.sql.

create or replace function public.is_admin(allowed_roles text[] default array['super_admin', 'admin', 'moderator'])
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

alter table public.admin_users enable row level security;
alter table public.reports enable row level security;
alter table public.feedbacks enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

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

drop policy if exists "Admins can read all messages" on public.messages;
create policy "Admins can read all messages"
on public.messages for select
to authenticated
using (public.is_admin());

drop policy if exists "Only active accounts can use messages" on public.messages;
create policy "Only active accounts can use messages"
on public.messages as restrictive for all
to authenticated
using (public.is_admin() or public.is_account_active())
with check (public.is_admin() or public.is_account_active());

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (public.is_admin(array['super_admin']) or (auth.uid() = user_id and is_active = true));

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
