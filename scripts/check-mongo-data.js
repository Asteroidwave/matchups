#!/usr/bin/env node

/**
 * Check what data exists in MongoDB
 * Helps identify available track/date combinations
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../backend/.env' });

async function checkMongoData() {
  console.log('🔍 Checking MongoDB Data Availability');
  console.log('=====================================\n');

  let client;
  
  try {
    // Connect to MongoDB
    client = new MongoClient(process.env.MONGODB_URI_COMMON);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('test');
    
    // Check equibase_entries collection
    console.log('1️⃣ Checking equibase_entries collection');
    console.log('-----------------------------------------');
    
    const entriesCollection = db.collection('equibase_entries');
    
    // Get unique track/date combinations
    const trackDateCombos = await entriesCollection.aggregate([
      {
        $group: {
          _id: { track: "$track", date: "$date" },
          count: { $sum: 1 },
          races: { $addToSet: "$race" }
        }
      },
      { $sort: { "_id.date": -1, "_id.track": 1 } },
      { $limit: 20 } // Show latest 20 combinations
    ]).toArray();
    
    if (trackDateCombos.length === 0) {
      console.log('❌ No entries found in equibase_entries collection');
    } else {
      console.log(`📊 Found ${trackDateCombos.length} track/date combinations:\n`);
      
      trackDateCombos.forEach(combo => {
        const raceCount = combo.races.length;
        console.log(`  🏁 ${combo._id.track} on ${combo._id.date}: ${combo.count} entries across ${raceCount} races`);
      });
    }
    
    // Check equibase_results collection
    console.log('\n2️⃣ Checking equibase_results collection');
    console.log('-----------------------------------------');
    
    const resultsCollection = db.collection('equibase_results');
    const resultsCombos = await resultsCollection.aggregate([
      {
        $group: {
          _id: { track: "$track", date: "$date" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": -1, "_id.track": 1 } },
      { $limit: 10 }
    ]).toArray();
    
    if (resultsCombos.length === 0) {
      console.log('❌ No results found in equibase_results collection');
    } else {
      console.log(`📊 Found ${resultsCombos.length} track/date combinations with results:\n`);
      
      resultsCombos.forEach(combo => {
        console.log(`  🏆 ${combo._id.track} on ${combo._id.date}: ${combo.count} results`);
      });
    }
    
    // Sample data format check
    console.log('\n3️⃣ Sample Data Format Check');
    console.log('----------------------------');
    
    const sampleEntry = await entriesCollection.findOne({}, { limit: 1 });
    if (sampleEntry) {
      console.log('📋 Sample entry structure:');
      console.log(`  Track: ${sampleEntry.track}`);
      console.log(`  Date: ${sampleEntry.date}`);
      console.log(`  Race: ${sampleEntry.race || sampleEntry.race_number || 'N/A'}`);
      console.log(`  Horse: ${sampleEntry.horse || sampleEntry.horseName || 'N/A'}`);
      console.log(`  Jockey: ${sampleEntry.jockey || 'N/A'}`);
      console.log(`  Trainer: ${sampleEntry.trainer || 'N/A'}`);
      console.log(`  Full keys: ${Object.keys(sampleEntry).join(', ')}`);
    }
    
    // Suggestions
    console.log('\n💡 Suggestions for Testing');
    console.log('--------------------------');
    
    if (trackDateCombos.length > 0) {
      const latest = trackDateCombos[0];
      console.log(`Try ingesting: ${latest._id.track} on ${latest._id.date}`);
      console.log(`Command: curl -X POST "http://localhost:3001/api/v2/data/ingest/${latest._id.track}/${latest._id.date}"`);
      
      if (trackDateCombos.length > 1) {
        const second = trackDateCombos[1];
        console.log(`Or try: curl -X POST "http://localhost:3001/api/v2/data/ingest/${second._id.track}/${second._id.date}"`);
      }
    } else {
      console.log('❌ No data found. Check your MongoDB connection and data.');
    }
    
  } catch (error) {
    console.error('❌ Error checking MongoDB:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run the check
checkMongoData().catch(console.error);
