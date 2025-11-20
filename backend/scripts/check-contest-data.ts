import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabase, initializeSupabase } from '../src/utils/supabase';
import { getEquibaseEntries } from '../src/utils/mongodb';

initializeSupabase();

async function checkContestData(contestId: string) {
  try {
    // Get contest details
    const { data: contestData, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();

    if (contestError || !contestData) {
      console.error('Contest not found:', contestId);
      return;
    }

    const contest = contestData as any;

    console.log('\n📊 Contest Info:');
    console.log(`Track: ${contest.track}`);
    console.log(`Date: ${contest.date}`);
    console.log(`Status: ${contest.status}`);
    console.log(`Track Data ID: ${contest.track_data_id || 'none'}`);

    // Fetch entries from MongoDB (match raceNameForDB pattern e.g. IND-2025-11-10-*)
    const entriesCollection = await getEquibaseEntries();
    const regex = `^${contest.track}-${contest.date}-`;
    const raceDocs = await entriesCollection
      .find({ raceNameForDB: { $regex: regex } })
      .toArray();
    
    console.log(`\n📊 MongoDB Data:`);
    console.log(`Found ${raceDocs.length} race documents`);

    // Transform to flat records
    const records: any[] = [];
    for (const doc of raceDocs) {
      if (doc.entries && Array.isArray(doc.entries)) {
        doc.entries.forEach((entry: any) => {
          records.push({
            track: doc.track || contest.track,
            date: doc.raceDate,
            race: doc.raceNumber,
            ...entry
          });
        });
      }
    }

    console.log(`Total records: ${records.length}`);

    // Count unique connections
    const jockeys = new Set(records.filter(r => r.jockey && !r.scratched).map(r => r.jockey));
    const trainers = new Set(records.filter(r => r.trainer && !r.scratched).map(r => r.trainer));
    const sires = new Set([
      ...records.filter(r => r.sire1 && !r.scratched).map(r => r.sire1),
      ...records.filter(r => r.sire2 && !r.scratched).map(r => r.sire2)
    ]);

    console.log(`\n📊 Unique Connections (non-scratched):`);
    console.log(`Jockeys: ${jockeys.size}`);
    console.log(`Trainers: ${trainers.size}`);
    console.log(`Sires: ${sires.size}`);
    
    // Show sample sires
    console.log('\n📊 Sample Sires:');
    const sireList = Array.from(sires);
    console.log(sireList.slice(0, 10));

    // Count by appearances
    const jockeyApps = new Map<string, number>();
    const trainerApps = new Map<string, number>();
    const sireApps = new Map<string, number>();

    records.filter(r => !r.scratched).forEach(r => {
      if (r.jockey) {
        jockeyApps.set(r.jockey, (jockeyApps.get(r.jockey) || 0) + 1);
      }
      if (r.trainer) {
        trainerApps.set(r.trainer, (trainerApps.get(r.trainer) || 0) + 1);
      }
      if (r.sire1) {
        sireApps.set(r.sire1, (sireApps.get(r.sire1) || 0) + 1);
      }
      if (r.sire2) {
        sireApps.set(r.sire2, (sireApps.get(r.sire2) || 0) + 1);
      }
    });

    console.log(`\n📊 Connections with ≥ 2 appearances:`);
    console.log(`Jockeys: ${Array.from(jockeyApps.values()).filter(apps => apps >= 2).length}`);
    console.log(`Trainers: ${Array.from(trainerApps.values()).filter(apps => apps >= 2).length}`);
    console.log(`Sires: ${Array.from(sireApps.values()).filter(apps => apps >= 2).length}`);

    // Check matchup data
    const { data: matchupsData } = await supabase
      .from('matchups')
      .select('matchup_type, matchup_data')
      .eq('contest_id', contestId);

    if (matchupsData) {
      console.log(`\n📊 Stored Matchup Stats:`);
      for (const row of matchupsData as any[]) {
        if (row.matchup_data?.stats) {
          const stats = row.matchup_data.stats;
          console.log(`\n${stats.typeLabel}:`);
          console.log(`  - Unique: ${stats.uniqueConnections}`);
          console.log(`  - Eligible: ${stats.eligibleConnections}`);
          console.log(`  - Generated: ${stats.generated}`);
          console.log(`  - Min Salary: ${stats.minSalary}`);
          console.log(`  - Min Apps Enabled: ${stats.applyMinAppearances ? `Yes (≥ ${stats.minAppearances})` : 'No'}`);
        }
      }
    }

  } catch (error) {
    console.error('Error checking contest data:', error);
  } finally {
    // Connection closes automatically when process exits.
  }
}

// Get contest ID from command line
const contestId = process.argv[2];
if (!contestId) {
  console.error('Usage: npm run check-contest <contest-id>');
  process.exit(1);
}

checkContestData(contestId);
