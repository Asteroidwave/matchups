/**
 * Minimal Debug - Simplest possible test
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getCommonDb } from '../utils/mongodb';

export const debugMinimalRouter = Router();

/**
 * GET /api/debug/minimal/mongo-test
 * Most basic MongoDB test
 */
debugMinimalRouter.get('/mongo-test', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Testing basic MongoDB connection');
    
    const db = await getCommonDb();
    const collection = db.collection('equibase_entries');
    
    // Just count documents
    const totalDocs = await collection.countDocuments();
    console.log(`Total documents: ${totalDocs}`);
    
    // Get one document
    const oneDoc = await collection.findOne({});
    console.log('Sample doc keys:', oneDoc ? Object.keys(oneDoc).slice(0, 5) : 'none');
    
    res.json({
      success: true,
      totalDocuments: totalDocs,
      sampleKeys: oneDoc ? Object.keys(oneDoc) : [],
      message: "Basic MongoDB test successful"
    });
    
  } catch (error) {
    console.error('Mongo test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/minimal/race-create-test  
 * Test creating a single race manually
 */
debugMinimalRouter.get('/race-create-test', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Testing manual race creation');
    
    // Get existing race card
    const { data: raceCard } = await supabase
      .from('race_cards')
      .select('id')
      .limit(1)
      .single();
    
    if (!raceCard) {
      return res.json({
        success: false,
        error: "No race card found to test with"
      });
    }
    
    console.log('Using race card:', raceCard.id);
    
    // Try to create a simple race
    const { data: race, error } = await supabase
      .from('races')
      .insert({
        race_card_id: raceCard.id,
        race_number: 888, // Unique test race number
        status: 'scheduled'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Race creation error:', error);
      return res.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details
      });
    }
    
    console.log('Created test race:', race.id);
    
    res.json({
      success: true,
      race: race,
      message: "Manual race creation successful"
    });
    
  } catch (error) {
    console.error('Race create test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
