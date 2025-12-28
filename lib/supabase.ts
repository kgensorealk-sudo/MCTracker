import { createClient } from '@supabase/supabase-js';

// User provided credentials
const FALLBACK_URL = 'https://xuowcacfxqikysuxuojs.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1b3djYWNmeHFpa3lzdXh1b2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjE5MjIsImV4cCI6MjA4MjM5NzkyMn0.wF1cfXz6fd-gOS5MUy0DXeTIij0f-lkahM11SJESumw';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

// Check if we have valid keys
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables missing. App will run in setup mode.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);