import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Shared Supabase project with IRASControl for SSO and data integration
const SUPABASE_URL = "https://csbreuztakjctwletdph.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzYnJldXp0YWtqY3R3bGV0ZHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTcxMzksImV4cCI6MjA5MDQ5MzEzOX0.bkWKNlQh2LfhhHVpbUpIljUApCElrISoZGXk4XKhijs";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

