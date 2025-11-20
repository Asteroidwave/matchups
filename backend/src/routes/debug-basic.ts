/**
 * Debug Basic Operations - Test fundamental operations
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const debugBasicRouter = Router();

/**
 * GET /api/debug/basic/test-insert
 * Test basic database insert operations
 */
debugBasicRouter.get('/test-insert', async (req: Request, res: Response) => {
  try {
    const results = {};
    
    // Test 1: Insert a test track
    console.log('Testing track insert...');
    try {
      const { data: track, error: trackError } = await supabase
        .from('tracks')
        .insert({
          code: 'TEST1',
          name: 'Test Track 1',
          timezone: 'America/New_York'
        })
        .select()
        .single();
      
      results['track_insert'] = trackError ? 
        { success: false, error: trackError.message } : 
        { success: true, id: track.id };
        
    } catch (err) {
      results['track_insert'] = { success: false, error: err.message };
    }
    
    // Test 2: Insert a test race card
    console.log('Testing race card insert...');
    try {
      const { data: testTrack } = await supabase
        .from('tracks')
        .select('id')
        .eq('code', 'CD')
        .single();
      
      if (testTrack) {
        const { data: raceCard, error: cardError } = await supabase
          .from('race_cards')
          .insert({
            track_id: testTrack.id,
            race_date: '2025-11-27', // Tomorrow's date
            status: 'scheduled'
          })
          .select()
          .single();
        
        results['race_card_insert'] = cardError ? 
          { success: false, error: cardError.message } : 
          { success: true, id: raceCard.id };
      }
    } catch (err) {
      results['race_card_insert'] = { success: false, error: err.message };
    }
    
    // Test 3: Insert a test race
    console.log('Testing race insert...');
    try {
      const { data: testCard } = await supabase
        .from('race_cards')
        .select('id')
        .eq('race_date', '2025-11-27')
        .single();
      
      if (testCard) {
        const { data: race, error: raceError } = await supabase
          .from('races')
          .insert({
            race_card_id: testCard.id,
            race_number: 999,
            post_time: new Date().toISOString(),
            status: 'scheduled'
          })
          .select()
          .single();
        
        results['race_insert'] = raceError ? 
          { success: false, error: raceError.message } : 
          { success: true, id: race.id };
      }
    } catch (err) {
      results['race_insert'] = { success: false, error: err.message };
    }
    
    res.json({
      success: true,
      tests: results,
      message: "Basic insert operation tests"
    });
    
  } catch (error) {
    console.error('Basic test error:', error);
    res.status(500).json({
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

/**
 * GET /api/debug/basic/permissions
 * Test database permissions
 */
debugBasicRouter.get('/permissions', async (req: Request, res: Response) => {
  try {
    const tests = {};
    
    // Test read permissions
    const { data: tracksRead, error: readError } = await supabase
      .from('tracks')
      .select('code')
      .limit(1);
    
    tests['read_tracks'] = readError ? 
      { success: false, error: readError.message } :
      { success: true, count: tracksRead?.length };
    
    // Test write permissions  
    const { error: writeError } = await supabase
      .from('tracks')
      .insert({
        code: 'PERM_TEST',
        name: 'Permission Test Track'
      });
    
    tests['write_tracks'] = writeError ?
      { success: false, error: writeError.message } :
      { success: true };
    
    // Clean up test record
    if (!writeError) {
      await supabase.from('tracks').delete().eq('code', 'PERM_TEST');
    }
    
    res.json({
      success: true,
      permissionTests: tests
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});
