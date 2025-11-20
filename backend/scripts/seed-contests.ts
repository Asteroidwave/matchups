/**
 * Seed script to add initial contests to Supabase
 * Run this once to migrate hardcoded contests to database
 */

import { supabase } from '../src/utils/supabase';

async function seedContests() {
  if (!supabase) {
    console.error('❌ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  console.log('🌱 Seeding contests to Supabase...');

  const contestsToSeed = [
    {
      track: 'BAQ',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
    {
      track: 'CD',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
    {
      track: 'DMR',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
    {
      track: 'GP',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
    {
      track: 'LRL',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
    {
      track: 'MNR',
      date: '2025-11-02',
      contest_type: 'jockey_vs_jockey',
      entry_fee: 0,
      prize_pool: 0,
      is_active: true,
    },
  ];

  try {
    // Check if contests already exist
    const { data: existing } = await supabase
      .from('contests')
      .select('track, date')
      .eq('date', '2025-11-02');

    if (existing && existing.length > 0) {
      console.log(`⚠️  ${existing.length} contests already exist for 2025-11-02. Skipping seed.`);
      console.log('   To re-seed, delete existing contests in Supabase first.');
      return;
    }

    // Insert contests
    const { data, error } = await supabase
      .from('contests')
      .insert(contestsToSeed)
      .select();

    if (error) {
      console.error('❌ Error seeding contests:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} contests to Supabase!`);
    console.log('   Contests are now available in the lobby.');
  } catch (err) {
    console.error('❌ Exception seeding contests:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedContests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seedContests };

