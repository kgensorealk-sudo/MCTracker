import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we have valid keys
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.log('Supabase environment variables missing. App running in Offline/Demo mode.');
}

// Initialize Supabase client
// Use a placeholder URL if not configured to prevent runtime crashes during initialization
// The app logic (App.tsx, dataService.ts) guards against using this instance if !isSupabaseConfigured
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');