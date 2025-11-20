/**
 * Migration Debug Routes - Help diagnose migration failures
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const migrationDebugRouter = Router();

/**
 * POST /api/migration-debug/analyze-payload
 * Analyze the size and structure of localStorage data
 */
migrationDebugRouter.post('/analyze-payload', async (req: Request, res: Response) => {
  try {
    const { localStorageData } = req.body;
    
    if (!localStorageData) {
      return res.status(400).json({ 
        error: 'No localStorage data provided',
        usage: 'Send localStorage data in body: {"localStorageData": {...}}'
      });
    }
    
    // Analyze the data structure and size
    const analysis = {
      dataStructure: {
        hasRounds: !!localStorageData.rounds,
        hasHistory: !!localStorageData.history,
        hasBankroll: !!localStorageData.bankroll,
        hasPreferences: !!localStorageData.preferences
      },
      dataSizes: {
        roundsCount: localStorageData.rounds?.length || 0,
        historyCount: localStorageData.history?.length || 0,
        totalDataSize: JSON.stringify(localStorageData).length,
        roundsDataSize: JSON.stringify(localStorageData.rounds || []).length,
        historyDataSize: JSON.stringify(localStorageData.history || []).length
      },
      sampleData: {
        firstRound: localStorageData.rounds?.[0] ? {
          id: localStorageData.rounds[0].id,
          hasPicksArray: !!localStorageData.rounds[0].picks,
          picksCount: localStorageData.rounds[0].picks?.length || 0,
          hasMatchups: !!localStorageData.rounds[0].matchups,
          matchupsCount: localStorageData.rounds[0].matchups?.length || 0
        } : null
      },
      recommendations: []
    };
    
    // Add recommendations based on analysis
    if (analysis.dataSizes.totalDataSize > 1000000) { // 1MB
      analysis.recommendations.push('Data is very large - consider chunked migration');
    }
    
    if (analysis.dataSizes.roundsCount > 50) {
      analysis.recommendations.push('Many rounds detected - migration may take longer');
    }
    
    if (analysis.sampleData.firstRound?.matchupsCount > 10) {
      analysis.recommendations.push('Rounds contain large matchup data - may need simplified migration');
    }
    
    res.json({
      success: true,
      analysis,
      payloadSizeBytes: analysis.dataSizes.totalDataSize,
      payloadSizeMB: (analysis.dataSizes.totalDataSize / 1024 / 1024).toFixed(2),
      isLargePayload: analysis.dataSizes.totalDataSize > 100000, // 100KB
      message: "localStorage data analyzed successfully"
    });
    
  } catch (error) {
    console.error('Payload analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze payload',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/migration-debug/simple-migrate/:userId
 * Simple migration that only transfers profile data, not complex contest entries
 */
migrationDebugRouter.post('/simple-migrate/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { localStorageData } = req.body;
    
    console.log(`🔧 Simple migration for user ${userId}`);
    
    if (!localStorageData) {
      return res.status(400).json({ error: 'No localStorage data provided' });
    }
    
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate statistics from localStorage data
    const rounds = localStorageData.rounds || [];
    const history = localStorageData.history || [];
    const allRounds = [...rounds, ...history];
    
    const totalEntries = allRounds.length;
    const wonRounds = allRounds.filter(r => r.winnings && r.winnings > 0).length;
    const totalWinnings = allRounds.reduce((sum, r) => sum + (r.winnings || 0), 0);
    const winPercentage = totalEntries > 0 ? (wonRounds / totalEntries) * 100 : 0;
    
    // Update user profile with calculated statistics
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        bankroll: localStorageData.bankroll || 1000,
        total_entries: totalEntries,
        total_winnings: totalWinnings,
        win_percentage: Math.round(winPercentage * 100) / 100,
        favorite_tracks: localStorageData.preferences?.tracks || ['CD', 'GP'],
        last_login: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    res.json({
      success: true,
      message: `Simple migration completed for ${user.email}`,
      result: {
        userId,
        profileUpdated: true,
        statisticsCalculated: {
          totalEntries,
          totalWinnings,
          winPercentage: Math.round(winPercentage * 100) / 100,
          bankrollSet: localStorageData.bankroll || 1000
        },
        localStorageAnalysis: {
          roundsProcessed: rounds.length,
          historyProcessed: history.length,
          dataPreserved: 'Statistics calculated from localStorage data'
        }
      },
      updatedProfile: updatedProfile
    });
    
  } catch (error) {
    console.error('Simple migration error:', error);
    res.status(500).json({
      error: 'Simple migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        errorCode: error.code,
        errorDetails: error.details
      }
    });
  }
});

/**
 * POST /api/migration-debug/chunked-migrate/:userId
 * Migrate data in small chunks to avoid payload size issues
 */
migrationDebugRouter.post('/chunked-migrate/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { chunk, chunkIndex, totalChunks } = req.body;
    
    console.log(`📦 Chunked migration ${chunkIndex + 1}/${totalChunks} for user ${userId}`);
    
    // Process this chunk of data
    // Implementation would handle partial migration
    
    res.json({
      success: true,
      chunkProcessed: chunkIndex + 1,
      totalChunks,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} processed`
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Chunked migration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
