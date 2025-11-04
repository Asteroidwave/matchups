import { NextRequest, NextResponse } from 'next/server';
import { getEquibaseEntries } from '@/lib/mongodb/connection';
import { fractionalToDecimal, isAlsoEligible } from '@/lib/calculations/odds';
import { calculateSalaryBasedOnOdds } from '@/lib/calculations/salary';

/**
 * GET /api/tracks/[track]/entries?date=YYYY-MM-DD
 * 
 * Fetch entries for a specific track and date from MongoDB
 * Returns data in the same format as the static JSON files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { track: string } }
) {
  try {
    const { track } = params;
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    
    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    const entriesCollection = await getEquibaseEntries();
    
    // Query MongoDB for entries matching track and date
    const query = {
      track: track.toUpperCase(),
      date: date,
    };
    
    const entries = await entriesCollection.find(query).toArray();
    
    if (entries.length === 0) {
      return NextResponse.json({
        track: track.toUpperCase(),
        records: [],
        message: 'No entries found for this track and date',
      });
    }
    
    // Transform MongoDB documents to match our TrackData format
    const records = entries.map((entry: any) => {
      // Get odds (try multiple fields)
      const mlOddsFrac = entry.ml_odds_frac || entry.morningLineOdds || entry.odds || null;
      const decimalOdds = entry.ml_odds_decimal || 
                          (mlOddsFrac ? fractionalToDecimal(mlOddsFrac) : null);
      
      // Check if also eligible
      const alsoEligible = isAlsoEligible(entry);
      
      // Calculate salary
      const salary = calculateSalaryBasedOnOdds(decimalOdds, alsoEligible);
      
      return {
        track: entry.track || track.toUpperCase(),
        race: entry.race || 0,
        horse: entry.horse || entry.horseName || '',
        jockey: entry.jockey || null,
        trainer: entry.trainer || null,
        sire1: entry.sire1 || entry.sire_1 || null,
        sire2: entry.sire2 || entry.sire_2 || null,
        ml_odds_frac: mlOddsFrac,
        ml_odds_decimal: decimalOdds,
        is_also_eligible: alsoEligible,
        scratched: entry.scratched === true || entry.scratchIndicator === 'S',
        salary: salary,
        points: entry.points || 0,
        place: entry.place || entry.finishPosition || null,
      };
    });
    
    // Sort by race, then by horse name
    records.sort((a, b) => {
      if (a.race !== b.race) return a.race - b.race;
      return a.horse.localeCompare(b.horse);
    });
    
    return NextResponse.json({
      track: track.toUpperCase(),
      records,
    });
    
  } catch (error) {
    console.error('Error fetching entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

