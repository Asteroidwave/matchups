import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;

// Initialize Supabase client (call this after dotenv.config() has run)
export function initializeSupabase() {
  if (supabaseClient !== null) {
    return supabaseClient; // Already initialized
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (supabaseUrl && supabaseServiceKey) {
    // Use service role key for backend operations (bypasses RLS)
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('✅ Supabase backend client initialized');
    return supabaseClient;
  } else {
    console.warn('⚠️ Supabase environment variables are not set. Admin features will not work.');
    console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    console.warn(`   SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    console.warn(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'SET' : 'MISSING'}`);
    return null;
  }
}

// Export getter function that returns the initialized client
export function getSupabase() {
  if (supabaseClient === null) {
    // Auto-initialize if not already done
    initializeSupabase();
  }
  return supabaseClient;
}

// Check if Supabase is initialized
export function isSupabaseInitialized() {
  return supabaseClient !== null;
}

// Export the client using a Proxy for lazy access
// This allows us to check if it's initialized and use it normally
const supabaseProxy = new Proxy({} as ReturnType<typeof createClient> | null, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      // Return null for null checks, but throw for actual usage
      if (prop === 'valueOf' || prop === Symbol.toPrimitive) {
        return null;
      }
      throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return (client as any)[prop];
  }
});

// Export the client (backward compatible)
export const supabase = supabaseProxy as ReturnType<typeof createClient>;

