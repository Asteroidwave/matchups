/**
 * Backend Test Script: Create and Test Contests
 * 
 * This script creates test contests for AQU and GP on November 16, 2025,
 * and tests global exclusion and quality tuning features.
 * 
 * Run with: ts-node backend/scripts/test-contests.ts
 * Or compile and run: npm run build && node dist/scripts/test-contests.js
 */

import { supabase } from '../src/utils/supabase';
import { calculateContestMatchups } from '../src/services/matchupCalculation';

const TEST_DATE = '2025-11-16';
const TRACKS = ['AQU', 'GP'];

/**
 * Get all contests
 */
async function getContests() {
  const { data, error } = await supabase
    .from('contests')
    .select('id, track, date, status, matchup_types, is_active, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching contests:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Delete a contest and its related data
 */
async function deleteContest(contestId: string) {
  // Delete matchups first
  const { error: matchupError } = await supabase
    .from('matchups')
    .delete()
    .eq('contest_id', contestId);
  
  if (matchupError) {
    console.warn(`Warning: Could not delete matchups for contest ${contestId}:`, matchupError);
  }
  
  // Delete the contest
  const { error } = await supabase
    .from('contests')
    .delete()
    .eq('id', contestId);
  
  if (error) {
    console.error(`Error deleting contest ${contestId}:`, error);
    return false;
  }
  
  console.log(`✅ Deleted contest ${contestId}`);
  return true;
}

/**
 * Create a contest
 */
async function createContest(track: string, date: string) {
  // First, try to find existing track_data for this track/date
  const { data: trackData } = await supabase
    .from('track_data')
    .select('id, metadata')
    .eq('track_code', track.toUpperCase())
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1);
  
  let trackDataId = null;
  let firstPostTime: string | null = null;
  let lastPostTime: string | null = null;
  let lockTime: string | null = null;
  
  if (trackData && trackData.length > 0) {
    trackDataId = trackData[0]?.id || null;
    const metadata = trackData[0]?.metadata || {};
    firstPostTime = metadata.first_post_time || 
      (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 
        ? metadata.post_times[0] : null);
    lastPostTime = metadata.last_post_time || 
      (Array.isArray(metadata.post_times) && metadata.post_times.length > 0 
        ? metadata.post_times[metadata.post_times.length - 1] : null);
    lockTime = metadata.lock_time || null;
  }
  
  // Calculate lock time if first post time exists
  if (firstPostTime && !lockTime) {
    const firstDate = new Date(firstPostTime);
    if (!isNaN(firstDate.getTime())) {
      const lockDate = new Date(firstDate.getTime() - 10 * 60 * 1000); // 10 minutes before
      lockTime = lockDate.toISOString();
    }
  }
  
  const { data, error } = await supabase
    .from('contests')
    .insert([{
      track: track.toUpperCase(),
      date,
      contest_type: null,
      entry_fee: null,
      prize_pool: null,
      track_data_id: trackDataId,
      status: 'draft',
      matchup_types: [],
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_post_time: firstPostTime,
      last_post_time: lastPostTime,
      lock_time: lockTime,
      lifecycle_status: firstPostTime ? 'scheduled' : 'pending',
    }])
    .select()
    .single();
  
  if (error) {
    console.error(`Error creating contest for ${track}:`, error);
    return null;
  }
  
  console.log(`✅ Created contest for ${track} on ${date}: ${data.id}`);
  return data;
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Test Script: Global Exclusion & Quality Tuning');
  console.log('='.repeat(60));
  
  // Step 1: Get existing contests
  console.log('\n📋 Step 1: Fetching existing contests...');
  const existingContests = await getContests();
  console.log(`   Found ${existingContests.length} existing contests`);
  
  // Step 2: Optionally delete old contests
  const deleteOld = process.argv.includes('--delete-old');
  if (deleteOld && existingContests.length > 0) {
    console.log('\n🗑️  Step 2: Deleting old contests...');
    for (const contest of existingContests) {
      await deleteContest(contest.id);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } else {
    console.log('\n⏭️  Step 2: Skipping deletion (use --delete-old to enable)');
  }
  
  // Step 3: Create test contests
  console.log(`\n🎯 Step 3: Creating test contests for ${TEST_DATE}...`);
  const newContests = [];
  
  for (const track of TRACKS) {
    const contest = await createContest(track, TEST_DATE);
    if (contest) {
      newContests.push(contest);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  if (newContests.length === 0) {
    console.error('\n❌ Failed to create any contests. Exiting.');
    process.exit(1);
  }
  
  console.log(`\n✅ Created ${newContests.length} contests`);
  
  // Step 4: Set matchup types and trigger calculation
  console.log('\n⚙️  Step 4: Setting matchup types and triggering calculation...');
  console.log('   (This will test global exclusion - connections should not repeat across types)');
  console.log('   (Check logs for quality metrics)');
  
  const matchupTypes = ['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed'];
  const calculationSettings = {
    jockey_vs_jockey: { count: 10, tolerance: 1000 },
    trainer_vs_trainer: { count: 10, tolerance: 1000 },
    sire_vs_sire: { count: 10, tolerance: 1000 },
    mixed: { count: 15, tolerance: 1000 },
  };
  
  for (const contest of newContests) {
    console.log(`\n   Processing contest ${contest.id} (${contest.track})...`);
    
    // Update contest with matchup types
    const { error: updateError } = await supabase
      .from('contests')
      .update({
        matchup_types: matchupTypes,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contest.id);
    
    if (updateError) {
      console.error(`   ❌ Error updating contest ${contest.id}:`, updateError);
      continue;
    }
    
    console.log(`   ✅ Set matchup types: ${matchupTypes.join(', ')}`);
    
    // Trigger matchup calculation
    try {
      const result = await calculateContestMatchups(
        contest.id,
        matchupTypes,
        undefined, // No operation ID
        calculationSettings
      );
      
      if (result.success) {
        console.log(`   ✅ Generated ${result.matchupsCount} matchups`);
        if (result.stats) {
          console.log(`   📊 Stats:`, JSON.stringify(result.stats, null, 2));
        }
      } else {
        console.error(`   ❌ Calculation failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`   ❌ Exception during calculation:`, error);
    }
    
    // Wait a bit between contests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Test setup complete!');
  console.log('\n📊 Next steps:');
  console.log('   1. Check backend logs for:');
  console.log('      - "[UnifiedMatchup] Excluded X connections due to global exclusion"');
  console.log('      - "[UnifiedMatchup] ✅ Final Quality Metrics"');
  console.log('      - "[UnifiedMatchup] Tier quality metrics"');
  console.log('      - "[calc-XXX] 🔒 Global Exclusion: X total connections excluded"');
  console.log('   2. Verify in Supabase that matchups are generated');
  console.log('   3. Check that connections don\'t repeat across matchup types');
  console.log('\n🎉 Test completed!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

