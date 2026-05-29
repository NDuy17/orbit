# Security

Orbit handles authentication, personal profiles, direct messages, and location data. Treat all location-related data as sensitive by default.

## Privacy Policy Draft

Orbit stores the minimum data needed to provide nearby discovery, friend requests, and chat:

- Account identifiers from Supabase Auth.
- Profile data such as display name, username, avatar URL, bio, status, online state, and last active time.
- Location data such as exact latitude/longitude, approximate public latitude/longitude, visibility state, and update time.
- Friend relationships and friend request history.
- Direct messages between users.
- Encounter records for close proximity events.

Users should be able to stop sharing location through Ghost Mode, update or delete profile data, remove friends, and request deletion of account-related records.

## Row Level Security

Row Level Security must remain enabled for:

- `profiles`
- `locations`
- `friends`
- `friend_requests`
- `messages`
- `encounters`

The SQL policies in `supabase/schema.sql` are designed so users can manage their own profile and location, read their own friend graph, act only on requests involving their account, and read or write only messages where they are the sender or receiver.

## Stored Data

- **Kept while account is active**: profile, current location row, friend edges, active requests, messages, and encounter records.
- **Updated frequently**: `locations`, `profiles.is_online`, and `profiles.last_active`.
- **Safe to delete on account removal**: profile, locations, friendships, friend requests, messages sent or received, and encounters involving the user.
- **Do not store in the client**: Supabase service role keys, private admin keys, raw database passwords, or long-lived privileged tokens.

## Location Sharing Warnings

- Ghost Mode should set `locations.is_visible = false`; it should not be treated as account deletion.
- Approximate location is safer for nearby discovery than exact coordinates.
- Exact coordinates should only be visible where the product explicitly needs them, such as trusted friend experiences.
- Client-side filtering is not a security boundary. Enforce access with database RLS.

## Reporting Security Issues

Do not open a public issue for sensitive vulnerabilities. Share reproduction steps, affected tables or screens, and expected impact with the project maintainer privately.
