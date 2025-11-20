/**
 * Debug Horse Processing - Isolate horse creation issues
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getCommonDb } from '../utils/mongodb';

export const debugHorsesRouter = Router();

/**
 * GET /api/debug/horses/test-create
 * Test creating a single horse manually
 */
debugHorsesRouter.get('/test-create', async (req: Request, res: Response) => {
  try {
    console.log('🐎 Testing manual horse creation');
    
    // Try to create a simple horse
    const { data: horse, error } = await supabase
      .from('horses')
      .insert({
        name: 'Test Horse',
        foaling_year: 2020,
        sex: 'colt'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Horse creation error:', error);
      return res.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        hint: error.hint
      });
    }
    
    console.log('Created test horse:', horse.id);
    
    res.json({
      success: true,
      horse: horse,
      message: "Manual horse creation successful"
    });
    
  } catch (error) {
    console.error('Test horse creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/horses/extract-from-mongo/:track/:date
 * Test extracting horse data from MongoDB without inserting
 */
debugHorsesRouter.get('/extract-from-mongo/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    console.log(`🔍 Extracting horse data from MongoDB: ${track} ${date}`);
    
    const db = await getCommonDb();
    const collection = db.collection('equibase_entries');
    
    const dateObj = new Date(date);
    const mongoEntries = await collection.find({
      raceDate: {
        $gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
        $lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1)
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
    }).limit(2).toArray(); // Just get 2 races for testing
    
    const extractedHorses = [];
    
    for (const raceDoc of mongoEntries) {
      if (!raceDoc.starters || !Array.isArray(raceDoc.starters)) continue;
      
      console.log(`Processing race ${raceDoc.raceNumber} with ${raceDoc.starters.length} starters`);
      
      for (const starter of raceDoc.starters) {
        if (starter.horse?.name) {
          const horseData = {
            name: starter.horse.name,
            foaling_year: starter.horse.foalingDate ? new Date(starter.horse.foalingDate).getFullYear() : null,
            sex: starter.horse.sex?.trim(),
            color: starter.horse.color?.trim(),
            sire_name: starter.sire?.name || null,
            
            // Debug info
            rawHorseObject: starter.horse,
            rawSireObject: starter.sire
          };
          
          extractedHorses.push(horseData);
        }
      }
    }
    
    res.json({
      success: true,
      racesProcessed: mongoEntries.length,
      horsesExtracted: extractedHorses.length,
      sampleHorses: extractedHorses.slice(0, 5),
      uniqueHorseNames: [...new Set(extractedHorses.map(h => h.name))].slice(0, 10),
      message: "Horse extraction from MongoDB successful"
    });
    
  } catch (error) {
    console.error('Horse extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/debug/horses/insert-batch  
 * Test inserting a batch of horses
 */
debugHorsesRouter.post('/insert-batch', async (req: Request, res: Response) => {
  try {
    console.log('🐎 Testing batch horse insertion');
    
    const testHorses = [
      {
        name: 'Test Horse 1',
        foaling_year: 2020,
        sex: 'F',
        color: 'BAY'
      },
      {
        name: 'Test Horse 2', 
        foaling_year: 2021,
        sex: 'C',
        color: 'CHESTNUT'
      }
    ];
    
    const { data: insertedHorses, error } = await supabase
      .from('horses')
      .upsert(testHorses, {
        onConflict: 'name,foaling_year',
        ignoreDuplicates: true
      })
      .select();
    
    if (error) {
      console.error('Batch horse insert error:', error);
      return res.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details
      });
    }
    
    console.log(`Inserted ${insertedHorses?.length || 0} horses`);
    
    res.json({
      success: true,
      horsesInserted: insertedHorses?.length || 0,
      horses: insertedHorses,
      message: "Batch horse insertion successful"
    });
    
  } catch (error) {
    console.error('Batch horse test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
