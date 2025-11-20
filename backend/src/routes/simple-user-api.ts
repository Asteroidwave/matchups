/**
 * Simple User API - Working endpoints without complex queries
 * Fixes the schema mismatch issues
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const simpleUserApiRouter = Router();

/**
 * GET /api/simple-user/:userId/profile
 * Get user profile with basic info (no complex joins)
 */
simpleUserApiRouter.get('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    res.json({
      success: true,
      profile,
      message: "User profile retrieved successfully"
    });
    
  } catch (error) {
    console.error('Simple profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/simple-user/:userId/rounds-basic
 * Get user rounds with simple query (no complex joins)
 */
simpleUserApiRouter.get('/:userId/rounds-basic', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Get user entries first
    const { data: userEntries, error: entriesError } = await supabase
      .from('user_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (entriesError) {
      throw entriesError;
    }
    
    // Get rounds for these entries
    const rounds = [];
    
    for (const entry of userEntries || []) {
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('user_entry_id', entry.id)
        .single();
      
      if (!roundError && round) {
        rounds.push({
          ...round,
          entry_amount: entry.entry_amount,
          contest_id: entry.contest_id
        });
      }
    }
    
    res.json({
      success: true,
      rounds,
      count: rounds.length,
      message: "User rounds retrieved successfully"
    });
    
  } catch (error) {
    console.error('Simple rounds error:', error);
    res.status(500).json({
      error: 'Failed to get rounds',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/simple-user/:userId/migrate-basic
 * Simple migration without complex contest creation
 */
simpleUserApiRouter.post('/:userId/migrate-basic', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { localStorageData } = req.body;
    
    console.log(`🔄 Simple migration for user ${userId}`);
    
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user profile with localStorage data
    const updates: any = {};
    
    if (localStorageData.bankroll) {
      updates.bankroll = localStorageData.bankroll;
    }
    
    if (localStorageData.rounds && localStorageData.rounds.length > 0) {
      const totalRounds = localStorageData.rounds.length;
      const wonRounds = localStorageData.rounds.filter((r: any) => r.winnings && r.winnings > 0).length;
      const totalWinnings = localStorageData.rounds.reduce((sum: number, r: any) => sum + (r.winnings || 0), 0);
      
      updates.total_entries = totalRounds;
      updates.total_winnings = totalWinnings;
      updates.win_percentage = totalRounds > 0 ? (wonRounds / totalRounds) * 100 : 0;
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({
      success: true,
      message: `Profile updated with localStorage data for ${user.email}`,
      result: {
        userId,
        profileUpdated: true,
        roundsFound: localStorageData.rounds?.length || 0,
        bankrollUpdated: localStorageData.bankroll || 0,
        statisticsCalculated: true
      }
    });
    
  } catch (error) {
    console.error('Simple migration error:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
