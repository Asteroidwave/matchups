/**
 * MATCHUP GENERATION ANALYZER
 * Test current system with GP track data to identify bottlenecks
 */

import { Connection, Matchup } from "@/types";
import { generateMatchups } from "./matchups";

interface AnalysisResult {
  totalConnections: number;
  eligibleConnections: number;
  eligibilityFiltered: Connection[];
  salaryRange: { min: number; max: number; avg: number };
  appsRange: { min: number; max: number; avg: number };
  pointsRange: { min: number; max: number; avg: number };
  generateWithTolerance: (tolerance: number) => {
    matchups: Matchup[];
    attempts: number;
    maxSalaryDiff: number;
    avgSalaryDiff: number;
  };
}

// GP Track sample data from your file
const GP_SAMPLE_DATA = [
  { track: "GP", race: 1, horse: "Lao Way", jockey: "Anthony Thomas", trainer: "Clifton Christie", sire1: "Laoban", salary: 600, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 1, horse: "What It Tiz", jockey: "Miguel Vasquez", trainer: "Amador Sanchez", sire1: "Tiz The Law", salary: 2000, points: 20.2, place: 2, scratched: false },
  { track: "GP", race: 1, horse: "Air Force Royalty", jockey: "Marcos Meneses", trainer: "Michael Yates", sire1: "Air Force Blue", salary: 1500, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 1, horse: "Senor Resplandor (SCR)", jockey: "Richard Bracho", trainer: "Rafael Romero", sire1: "Nyquist", salary: 1000, points: 0.0, place: 0, scratched: true },
  { track: "GP", race: 1, horse: "Milazzo", jockey: "Edgard Zayas", trainer: "Antonio Sano", sire1: "Authentic", salary: 2000, points: 7.1, place: 3, scratched: false },
  { track: "GP", race: 1, horse: "Temperature Rising", jockey: "Luis Fuenmayor", trainer: "S. Bennett", sire1: "Astern (Aus)", salary: 400, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 1, horse: "Accelerate Me", jockey: "Jose Morelos", trainer: "Ronald Coy", sire1: "Accelerate", salary: 900, points: 34.9, place: 1, scratched: false },
  { track: "GP", race: 1, horse: "Battle Anthem", jockey: "Leonel Reyes", trainer: "Jose Garoffalo", sire1: "Munnings", salary: 800, points: 0.0, place: 0, scratched: false },
  
  { track: "GP", race: 2, horse: "Come On Poppi", jockey: "Cipriano Gil", trainer: "Victor Barboza, Jr.", sire1: "Honor A. P.", salary: 1500, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 2, horse: "Adsila", jockey: "Edgar Perez", trainer: "Daniel Hurtak", sire1: "Independence Hall", salary: 1200, points: 22.2, place: 2, scratched: false },
  { track: "GP", race: 2, horse: "Divine Blue", jockey: "Edgard Zayas", trainer: "Antonio Sano", sire1: "Constitution", salary: 700, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 2, horse: "Estrella (SCR)", jockey: "Leonel Reyes", trainer: "Daniel Hurtak", sire1: "Brethren", salary: 1300, points: 0.0, place: 0, scratched: true },
  { track: "GP", race: 2, horse: "Hot Cocoa", jockey: "Micah Husbands", trainer: "Mary Lightner", sire1: "Chance It", salary: 1300, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 2, horse: "Well Shaken", jockey: "Samy Camacho", trainer: "Fernando Abreu", sire1: "Frosted", salary: 1700, points: 9.2, place: 3, scratched: false },
  
  { track: "GP", race: 3, horse: "Stormy Classic", jockey: "Miguel Vasquez", trainer: "Marcial Navarro", sire1: "Classic Empire", salary: 1600, points: 8.5, place: 3, scratched: false },
  { track: "GP", race: 3, horse: "Perfect Excuse", jockey: "Edgar Perez", trainer: "Daniel Hurtak", sire1: "Nyquist", salary: 1100, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 3, horse: "Chief Cicero", jockey: "Edgard Zayas", trainer: "Antonio Sano", sire1: "Constitution", salary: 2200, points: 22.8, place: 2, scratched: false },
  
  { track: "GP", race: 4, horse: "Lady Glamour", jockey: "Samy Camacho", trainer: "Fernando Abreu", sire1: "Frosted", salary: 1800, points: 10.4, place: 3, scratched: false },
  { track: "GP", race: 4, horse: "Russian Heart", jockey: "Jose Morelos", trainer: "Jose Castro", sire1: "Quality Road", salary: 1100, points: 0.0, place: 0, scratched: false },
  
  { track: "GP", race: 5, horse: "Get Ready To Rock", jockey: "Jonathan Ocasio", trainer: "Andy Williams", sire1: "More Than Ready", salary: 600, points: 0.0, place: 0, scratched: false },
  { track: "GP", race: 5, horse: "Triumphant Road", jockey: "Jose Morelos", trainer: "Jose Castro", sire1: "Quality Road", salary: 1300, points: 8.0, place: 3, scratched: false },
  { track: "GP", race: 5, horse: "Lookin For Roses", jockey: "Micah Husbands", trainer: "Saffie Joseph, Jr.", sire1: "Lookin At Lucky", salary: 1700, points: 20.6, place: 2, scratched: false },
  
  { track: "GP", race: 6, horse: "Zany (SCR)", jockey: "Edgard Zayas", trainer: "Todd Pletcher", sire1: "American Pharoah", salary: 2000, points: 0.0, place: 0, scratched: true },
  { track: "GP", race: 6, horse: "Trill", jockey: "Jonathan Ocasio", trainer: "Heather Smullen", sire1: "Audible", salary: 1300, points: 0.0, place: 0, scratched: false },
];

// Generate connections from GP data (mimicking your mergeTrackData function)
function createGPConnections(data: typeof GP_SAMPLE_DATA, role: 'jockey' | 'trainer' | 'sire'): Connection[] {
  const connectionMap = new Map<string, Connection>();

  for (const record of data) {
    if (record.scratched) continue; // Skip scratched horses
    
    let name: string | null = null;
    if (role === 'jockey') name = record.jockey;
    else if (role === 'trainer') name = record.trainer;
    else if (role === 'sire') name = record.sire1;
    
    if (!name) continue;

    const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${role}`;
    let conn = connectionMap.get(id);

    if (!conn) {
      conn = {
        id,
        name,
        role,
        trackSet: ["GP"],
        apps: 0,
        avgOdds: 0,
        salarySum: 0,
        pointsSum: 0,
        avpa30d: 0,
        avpaRace: 0,
        starters: [],
      };
      connectionMap.set(id, conn);
    }

    // Add starter
    const starter = {
      track: record.track,
      race: record.race,
      horseName: record.horse,
      jockey: record.jockey,
      trainer: record.trainer,
      sire1: record.sire1,
      salary: record.salary || 0,
      points: record.points || 0,
      pos: record.place || 0,
      scratched: record.scratched || false,
      program_number: null,
      mlOddsFrac: null,
      decimalOdds: null,
      sire2: null,
    };

    conn.starters.push(starter);
    conn.apps++;
    conn.salarySum += record.salary || 0;
    conn.pointsSum += record.points || 0;
    
    // Calculate AVPA Race
    if (conn.salarySum > 0) {
      conn.avpaRace = (1000 * conn.pointsSum) / conn.salarySum;
    }
  }

  return Array.from(connectionMap.values());
}

export function analyzeGPMatchups(): AnalysisResult {
  // Test all three connection types
  const jockeyConnections = createGPConnections(GP_SAMPLE_DATA, 'jockey');
  const trainerConnections = createGPConnections(GP_SAMPLE_DATA, 'trainer');
  const sireConnections = createGPConnections(GP_SAMPLE_DATA, 'sire');

  console.log('=== GP TRACK ANALYSIS ===');
  console.log(`Jockeys: ${jockeyConnections.length}`);
  console.log(`Trainers: ${trainerConnections.length}`);
  console.log(`Sires: ${sireConnections.length}`);

  // Focus on jockeys for main analysis (as that's what user mentioned)
  const connections = jockeyConnections;

  // Current system eligibility filter
  const eligible = connections.filter(c => c.apps >= 2 && c.pointsSum > 0);

  console.log(`\n=== ELIGIBILITY BOTTLENECK ===`);
  console.log(`Total Jockeys: ${connections.length}`);
  console.log(`Eligible (apps >= 2 AND points > 0): ${eligible.length}`);
  
  // Show what's being filtered out
  const filtered = connections.filter(c => !(c.apps >= 2 && c.pointsSum > 0));
  console.log(`Filtered out: ${filtered.length}`);
  
  filtered.forEach(c => {
    console.log(`  - ${c.name}: ${c.apps} apps, ${c.pointsSum} points, $${c.salarySum} salary`);
  });

  // Calculate ranges
  const salaries = connections.map(c => c.salarySum);
  const apps = connections.map(c => c.apps);
  const points = connections.map(c => c.pointsSum);

  const salaryRange = {
    min: Math.min(...salaries),
    max: Math.max(...salaries),
    avg: salaries.reduce((a, b) => a + b, 0) / salaries.length
  };

  const appsRange = {
    min: Math.min(...apps),
    max: Math.max(...apps),
    avg: apps.reduce((a, b) => a + b, 0) / apps.length
  };

  const pointsRange = {
    min: Math.min(...points),
    max: Math.max(...points),
    avg: points.reduce((a, b) => a + b, 0) / points.length
  };

  console.log(`\n=== RANGES ===`);
  console.log(`Salary: $${salaryRange.min} - $${salaryRange.max} (avg: $${Math.round(salaryRange.avg)})`);
  console.log(`Apps: ${appsRange.min} - ${appsRange.max} (avg: ${Math.round(appsRange.avg * 10) / 10})`);
  console.log(`Points: ${pointsRange.min} - ${pointsRange.max} (avg: ${Math.round(pointsRange.avg * 10) / 10})`);

  // Test different tolerances
  const generateWithTolerance = (tolerance: number) => {
    const matchups = generateMatchups(connections, { count: 10, tolerance });
    
    // Calculate salary differences
    const salaryDiffs = matchups.map(m => 
      Math.abs(m.setA.salaryTotal - m.setB.salaryTotal)
    );

    return {
      matchups,
      attempts: 500, // Max attempts from current system
      maxSalaryDiff: salaryDiffs.length > 0 ? Math.max(...salaryDiffs) : 0,
      avgSalaryDiff: salaryDiffs.length > 0 ? salaryDiffs.reduce((a, b) => a + b, 0) / salaryDiffs.length : 0
    };
  };

  return {
    totalConnections: connections.length,
    eligibleConnections: eligible.length,
    eligibilityFiltered: eligible,
    salaryRange,
    appsRange,
    pointsRange,
    generateWithTolerance
  };
}

// Test different optimization strategies
export function testOptimizations() {
  console.log('\n=== TESTING OPTIMIZATION STRATEGIES ===');
  
  const analysis = analyzeGPMatchups();
  const connections = createGPConnections(GP_SAMPLE_DATA, 'jockey');

  // Test 1: Current system
  console.log('\n1. CURRENT SYSTEM (apps >= 2, points > 0)');
  const current = analysis.generateWithTolerance(500);
  console.log(`   Matchups generated: ${current.matchups.length}/10`);
  console.log(`   Avg salary diff: $${Math.round(current.avgSalaryDiff)}`);

  // Test 2: Relaxed eligibility (apps >= 1, points >= 0)
  console.log('\n2. RELAXED ELIGIBILITY (apps >= 1, points >= 0)');
  const relaxedEligible = connections.filter(c => c.apps >= 1 && c.pointsSum >= 0);
  const relaxedMatchups = generateMatchups(relaxedEligible, { count: 10, tolerance: 500 });
  console.log(`   Eligible connections: ${relaxedEligible.length}`);
  console.log(`   Matchups generated: ${relaxedMatchups.length}/10`);

  // Test 3: Higher salary tolerance
  console.log('\n3. HIGHER SALARY TOLERANCE (1000)');
  const highTolerance = analysis.generateWithTolerance(1000);
  console.log(`   Matchups generated: ${highTolerance.matchups.length}/10`);
  console.log(`   Avg salary diff: $${Math.round(highTolerance.avgSalaryDiff)}`);

  // Test 4: Salary-prioritized sorting instead of random
  console.log('\n4. SALARY-PRIORITIZED GENERATION');
  const salaryPrioritized = testSalaryPrioritizedGeneration(connections);
  console.log(`   Matchups generated: ${salaryPrioritized.length}/10`);

  // Test 5: Remove early connection reuse restriction
  console.log('\n5. IMMEDIATE CONNECTION REUSE');
  const reuseMatchups = testImmediateReuse(connections);
  console.log(`   Matchups generated: ${reuseMatchups.length}/10`);
}

// Test salary-prioritized generation instead of random shuffling
function testSalaryPrioritizedGeneration(pool: Connection[]): Matchup[] {
  const eligible = pool.filter(c => c.apps >= 2 && c.pointsSum > 0);
  if (eligible.length < 2) return [];

  // Sort by salary descending (high salary first, as user wants)
  const sortedBySalary = [...eligible].sort((a, b) => b.salarySum - a.salarySum);
  
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  const tolerance = 500;

  for (let i = 0; i < 10 && sortedBySalary.length >= 2; i++) {
    let bestMatchup: Matchup | null = null;
    let bestDiff = Infinity;

    // Try to find best salary match for high-salary connections
    for (let j = 0; j < sortedBySalary.length; j++) {
      const connA = sortedBySalary[j];
      if (usedConnections.has(connA.id)) continue;

      for (let k = j + 1; k < sortedBySalary.length; k++) {
        const connB = sortedBySalary[k];
        if (usedConnections.has(connB.id)) continue;

        // Check horse overlap
        const horsesA = new Set(connA.starters.map(s => s.horseName));
        const horsesB = new Set(connB.starters.map(s => s.horseName));
        let hasOverlap = false;
        for (const horse of horsesA) {
          if (horsesB.has(horse)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        const diff = Math.abs(connA.salarySum - connB.salarySum);
        if (diff <= tolerance && diff < bestDiff) {
          bestMatchup = {
            id: `salary-matchup-${i}`,
            setA: { connections: [connA], salaryTotal: connA.salarySum },
            setB: { connections: [connB], salaryTotal: connB.salarySum }
          };
          bestDiff = diff;
        }
      }
    }

    if (bestMatchup) {
      matchups.push(bestMatchup);
      usedConnections.add(bestMatchup.setA.connections[0].id);
      usedConnections.add(bestMatchup.setB.connections[0].id);
    } else {
      break; // No more valid matches found
    }
  }

  return matchups;
}

// Test immediate connection reuse (remove the i < 5 restriction)
function testImmediateReuse(pool: Connection[]): Matchup[] {
  const eligible = pool.filter(c => c.apps >= 2 && c.pointsSum > 0);
  if (eligible.length < 2) return [];

  const matchups: Matchup[] = [];
  const tolerance = 500;
  const maxAttempts = 1000; // Increase attempts

  for (let i = 0; i < 10; i++) {
    let matchup: Matchup | null = null;
    let attempts = 0;

    while (!matchup && attempts < maxAttempts) {
      attempts++;
      
      // Always allow all connections (remove reuse restriction)
      const candidates = [...eligible].sort(() => Math.random() - 0.5);
      
      if (candidates.length < 2) break;

      const connA = candidates[0];
      const remaining = candidates.slice(1);

      // Find best salary match
      const bestMatch = remaining
        .map(c => ({ conn: c, diff: Math.abs(connA.salarySum - c.salarySum) }))
        .sort((a, b) => a.diff - b.diff)[0];

      if (bestMatch && bestMatch.diff <= tolerance) {
        // Check horse overlap
        const horsesA = new Set(connA.starters.map(s => s.horseName));
        const horsesB = new Set(bestMatch.conn.starters.map(s => s.horseName));
        let hasOverlap = false;
        for (const horse of horsesA) {
          if (horsesB.has(horse)) {
            hasOverlap = true;
            break;
          }
        }

        if (!hasOverlap) {
          matchup = {
            id: `reuse-matchup-${i}`,
            setA: { connections: [connA], salaryTotal: connA.salarySum },
            setB: { connections: [bestMatch.conn], salaryTotal: bestMatch.conn.salarySum }
          };
        }
      }
    }

    if (matchup) {
      matchups.push(matchup);
    }
  }

  return matchups;
}

// Summary function to run all tests
export function runGPAnalysis() {
  console.clear();
  console.log('🏇 ANALYZING GP TRACK MATCHUP GENERATION');
  console.log('==========================================');
  
  const analysis = analyzeGPMatchups();
  testOptimizations();
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('1. ✅ RELAX ELIGIBILITY: Allow apps >= 1 instead of >= 2');
  console.log('2. ✅ INCREASE TOLERANCE: Use 750-1000 instead of 500');
  console.log('3. ✅ PRIORITIZE HIGH SALARY: Sort by salary first, then find matches');
  console.log('4. ✅ REMOVE EARLY REUSE RESTRICTION: Allow all connections immediately');
  console.log('5. ✅ INCREASE MAX ATTEMPTS: Use 1000-2000 instead of 500');
  
  return analysis;
}
