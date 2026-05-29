# Orbit

Orbit is a location-based social network built with Expo and React Native. The app helps people find nearby friends, manage friend requests, chat in real time, and control how much location data they share through privacy-focused modes such as Ghost Mode and approximate location sharing.

[📱 Màn hình Map](#) | [📍 Nearby](#) | [💬 Chat](#)

## Features

- **Auth**: Sign up, sign in, and persistent Supabase auth sessions.
- **Map view**: See nearby visible users on a map-first home screen.
- **Nearby friends**: Discover people around the current device location.
- **Ghost mode**: Hide your location while keeping your account active.
- **Radius filter**: Limit discovery to a selected nearby distance.
- **Real-time chat**: Send and receive direct messages through Supabase Realtime.
- **Friend requests**: Send, accept, reject, and remove friendships.
- **Privacy controls**: Store exact coordinates only when needed and expose approximate coordinates for public discovery.

## Tech Stack

- **Expo SDK 55**
- **React Native**
- **JavaScript**
- **Zustand**
- **Supabase Auth, Postgres, RLS, Realtime**
- **React Navigation**

## Folder Structure

```text
.
├── App.js
├── app.json
├── index.js
├── src
│   ├── assets          # App-local visual assets
│   ├── components      # Shared UI components
│   ├── constants       # Static config and constants
│   ├── data            # Mock fallback data
│   ├── navigation      # App navigation tree
│   ├── screens         # Screen-level UI
│   ├── services        # Supabase, auth, friends, messages, profiles, location
│   ├── store           # Zustand stores
│   ├── theme           # Colors, spacing, typography
│   └── utils           # Shared helpers
└── supabase
    └── schema.sql      # Database tables, RLS policies, indexes, realtime setup
```

## Getting Started

```bash
npm install
npm start
```

Then select the target from Expo CLI:

- Press `i` for iOS Simulator.
- Press `a` for Android Emulator.
- Press `w` for Web.

Create a local `.env` file from `.env.example` and add your Supabase project values before testing the live backend.

## Database Overview

- **profiles**: Public profile data connected to Supabase Auth users.
- **locations**: Latest user location, visibility state, exact coordinates, and approximate public coordinates.
- **friends**: Accepted one-way friend edges. The app stores reciprocal rows for each friendship.
- **friend_requests**: Pending, accepted, or rejected friend invitations.
- **messages**: Direct chat messages between two users.
- **encounters**: Short-lived proximity events for users who were near each other.

The full SQL schema, Row Level Security policies, indexes, and realtime publication setup live in `supabase/schema.sql`.

## Environment Variables

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_EAS_PROJECT_ID=your_eas_project_id_here
```

Only use Supabase anon or publishable keys in the Expo app. Never ship service role keys to a mobile or web client.

## Scripts

```bash
npm start          # Start Expo
npm run android    # Start Android target
npm run ios        # Start iOS target
npm run web        # Start web target
npm run admin      # Start the Vite admin dashboard
npm run admin:build
npm run lint       # Run ESLint
npm run format     # Format source files
npm run format:check
```

## Admin Dashboard

Orbit Admin is a separate React + Vite app in `admin/`. It uses the same Supabase project as the mobile app, but it is protected by the `admin_users` table and admin-only RLS policies.

### Admin Setup

```bash
npm --prefix admin install
cp admin/.env.example admin/.env
npm run admin
```

Set the admin env values to the same Supabase backend used by the Expo app:

```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Build the dashboard:

```bash
npm run admin:build
```

### Admin Database Migration

Apply the migration after the base app schema:

```text
supabase/migrations/202605250001_admin_dashboard.sql
supabase/migrations/202605250002_push_notifications.sql
supabase/migrations/202605250003_admin_performance.sql
supabase/migrations/202605250004_user_warnings_timed_bans.sql
supabase/migrations/202605250005_notification_dismissals_and_push_rpc.sql
supabase/migrations/202605270001_social_notifications.sql
```

Then insert the first admin with a privileged SQL role or Supabase service role:

```sql
insert into public.admin_users (user_id, role)
values ('your-auth-user-id', 'super_admin');
```

Admin roles:

- `super_admin`: can manage admin users and all admin areas.
- `admin`: can manage users, reports, feedback, and notifications.
- `moderator`: can review moderation queues.

The admin app includes dashboard metrics, user management, report moderation, feedback review, notification history, protected routes, loading states, empty states, confirmation dialogs, and toast notifications.

Disable, ban, and soft-delete actions update `profiles.account_status`. The migration adds restrictive RLS checks so non-active accounts lose database access while admins can still review and recover records.

## Known Issues

- Location data is sensitive. RLS must stay enabled on all Supabase tables before using production data.
- Exact location visibility should be reviewed carefully. Public nearby discovery should use approximate coordinates where possible.
- Realtime subscriptions are scoped in the client, but database policies remain the source of truth for access control.

## Future Improvements

- Add end-to-end tests for auth, friend requests, location sharing, and chat flows.
- Extend push notifications to messages and friend requests.
- Add Supabase Edge Functions for server-side location filtering.
- Add profile blocking and reporting.
- Add screenshot assets to the README.
