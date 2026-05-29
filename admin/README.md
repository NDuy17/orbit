# Orbit Admin

Orbit Admin is a separate React + Vite dashboard for the Orbit Supabase backend.

## Stack

- React
- Vite
- React Router DOM
- TailwindCSS
- Zustand
- Supabase JS
- Recharts

## Local Setup

```bash
npm --prefix admin install
cp admin/.env.example admin/.env
npm run admin
```

Use the same Supabase project values as the Expo app:

```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

The app also accepts `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` if they are exposed to Vite.

## Build

```bash
npm run admin:build
```

## Database

Apply the base schema first, then run:

```text
supabase/migrations/202605250001_admin_dashboard.sql
supabase/migrations/202605250002_push_notifications.sql
supabase/migrations/202605250003_admin_performance.sql
supabase/migrations/202605250004_user_warnings_timed_bans.sql
supabase/migrations/202605250005_notification_dismissals_and_push_rpc.sql
supabase/migrations/202605270001_social_notifications.sql
```

Create the first admin using a privileged SQL role:

```sql
insert into public.admin_users (user_id, role)
values ('your-auth-user-id', 'super_admin');
```

## Security

Access is allowed only when the logged-in Supabase Auth user has an active row in `admin_users`. RLS policies and the `public.is_admin()` helper function protect admin-only data and aggregate dashboard queries.
