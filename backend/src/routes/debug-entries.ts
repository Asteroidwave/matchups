/**
 * Debug Race Entries - See what race entries actually exist
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const debugEntriesRouter = Router();

/**
 * GET /api/debug/entries/inspect
 * See what race entries exist and which races they belong to
 */
debugEntriesRouter.get('/inspect', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Inspecting race entries...');
    
    // Get all race entries with related data - simplified query
    const { data: raceEntries, error } = await supabase
      .from('race_entries')
      .select(`
        *,
        horses (name),
        races (
          race_number,
          race_card_id,
          race_cards (
            race_date,
            tracks (code)
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      throw error;
    }
    
    const grouped = {};
    
    for (const entry of raceEntries || []) {
      const trackCode = entry.races?.race_cards?.tracks?.code;
      const raceDate = entry.races?.race_cards?.race_date; 
      const raceNumber = entry.races?.race_number;
      
      const key = `${trackCode}-${raceDate}-R${raceNumber}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      grouped[key].push({
        horse: entry.horses?.name,
        program_number: entry.program_number,
        post_position: entry.post_position,
        status: entry.status,
        jockey_id: entry.jockey_id,
        trainer_id: entry.trainer_id
      });
    }
    
    res.json({
      success: true,
      totalRaceEntries: raceEntries?.length || 0,
      groupedByRace: grouped,
      sampleRaceEntries: (raceEntries || []).slice(0, 5).map(entry => ({
        id: entry.id,
        horse: entry.horses?.name,
        race: `${entry.races?.race_cards?.tracks?.code} R${entry.races?.race_number}`,
        date: entry.races?.race_cards?.race_date,
        program_number: entry.program_number,
        jockey_id: entry.jockey_id,
        trainer_id: entry.trainer_id
      })),
      message: "Race entries inspection complete"
    });
    
  } catch (error) {
    console.error('Race entries inspection error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/debug/entries/for-race/:raceId
 * Get race entries for a specific race
 */
debugEntriesRouter.get('/for-race/:raceId', async (req: Request, res: Response) => {
  try {
    const { raceId } = req.params;
    
    const { data: raceEntries, error } = await supabase
      .from('race_entries')
      .select(`
        *,
        horses (name, foaling_year),
        connections!race_entries_jockey_id_fkey (name),
        connections!race_entries_trainer_id_fkey (name)
      `)
      .eq('race_id', raceId);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      raceId,
      entryCount: raceEntries?.length || 0,
      entries: raceEntries || []
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/debug/entries/test-create/:raceId
 * Test creating a race entry manually
 */
debugEntriesRouter.get('/test-create/:raceId', async (req: Request, res: Response) => {
  try {
    const { raceId } = req.params;
    
    // Get a horse and connection for testing
    const { data: horse } = await supabase.from('horses').select('id, name').limit(1).single();
    const { data: jockey } = await supabase.from('connections').select('id, name').eq('role', 'jockey').limit(1).single();
    
    if (!horse || !jockey) {
      return res.json({
        success: false,
        error: "No horse or jockey found for testing"
      });
    }
    
    // Create test race entry
    const { data: raceEntry, error } = await supabase
      .from('race_entries')
      .insert({
        race_id: raceId,
        horse_id: horse.id,
        jockey_id: jockey.id,
        program_number: 999,
        post_position: 999,
        status: 'entered'
      })
      .select(`
        *,
        horses (name),
        connections!race_entries_jockey_id_fkey (name)
      `)
      .single();
    
    if (error) {
      return res.json({
        success: false,
        error: error.message,
        errorCode: error.code
      });
    }
    
    res.json({
      success: true,
      raceEntry,
      message: "Test race entry created successfully"
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});
