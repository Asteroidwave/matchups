/**
 * Script to clear all cached data from Redis and Supabase
 * 
 * Usage:
 *   tsx scripts/clear-cache.ts
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

async function clearCache() {
  console.log('🧹 Clearing all cached data...\n');

  try {
    // Clear contests first (to test fresh flow)
    console.log('📊 Clearing contests table...');
    const { error: contestsError, data: contestsData } = await supabase
      .from('contests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (contestsError) {
      console.error('❌ Error clearing contests:', contestsError);
    } else {
      console.log(`✅ Cleared ${contestsData?.length || 0} contests`);
    }

    // Clear track_data table
    console.log('📊 Clearing track_data table...');
    const { error: trackDataError, data: trackDataData } = await supabase
      .from('track_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (trackDataError) {
      console.error('❌ Error clearing track_data:', trackDataError);
    } else {
      console.log(`✅ Cleared ${trackDataData?.length || 0} track_data entries`);
    }

    // Clear matchups table
    console.log('📊 Clearing matchups table...');
    const { error: matchupsError, data: matchupsData } = await supabase
      .from('matchups')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (matchupsError) {
      console.error('❌ Error clearing matchups:', matchupsError);
    } else {
      console.log(`✅ Cleared ${matchupsData?.length || 0} matchups`);
    }

    // Clear operations table
    console.log('📊 Clearing operations table...');
    const { error: operationsError, data: operationsData } = await supabase
      .from('operations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (operationsError) {
      console.error('❌ Error clearing operations:', operationsError);
    } else {
      console.log(`✅ Cleared ${operationsData?.length || 0} operations`);
    }

    console.log('\n✅ Supabase cache clearing complete!');
    
    // Note about Redis cache
    console.log('\n📝 Redis/Upstash Cache:');
    console.log('   The script uses service role key (no user session), so it cannot');
    console.log('   automatically clear Redis cache via backend API.');
    console.log('\n   To clear Redis cache, run:');
    console.log('   npx tsx scripts/clear-redis.ts');
    console.log('\n   Or manually via Upstash Dashboard: https://console.upstash.com/');

    console.log('\n🎯 Ready to test fresh flow:');
    console.log('   1. Fetch track data from MongoDB');
    console.log('   2. Preview track stats');
    console.log('   3. Create contest');
    console.log('   4. Set matchup types with per-type settings');
    console.log('   5. Calculate matchups');
    console.log('   6. Enable contest visibility');
    console.log('   7. Contest appears in lobby');
    
    console.log('\n📝 Alternative: Clear Redis cache manually');
    console.log('   - Via Upstash Dashboard: https://console.upstash.com/');
    console.log('   - Via Backend API: POST /api/admin/contests/cache/clear (requires admin token)');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

clearCache();

