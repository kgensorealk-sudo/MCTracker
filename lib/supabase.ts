import { createClient } from '@supabase/supabase-js';

// Access environment variables or use provided fallbacks
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://xuowcacfxqikysuxuojs.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1b3djYWNmeHFpa3lzdXh1b2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjE5MjIsImV4cCI6MjA4MjM5NzkyMn0.wF1cfXz6fd-gOS5MUy0DXeTIij0f-lkahM11SJESumw';

// Check if we have valid keys (we practically always do now with fallbacks)
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.log('Supabase environment variables missing. App running in Offline/Demo mode.');
}

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);