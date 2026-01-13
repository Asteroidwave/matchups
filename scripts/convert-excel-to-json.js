/**
 * Script to convert Excel files to JSON for better performance
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
    connections: {
      jockeys: [],
      trainers: [],
      sires: []
    }
  };
  
  // Parse Horses sheet
  const horsesSheet = workbook.Sheets['Horses'];
  if (horsesSheet) {
    const horsesRaw = XLSX.utils.sheet_to_json(horsesSheet);
    const dateSet = new Set();
    
    result.horses = horsesRaw.map(row => {
      // Get date and add to set
      let date = '';
      if (row['Date']) {
        if (typeof row['Date'] === 'number') {
          // Excel date serial number
          const excelDate = XLSX.SSF.parse_date_code(row['Date']);
          date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
        } else {
          date = String(row['Date']);
        }
        dateSet.add(date);
      }
      
      // Parse ML odds - check multiple possible column names
      const mlOdds = row['OG M/L'] || row['New M/L'] || row['M/L Odds'] || row['ML Odds'] || '';
      let mlOddsDecimal = row['OG M/L Dec'] || row['New M/L Dec'] || 0;
      
      // If no decimal odds, try to parse from fraction
      if (!mlOddsDecimal && typeof mlOdds === 'string' && mlOdds.includes('/')) {
        const [num, den] = mlOdds.split('/').map(Number);
        mlOddsDecimal = den > 0 ? num / den : 0;
      }
      
      // Get salary - prefer New Sal if available and > 0, otherwise use OG Sal
      const ogSalary = row['OG Sal.'] || row['OG Salary'] || 0;
      const newSalary = row['New Sal.'] || row['New Salary'] || 0;
      const salary = newSalary > 0 ? newSalary : ogSalary;
      
      // Check if scratched (salary becomes 0 or horse name contains SCR)
      const horseName = row['Horse'] || row['Horse Name'] || '';
      const isScratched = horseName.includes('(SCR)') || horseName.includes('SCR') || 
                          row['Scratched'] === true || row['Is Scratched'] === true ||
                          (ogSalary > 0 && salary === 0);
      
      return {
        date,
        race: row['Race'] || row['Race #'] || 0,
        horse: horseName,
        pp: row['PP'] || row['Post Position'] || 0,
        jockey: row['Jockey'] || '',
        trainer: row['Trainer'] || '',
        sire1: row['Sire 1'] || row['Sire'] || '',
        sire2: row['Sire 2'] || row['Dam Sire'] || '',
        mlOdds: String(mlOdds),
        mlOddsDecimal: Number(mlOddsDecimal) || 0,
        salary: Number(salary) || 0,
        finish: row['Finish'] || row['Pos'] || row['Position'] || 0,
        totalPoints: row['Total Points'] || row['Points'] || row['DK Points'] || 0,
        avpa: row['AVPA'] || row['Avg AVPA'] || 0,
        raceAvpa: row['Race AVPA'] || 0,
        trackAvpa: row['Track AVPA'] || 0,
        finalOdds: row['Final Odds'] || mlOddsDecimal || 0,
        isScratched,
      };
    }).filter(h => h.horse && h.date); // Filter out invalid rows
    
    result.dates = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));
    console.log(`   Found ${result.horses.length} horses across ${result.dates.length} dates`);
  }
  
  // Parse Jockeys sheet
  const jockeysSheet = workbook.Sheets['Jockeys'] || workbook.Sheets['Jockey'];
  if (jockeysSheet) {
    const jockeysRaw = XLSX.utils.sheet_to_json(jockeysSheet);
    result.connections.jockeys = jockeysRaw.map(row => ({
      name: row['Jockey'] || row['Name'] || '',
      apps: row['Apps'] || row['Appearances'] || row['Starts'] || 0,
      avgOdds: row['Avg Odds'] || row['AVG Odds'] || 0,
      avpa: row['AVPA'] || row['Avg AVPA'] || 0,
      salary: row['Salary'] || row['Avg Salary'] || 0,
      points: row['Points'] || row['Total Points'] || 0,
      winRate: row['Win %'] || row['Win Rate'] || 0,
      itmRate: row['ITM %'] || row['ITM Rate'] || 0,
    })).filter(j => j.name);
    console.log(`   Found ${result.connections.jockeys.length} jockeys`);
  }
  
  // Parse Trainers sheet
  const trainersSheet = workbook.Sheets['Trainers'] || workbook.Sheets['Trainer'];
  if (trainersSheet) {
    const trainersRaw = XLSX.utils.sheet_to_json(trainersSheet);
    result.connections.trainers = trainersRaw.map(row => ({
      name: row['Trainer'] || row['Name'] || '',
      apps: row['Apps'] || row['Appearances'] || row['Starts'] || 0,
      avgOdds: row['Avg Odds'] || row['AVG Odds'] || 0,
      avpa: row['AVPA'] || row['Avg AVPA'] || 0,
      salary: row['Salary'] || row['Avg Salary'] || 0,
      points: row['Points'] || row['Total Points'] || 0,
      winRate: row['Win %'] || row['Win Rate'] || 0,
      itmRate: row['ITM %'] || row['ITM Rate'] || 0,
    })).filter(t => t.name);
    console.log(`   Found ${result.connections.trainers.length} trainers`);
  }
  
  // Parse Sires sheet
  const siresSheet = workbook.Sheets['Sires'] || workbook.Sheets['Sire'];
  if (siresSheet) {
    const siresRaw = XLSX.utils.sheet_to_json(siresSheet);
    result.connections.sires = siresRaw.map(row => ({
      name: row['Sire'] || row['Name'] || '',
      apps: row['Apps'] || row['Appearances'] || row['Starts'] || 0,
      avgOdds: row['Avg Odds'] || row['AVG Odds'] || 0,
      avpa: row['AVPA'] || row['Avg AVPA'] || 0,
      salary: row['Salary'] || row['Avg Salary'] || 0,
      points: row['Points'] || row['Total Points'] || 0,
      winRate: row['Win %'] || row['Win Rate'] || 0,
      itmRate: row['ITM %'] || row['ITM Rate'] || 0,
    })).filter(s => s.name);
    console.log(`   Found ${result.connections.sires.length} sires`);
  }
  
  return result;
}

function main() {
  console.log('🚀 Converting Excel files to JSON...\n');
  
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
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 0)); // Minified
      
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
