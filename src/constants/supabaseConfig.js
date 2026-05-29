// Expo exposes only EXPO_PUBLIC_* variables to client JavaScript.
// Keep the mobile app and admin dashboard pointed at the same Supabase project
// by setting these values in .env files instead of hard-coding a project here.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

// This is the public anon/publishable key used by the mobile app.
// Never paste a service role key into an Expo or React Native app.
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
