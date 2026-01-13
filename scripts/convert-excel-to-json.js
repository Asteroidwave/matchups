/**
 * Script to convert Excel files to JSON for better performance
 * Converts ALL sheets and ALL columns
 * Run with: node scripts/convert-excel-to-json.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');

// Track files to convert
const TRACKS = [
  { code: 'AQU', file: 'AQU_20250101_V11_COMPLETE.xlsx' },
  { code: 'SA', file: 'SA_20250101_V11_COMPLETE.xlsx' },
  { code: 'GP', file: 'GP_20250101_V11_COMPLETE.xlsx' },
  { code: 'DMR', file: 'DMR_20250101_V11_COMPLETE.xlsx' },
  { code: 'PRX', file: 'PRX_20250101_V11_COMPLETE.xlsx' },
  { code: 'PEN', file: 'PEN_20250101_V11_COMPLETE.xlsx' },
  { code: 'LRL', file: 'LRL_20250101_V11_COMPLETE.xlsx' },
  { code: 'MVR', file: 'MVR_20250101_V11_COMPLETE.xlsx' },
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function parseDate(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    // Excel date serial number
    const excelDate = XLSX.SSF.parse_date_code(value);
    return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
  }
  return String(value);
}

function convertExcelToJson(trackCode, excelFile) {
  const filePath = path.join(DATA_DIR, excelFile);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${excelFile}`);
    return null;
  }
  
  console.log(`📄 Converting ${excelFile}...`);
  
  const workbook = XLSX.readFile(filePath);
  const result = {
    trackCode,
    horses: [],
    dates: [],
    // Daily connection data (per date)
    dailyJockeys: [],
    dailyTrainers: [],
    dailySires: [],
    // Overall stats (aggregated across all dates)
    jockeyStats: [],
    trainerStats: [],
    sireStats: [],
    horseStats: [],
    // Odds bucket analysis
    oddsBucketAnalysis: []
  };
  
  // ========== PARSE HORSES SHEET ==========
  const horsesSheet = workbook.Sheets['Horses'];
  if (horsesSheet) {
    const horsesRaw = XLSX.utils.sheet_to_json(horsesSheet);
    const dateSet = new Set();
    
    result.horses = horsesRaw.map(row => {
      const date = parseDate(row['Date']);
      if (date) dateSet.add(date);
      
      const horseName = row['Horse'] || '';
      const ogSalary = Number(row['OG Sal.']) || 0;
      const newSalary = Number(row['New Sal.']) || 0;
      const salary = newSalary > 0 ? newSalary : ogSalary;
      const isScratched = horseName.includes('(SCR)') || (ogSalary > 0 && salary === 0);
      
      return {
        date,
        race: row['Race'] || 0,
        horse: horseName,
        pp: row['PP'] || 0,
        jockey: row['Jockey'] || '',
        trainer: row['Trainer'] || '',
        sire1: row['Sire 1'] || '',
        sire2: row['Sire 2'] || '',
        // Odds
        mlOdds: String(row['OG M/L'] || ''),
        mlOddsDecimal: Number(row['OG M/L Dec']) || 0,
        newMlOdds: String(row['New M/L'] || ''),
        newMlOddsDecimal: Number(row['New M/L Dec']) || 0,
        finalOdds: Number(row['Final Odds']) || 0,
        oddsMovement: Number(row['Odds Mvmt']) || 0,
        oddsDrift: Number(row['Odds Drift %']) || 0,
        favorite: row['Favorite'] === 'Yes',
        // Salary
        ogSalary,
        salary,
        scratchAmount: Number(row['Scr Amount']) || 0,
        // Probabilities
        ogProb: Number(row['OG Prob.']) || 0,
        adjProb: Number(row['Adj. Prob.']) || 0,
        // Results
        finish: row['Finish'] || 0,
        winPayoff: Number(row['Win Payoff']) || 0,
        placePayoff: Number(row['Place Payoff']) || 0,
        showPayoff: Number(row['Show Payoff']) || 0,
        moneyWon: Number(row['Money Won']) || 0,
        // Points
        totalPoints: Number(row['Total Points']) || 0,
        pointsWithScrAdj: Number(row['Points W Scr Adj']) || 0,
        // AVPA
        avpa: Number(row['AVPA']) || 0,
        raceAvpa: Number(row['Race AVPA']) || 0,
        dayAvpa: Number(row['Day AVPA']) || 0,
        trackAvpa: Number(row['Track AVPA']) || 0,
        racePctDiff: Number(row['Race % Diff']) || 0,
        dayPctDiff: Number(row['Day % Diff']) || 0,
        trackPctDiff: Number(row['Track % Diff']) || 0,
        // Race conditions
        fieldSize: row['Field Size'] || 0,
        weather: row['Weather'] || '',
        temp: row['Temp'] || 0,
        surface: row['Surface'] || '',
        trackCondition: row['Track Cond.'] || '',
        distance: row['Distance'] || 0,
        // Running data
        runningStyle: row['Running Style'] || '',
        yardsGained: Number(row['Yards Gained']) || 0,
        tripNotes: row['Trip Notes'] || '',
        hadTrouble: row['Had Trouble'] === 'Yes',
        troubleTypes: row['Trouble Types'] || '',
        // Timing
        frac1: row['Frac 1'] || '',
        frac2: row['Frac 2'] || '',
        frac3: row['Frac 3'] || '',
        finalTime: row['Final Time'] || '',
        isScratched,
      };
    }).filter(h => h.horse && h.date);
    
    result.dates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));
    console.log(`   Horses: ${result.horses.length} entries across ${result.dates.length} dates`);
  }
  
  // ========== PARSE JOCKEYS SHEET (Daily) ==========
  const jockeysSheet = workbook.Sheets['Jockeys'];
  if (jockeysSheet) {
    const jockeysRaw = XLSX.utils.sheet_to_json(jockeysSheet);
    result.dailyJockeys = jockeysRaw.map(row => ({
      date: parseDate(row['Date']),
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      ogAvgOdds: Number(row['OG Avg. Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      scrAdjPct: Number(row['Scr. Adj. %']) || 0,
      newSalary: Number(row['New Sal.']) || 0,
      newAvgOdds: Number(row['New Avg. Odds']) || 0,
      newApps: Number(row['New Apps']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      pointsWithScrAdj: Number(row['Points W Scr Adj']) || 0,
      avpa: Number(row['AVPA']) || 0,
      dayAvpa: Number(row['Day AVPA']) || 0,
      trackAvpa: Number(row['Track AVPA']) || 0,
      dayPctDiff: Number(row['Day % Diff']) || 0,
      trackPctDiff: Number(row['Track % Diff']) || 0,
      wins: Number(row['Win']) || 0,
      places: Number(row['Place']) || 0,
      shows: Number(row['Show']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg. Finish']) || 0,
      avgFieldSize: Number(row['Avg. Field Size']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(j => j.name);
    console.log(`   Daily Jockeys: ${result.dailyJockeys.length} entries`);
  }
  
  // ========== PARSE TRAINERS SHEET (Daily) ==========
  const trainersSheet = workbook.Sheets['Trainers'];
  if (trainersSheet) {
    const trainersRaw = XLSX.utils.sheet_to_json(trainersSheet);
    result.dailyTrainers = trainersRaw.map(row => ({
      date: parseDate(row['Date']),
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      ogAvgOdds: Number(row['OG Avg. Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      scrAdjPct: Number(row['Scr. Adj. %']) || 0,
      newSalary: Number(row['New Sal.']) || 0,
      newAvgOdds: Number(row['New Avg. Odds']) || 0,
      newApps: Number(row['New Apps']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      pointsWithScrAdj: Number(row['Points W Scr Adj']) || 0,
      avpa: Number(row['AVPA']) || 0,
      dayAvpa: Number(row['Day AVPA']) || 0,
      trackAvpa: Number(row['Track AVPA']) || 0,
      dayPctDiff: Number(row['Day % Diff']) || 0,
      trackPctDiff: Number(row['Track % Diff']) || 0,
      wins: Number(row['Win']) || 0,
      places: Number(row['Place']) || 0,
      shows: Number(row['Show']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg. Finish']) || 0,
      avgFieldSize: Number(row['Avg. Field Size']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(t => t.name);
    console.log(`   Daily Trainers: ${result.dailyTrainers.length} entries`);
  }
  
  // ========== PARSE SIRES SHEET (Daily) ==========
  const siresSheet = workbook.Sheets['Sires'];
  if (siresSheet) {
    const siresRaw = XLSX.utils.sheet_to_json(siresSheet);
    result.dailySires = siresRaw.map(row => ({
      date: parseDate(row['Date']),
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      ogAvgOdds: Number(row['OG Avg. Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      scrAdjPct: Number(row['Scr. Adj. %']) || 0,
      newSalary: Number(row['New Sal.']) || 0,
      newAvgOdds: Number(row['New Avg. Odds']) || 0,
      newApps: Number(row['New Apps']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      pointsWithScrAdj: Number(row['Points W Scr Adj']) || 0,
      avpa: Number(row['AVPA']) || 0,
      dayAvpa: Number(row['Day AVPA']) || 0,
      trackAvpa: Number(row['Track AVPA']) || 0,
      dayPctDiff: Number(row['Day % Diff']) || 0,
      trackPctDiff: Number(row['Track % Diff']) || 0,
      wins: Number(row['Win']) || 0,
      places: Number(row['Place']) || 0,
      shows: Number(row['Show']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg. Finish']) || 0,
      avgFieldSize: Number(row['Avg. Field Size']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(s => s.name);
    console.log(`   Daily Sires: ${result.dailySires.length} entries`);
  }
  
  // ========== PARSE JOCKEY STATS (Overall) ==========
  const jockeyStatsSheet = workbook.Sheets['Jockey Stats'];
  if (jockeyStatsSheet) {
    const statsRaw = XLSX.utils.sheet_to_json(jockeyStatsSheet);
    result.jockeyStats = statsRaw.map(row => ({
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      starts: Number(row['Starts']) || 0,
      avgOdds: Number(row['Avg Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      newSalary: Number(row['New Salary']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      avpa: Number(row['AVPA']) || 0,
      avpa14d: Number(row['14d AVPA']) || 0,
      avpa30d: Number(row['30d AVPA']) || 0,
      avpa90d: Number(row['90d AVPA']) || 0,
      avpa150d: Number(row['150d AVPA']) || 0,
      avpa180d: Number(row['180d AVPA']) || 0,
      avpa270d: Number(row['270d AVPA']) || 0,
      avpa360d: Number(row['360d AVPA']) || 0,
      wins: Number(row['Wins']) || 0,
      places: Number(row['Places']) || 0,
      shows: Number(row['Shows']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg Finish']) || 0,
      avgField: Number(row['Avg Field']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(j => j.name);
    console.log(`   Jockey Stats: ${result.jockeyStats.length} entries`);
  }
  
  // ========== PARSE TRAINER STATS (Overall) ==========
  const trainerStatsSheet = workbook.Sheets['Trainer Stats'];
  if (trainerStatsSheet) {
    const statsRaw = XLSX.utils.sheet_to_json(trainerStatsSheet);
    result.trainerStats = statsRaw.map(row => ({
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      starts: Number(row['Starts']) || 0,
      avgOdds: Number(row['Avg Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      newSalary: Number(row['New Salary']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      avpa: Number(row['AVPA']) || 0,
      avpa14d: Number(row['14d AVPA']) || 0,
      avpa30d: Number(row['30d AVPA']) || 0,
      avpa90d: Number(row['90d AVPA']) || 0,
      avpa150d: Number(row['150d AVPA']) || 0,
      avpa180d: Number(row['180d AVPA']) || 0,
      avpa270d: Number(row['270d AVPA']) || 0,
      avpa360d: Number(row['360d AVPA']) || 0,
      wins: Number(row['Wins']) || 0,
      places: Number(row['Places']) || 0,
      shows: Number(row['Shows']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg Finish']) || 0,
      avgField: Number(row['Avg Field']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(t => t.name);
    console.log(`   Trainer Stats: ${result.trainerStats.length} entries`);
  }
  
  // ========== PARSE SIRE STATS (Overall) ==========
  const sireStatsSheet = workbook.Sheets['Sire Stats'];
  if (sireStatsSheet) {
    const statsRaw = XLSX.utils.sheet_to_json(sireStatsSheet);
    result.sireStats = statsRaw.map(row => ({
      name: row['Name'] || '',
      ogApps: Number(row['OG Apps']) || 0,
      starts: Number(row['Starts']) || 0,
      avgOdds: Number(row['Avg Odds']) || 0,
      ogSalary: Number(row['OG Salary']) || 0,
      scrAmount: Number(row['Scr Amount']) || 0,
      newSalary: Number(row['New Salary']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      avpa: Number(row['AVPA']) || 0,
      avpa14d: Number(row['14d AVPA']) || 0,
      avpa30d: Number(row['30d AVPA']) || 0,
      avpa90d: Number(row['90d AVPA']) || 0,
      avpa150d: Number(row['150d AVPA']) || 0,
      avpa180d: Number(row['180d AVPA']) || 0,
      avpa270d: Number(row['270d AVPA']) || 0,
      avpa360d: Number(row['360d AVPA']) || 0,
      wins: Number(row['Wins']) || 0,
      places: Number(row['Places']) || 0,
      shows: Number(row['Shows']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      avgFinish: Number(row['Avg Finish']) || 0,
      avgField: Number(row['Avg Field']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
    })).filter(s => s.name);
    console.log(`   Sire Stats: ${result.sireStats.length} entries`);
  }
  
  // ========== PARSE HORSE STATS (Overall) ==========
  const horseStatsSheet = workbook.Sheets['Horse Stats'];
  if (horseStatsSheet) {
    const statsRaw = XLSX.utils.sheet_to_json(horseStatsSheet);
    result.horseStats = statsRaw.map(row => ({
      name: row['Name'] || '',
      totalApps: Number(row['Total Apps']) || 0,
      starts: Number(row['Starts']) || 0,
      scratches: Number(row['Scratches']) || 0,
      avgOdds: Number(row['Avg Odds']) || 0,
      totalPoints: Number(row['Total Points']) || 0,
      totalSalary: Number(row['Total Salary']) || 0,
      avpa: Number(row['AVPA']) || 0,
      avpa14d: Number(row['14d AVPA']) || 0,
      avpa30d: Number(row['30d AVPA']) || 0,
      avpa90d: Number(row['90d AVPA']) || 0,
      avpa150d: Number(row['150d AVPA']) || 0,
      avpa180d: Number(row['180d AVPA']) || 0,
      avpa270d: Number(row['270d AVPA']) || 0,
      avpa360d: Number(row['360d AVPA']) || 0,
      wins: Number(row['Wins']) || 0,
      places: Number(row['Places']) || 0,
      shows: Number(row['Shows']) || 0,
      winPct: Number(row['Win %']) || 0,
      itmPct: Number(row['ITM %']) || 0,
      moneyWon: Number(row['Money Won']) || 0,
      avgFinish: Number(row['Avg Finish']) || 0,
      avgField: Number(row['Avg Field']) || 0,
      mu: Number(row['μ']) || 0,
      variance: Number(row['Var']) || 0,
      sigma: Number(row['σ']) || 0,
      firstRace: parseDate(row['First Race']),
      lastRace: parseDate(row['Last Race']),
    })).filter(h => h.name);
    console.log(`   Horse Stats: ${result.horseStats.length} entries`);
  }
  
  // ========== PARSE ODDS BUCKET ANALYSIS ==========
  const oddsSheet = workbook.Sheets['Odds Bucket Analysis'];
  if (oddsSheet) {
    const oddsRaw = XLSX.utils.sheet_to_json(oddsSheet, { range: 1 }); // Skip header row
    result.oddsBucketAnalysis = oddsRaw
      .filter(row => row['Odds Range'] && row['Odds Range'] !== 'Odds Range')
      .map(row => ({
        oddsRange: row['Odds Range'] || '',
        oddsDec: Number(row['Odds (Dec)']) || 0,
        low: Number(row['Low']) || 0,
        high: Number(row['High']) || 0,
        salary: Number(row['Salary']) || 0,
        numHorses: Number(row['# Horses']) || 0,
        wins: Number(row['Win']) || 0,
        winPct: Number(row['Win %']) || 0,
        places: Number(row['Place']) || 0,
        placePct: Number(row['Place %']) || 0,
        shows: Number(row['Show']) || 0,
        showPct: Number(row['Show %']) || 0,
        dnf: Number(row['DNF']) || 0,
        itmPct: Number(row['ITM %']) || 0,
        totalPts: Number(row['Total Pts']) || 0,
        avgPts: Number(row['Avg Pts']) || 0,
        totalSalary: Number(row['Total Sal']) || 0,
        ptsPerK: Number(row['Pts/$1000']) || 0,
        muRaw: Number(row['μ_raw']) || 0,
        varRaw: Number(row['Var_raw']) || 0,
        sigmaRaw: Number(row['σ_raw']) || 0,
        muSmooth: Number(row['μ_smooth']) || 0,
        varSmooth: Number(row['Var_smooth']) || 0,
        sigmaSmooth: Number(row['σ_smooth']) || 0,
      }));
    console.log(`   Odds Bucket Analysis: ${result.oddsBucketAnalysis.length} entries`);
  }
  
  return result;
}

function main() {
  console.log('🚀 Converting Excel files to JSON (ALL sheets, ALL columns)...\n');
  
  const trackMetadata = {
    tracks: [],
    defaultTrack: 'AQU',
    defaultDate: ''
  };
  
  for (const track of TRACKS) {
    const data = convertExcelToJson(track.code, track.file);
    
    if (data) {
      // Save JSON file
      const outputPath = path.join(OUTPUT_DIR, `${track.code}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(data)); // Minified
      
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Saved ${track.code}.json (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
      
      // Add to metadata
      trackMetadata.tracks.push({
        code: track.code,
        name: getTrackName(track.code),
        dates: data.dates
      });
      
      // Set default date to most recent
      if (data.dates.length > 0 && (!trackMetadata.defaultDate || data.dates[0] > trackMetadata.defaultDate)) {
        trackMetadata.defaultDate = data.dates[0];
      }
    }
  }
  
  // Save updated metadata
  const metadataPath = path.join(DATA_DIR, 'track-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(trackMetadata, null, 2));
  console.log(`✅ Updated track-metadata.json\n`);
  
  console.log('🎉 Conversion complete!');
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

function getTrackName(code) {
  const names = {
    AQU: 'Aqueduct',
    SA: 'Santa Anita',
    GP: 'Gulfstream Park',
    DMR: 'Del Mar',
    PRX: 'Parx Racing',
    PEN: 'Penn National',
    LRL: 'Laurel Park',
    MVR: 'Mountaineer'
  };
  return names[code] || code;
}

main();
