/**
 * Script to clear tracks table (optional - only if you want to remove track visibility management)
 * 
 * Usage:
 *   tsx scripts/clear-tracks-table.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('   This script requires service role key to clear data');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function clearTracks() {
  console.log('🧹 Clearing tracks table...\n');

  try {
    const { error, data } = await supabase
      .from('tracks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (error) {
      console.error('❌ Error clearing tracks:', error);
      process.exit(1);
    } else {
      console.log(`✅ Cleared ${data?.length || 0} tracks`);
      console.log('\n📝 Note: Tracks table is used for track visibility management.');
      console.log('   If you want to keep this functionality, you can add tracks back');
      console.log('   via the admin panel or by creating contests.');
      console.log('\n   If you want to remove track visibility entirely, you can:');
      console.log('   1. Delete the tracks table');
      console.log('   2. Remove TrackManagement component');
      console.log('   3. Remove tracks tab from admin page');
    }
  } catch (error) {
    console.error('❌ Error clearing tracks:', error);
    process.exit(1);
  }
}

clearTracks();

