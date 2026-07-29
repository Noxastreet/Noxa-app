import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

import { requireClientEnv } from '@/src/config/env';

const { supabaseUrl, supabasePublishableKey } = requireClientEnv();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
