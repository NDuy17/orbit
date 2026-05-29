-- Orbit Supabase schema
-- Apply this file in a Supabase SQL editor or through the Supabase CLI.
-- Location data is sensitive: keep Row Level Security enabled in production.

create extension if not exists "pgcrypto";

-- Public profile data for each authenticated user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text default '',
  status text default 'Moi tham gia Orbit',
  is_online boolean not null default false,
  last_active timestamptz,
  friends_count integer not null default 0,
  encounters_count integer not null default 0,
  recent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'User profile rows connected one-to-one with Supabase Auth users.';
comment on column public.profiles.id is 'Matches auth.users.id.';

-- Latest location state for each user. Exact coordinates are sensitive.
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  public_latitude double precision,
  public_longitude double precision,
  is_visible boolean not null default true,
  is_approximate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_one_row_per_user unique (user_id),
  constraint locations_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint locations_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint locations_public_latitude_range check (public_latitude is null or public_latitude between -90 and 90),
  constraint locations_public_longitude_range check (public_longitude is null or public_longitude between -180 and 180)
);

comment on table public.locations is 'Current user location and visibility state. public_* coordinates are intended for safer nearby discovery.';
comment on column public.locations.is_visible is 'False when Ghost Mode is enabled.';

-- Accepted friend edges. The app creates reciprocal rows for a friendship.
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friends_no_self_friend check (user_id <> friend_id),
  constraint friends_unique_pair unique (user_id, friend_id)
);

comment on table public.friends is 'Accepted friend relationships stored as directed edges. Store two rows for a mutual friendship.';

-- Friend invitation workflow between two users.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_no_self_request check (sender_id <> receiver_id),
  constraint friend_requests_status_check check (status in ('pending', 'accepted', 'rejected', 'cancelled'))
);

comment on table public.friend_requests is 'Friend request records for pending, accepted, rejected, or cancelled invitations.';

-- Direct one-to-one chat messages.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_no_self_message check (sender_id <> receiver_id),
  constraint messages_non_empty_text check (length(trim(text)) > 0)
);

comment on table public.messages is 'Direct chat messages visible only to the sender and receiver.';

-- Proximity events when two users are close enough to count as an encounter.
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  distance_meters integer,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint encounters_no_self_encounter check (user_a <> user_b),
  constraint encounters_ordered_pair check (user_a < user_b),
  constraint encounters_distance_non_negative check (distance_meters is null or distance_meters >= 0)
);

comment on table public.encounters is 'Near-by encounter events between two distinct users.';

-- Timestamp helper.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists friend_requests_set_updated_at on public.friend_requests;
create trigger friend_requests_set_updated_at
before update on public.friend_requests
for each row execute function public.set_updated_at();

-- Performance indexes.
create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_full_name_idx on public.profiles (full_name);
create index if not exists profiles_online_idx on public.profiles (is_online, last_active desc);

create index if not exists locations_visible_updated_idx on public.locations (is_visible, updated_at desc);
create index if not exists locations_user_updated_idx on public.locations (user_id, updated_at desc);
create index if not exists locations_public_coords_idx on public.locations (public_latitude, public_longitude) where is_visible = true;

create index if not exists friends_user_id_idx on public.friends (user_id);
create index if not exists friends_friend_id_idx on public.friends (friend_id);

create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id, status, created_at desc);
create index if not exists friend_requests_receiver_idx on public.friend_requests (receiver_id, status, created_at desc);
create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';

create index if not exists messages_sender_receiver_created_idx on public.messages (sender_id, receiver_id, created_at);
create index if not exists messages_receiver_sender_created_idx on public.messages (receiver_id, sender_id, created_at);
create index if not exists messages_recent_idx on public.messages (created_at desc);

create index if not exists encounters_users_time_idx on public.encounters (user_a, user_b, happened_at desc);

-- Row Level Security.
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;
alter table public.encounters enable row level security;

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

drop policy if exists "Users can read visible or own locations" on public.locations;
create policy "Users can read visible or own locations"
on public.locations for select
to authenticated
using (is_visible = true or auth.uid() = user_id);

drop policy if exists "Users can insert their own location" on public.locations;
create policy "Users can insert their own location"
on public.locations for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own location" on public.locations;
create policy "Users can update their own location"
on public.locations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own location" on public.locations;
create policy "Users can delete their own location"
on public.locations for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their friend edges" on public.friends;
create policy "Users can read their friend edges"
on public.friends for select
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can create friend edges involving themselves" on public.friends;
create policy "Users can create friend edges involving themselves"
on public.friends for insert
to authenticated
with check (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can delete their friend edges" on public.friends;
create policy "Users can delete their friend edges"
on public.friends for delete
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can read requests involving themselves" on public.friend_requests;
create policy "Users can read requests involving themselves"
on public.friend_requests for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send requests as themselves" on public.friend_requests;
create policy "Users can send requests as themselves"
on public.friend_requests for insert
to authenticated
with check (auth.uid() = sender_id and status = 'pending');

drop policy if exists "Receivers can update received requests" on public.friend_requests;
create policy "Receivers can update received requests"
on public.friend_requests for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "Senders can cancel pending requests" on public.friend_requests;
create policy "Senders can cancel pending requests"
on public.friend_requests for delete
to authenticated
using (auth.uid() = sender_id and status = 'pending');

drop policy if exists "Users can read their own messages" on public.messages;
create policy "Users can read their own messages"
on public.messages for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves"
on public.messages for insert
to authenticated
with check (auth.uid() = sender_id);

drop policy if exists "Receivers can mark messages read" on public.messages;
create policy "Receivers can mark messages read"
on public.messages for update
to authenticated
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "Users can read encounters involving themselves" on public.encounters;
create policy "Users can read encounters involving themselves"
on public.encounters for select
to authenticated
using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Users can create encounters involving themselves" on public.encounters;
create policy "Users can create encounters involving themselves"
on public.encounters for insert
to authenticated
with check (auth.uid() = user_a or auth.uid() = user_b);

-- Realtime setup for live chat, locations, and profile presence.
alter table public.messages replica identity full;
alter table public.locations replica identity full;
alter table public.profiles replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'locations'
  ) then
    alter publication supabase_realtime add table public.locations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
