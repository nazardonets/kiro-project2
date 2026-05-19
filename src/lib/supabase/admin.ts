import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service role key.
 * Used by cron jobs and server-side operations that need to bypass RLS.
 *
 * IMPORTANT: This client has full database access. Only use in trusted
 * server-side contexts (cron jobs, webhooks, admin operations).
 */
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
