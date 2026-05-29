-- Faster admin dashboard search/list queries.
-- Safe to run after the admin dashboard migration.

create extension if not exists "pg_trgm";

create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);

create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists feedbacks_status_type_created_idx
  on public.feedbacks (status, type, created_at desc);

create index if not exists notifications_audience_created_idx
  on public.notifications (audience, created_at desc);

analyze public.profiles;
analyze public.feedbacks;
analyze public.reports;
analyze public.notifications;
