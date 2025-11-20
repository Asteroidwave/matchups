/**
 * User Management API Routes
 * Handle user accounts, profiles, and data
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { UserMigrationService } from '../services/userMigration';

export const userManagementRouter = Router();
const migrationService = new UserMigrationService();

/**
 * POST /api/users/:userId/migrate
 * Migrate user's localStorage data to database
 */
userManagementRouter.post('/:userId/migrate', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { localStorageData } = req.body;
    
    console.log(`🔄 Starting migration for user ${userId}`);
    
    if (!localStorageData) {
      return res.status(400).json({
        error: 'No localStorage data provided',
        message: 'Include localStorageData in request body'
      });
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
    
    // Perform migration
    const result = await migrationService.migrateUserData(userId, localStorageData);
    
    res.json({
      success: result.success,
      message: `Migrated ${result.roundsMigrated} rounds for ${user.email}`,
      result,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
    
  } catch (error) {
    console.error('User migration error:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/users/:userId/rounds
 * Get user's complete round history from database
 */
userManagementRouter.get('/:userId/rounds', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // Get user's rounds - simplified query to avoid join issues
    // First get user_entries, then get rounds for those entries
    const { data: userEntries, error: entriesError } = await supabase
      .from('user_entries')
      .select(`
        id,
        contest_id,
        entry_amount,
        status,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));
    
    if (entriesError) {
      throw entriesError;
    }
    
    if (!userEntries || userEntries.length === 0) {
      return res.json({
        rounds: [],
        pagination: {
          offset: parseInt(offset as string),
          limit: parseInt(limit as string),
          total: 0
        },
        statistics: calculateUserStats([]),
        message: "No rounds found for user"
      });
    }
    
    // Get rounds for these entries
    const entryIds = userEntries.map(e => e.id);
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select(`
        *,
        user_entries!inner (
          id,
          contest_id,
          entry_amount,
          status
        )
      `)
      .in('user_entry_id', entryIds)
      .order('created_at', { ascending: false });
    
    if (roundsError) {
      throw roundsError;
    }
    
    // Get contest info for each entry
    const contestIds = [...new Set(userEntries.map(e => e.contest_id))];
    const { data: contests } = await supabase
      .from('contests')
      .select('id, name, contest_date, contest_type')
      .in('id', contestIds);
    
    const contestMap = new Map((contests || []).map(c => [c.id, c]));
    
    // Combine rounds with contest info
    const roundsWithContests = (rounds || []).map((round: any) => {
      const entry = userEntries.find(e => e.id === round.user_entry_id);
      const contest = entry ? contestMap.get(entry.contest_id) : null;
      
      return {
        ...round,
        user_entry: {
          ...entry,
          contest: contest
        }
      };
    });
    
    if (error) {
      throw error;
    }
    
    // Calculate summary statistics
    const stats = this.calculateUserStats(rounds || []);
    
    res.json({
      rounds: rounds || [],
      pagination: {
        offset: parseInt(offset as string),
        limit: parseInt(limit as string),
        total: rounds?.length || 0
      },
      statistics: stats,
      message: "User rounds retrieved successfully"
    });
    
  } catch (error) {
    console.error('Get user rounds error:', error);
    res.status(500).json({
      error: 'Failed to get user rounds',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/users/:userId/profile  
 * Get complete user profile and statistics
 */
userManagementRouter.get('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    // Get user's recent activity
    const { data: userEntries } = await supabase
      .from('user_entries')
      .select(`
        id,
        contests (
          id,
          name,
          contest_date
        ),
        rounds (
          id,
          status,
          entry_amount,
          actual_payout,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Transform to match expected format
    const recentRounds = (userEntries || []).flatMap(entry =>
      (entry.rounds || []).map((round: any) => ({
        ...round,
        contest: entry.contests
      }))
    );
    
    // Get user's performance metrics
    const performanceMetrics = await calculateUserPerformance(userId);
    
    res.json({
      profile: {
        ...profile,
        // Include is_admin - frontend needs it for admin detection
        is_admin: profile.is_admin
      },
      recentActivity: recentRounds || [],
      performance: performanceMetrics,
      message: "User profile retrieved successfully"
    });
    
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Failed to get user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/users/:userId/profile
 * Update user profile information
 */
userManagementRouter.put('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // Validate user can update this profile (basic security)
    // In production, you'd verify JWT token matches userId
    
    // Only allow certain fields to be updated
    const allowedFields = [
      'username', 'display_name', 'avatar_url', 'favorite_tracks',
      'timezone', 'email_notifications'
    ];
    
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );
    
    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        allowedFields
      });
    }
    
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      profile: updatedProfile,
      message: "Profile updated successfully"
    });
    
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/users/:userId/contests/:contestId/enter
 * Submit contest entry for user (new relational way)
 */
userManagementRouter.post('/:userId/contests/:contestId/enter', async (req: Request, res: Response) => {
  try {
    const { userId, contestId } = req.params;
    const { picks, entryAmount, multiplier, isFlexible } = req.body;
    
    console.log(`🎮 User ${userId} entering contest ${contestId}`);
    
    // Validate contest exists and is open
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();
    
    if (contestError || !contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    
    // Check user's bankroll
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    if (profile.bankroll < entryAmount) {
      return res.status(400).json({
        error: 'Insufficient bankroll',
        required: entryAmount,
        available: profile.bankroll
      });
    }
    
    // Create user entry
    const { data: userEntry, error: entryError } = await supabase
      .from('user_entries')
      .insert({
        contest_id: contestId,
        user_id: userId,
        entry_amount: entryAmount,
        max_multiplier: multiplier || 2,
        is_flex: isFlexible || false,
        status: 'pending',
        total_picks: picks.length
      })
      .select()
      .single();
    
    if (entryError) throw entryError;
    
    // Create picks
    for (const pick of picks) {
      await supabase
        .from('user_picks')
        .insert({
          user_entry_id: userEntry.id,
          matchup_id: pick.matchupId,
          selected_side: pick.side
        });
    }
    
    // Create round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        user_entry_id: userEntry.id,
        total_picks: picks.length,
        entry_amount: entryAmount,
        status: 'live'
      })
      .select()
      .single();
    
    if (roundError) throw roundError;
    
    // Deduct from bankroll
    await supabase
      .from('profiles')
      .update({ bankroll: profile.bankroll - entryAmount })
      .eq('id', userId);
    
    res.json({
      success: true,
      userEntry,
      round,
      message: `Entry submitted for ${contest.name}`
    });
    
  } catch (error) {
    console.error('Contest entry error:', error);
    res.status(500).json({
      error: 'Failed to submit entry',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper methods
function calculateUserStats(rounds: any[]) {
  if (!rounds || rounds.length === 0) {
    return {
      totalRounds: 0,
      totalWinnings: 0,
      winPercentage: 0,
      averageEntry: 0,
      bestPayout: 0
    };
  }
  
  const totalRounds = rounds.length;
  const wonRounds = rounds.filter(r => r.status === 'won').length;
  const totalWinnings = rounds.reduce((sum, r) => sum + (r.actual_payout || 0), 0);
  const totalEntries = rounds.reduce((sum, r) => sum + (r.entry_amount || 0), 0);
  const bestPayout = Math.max(...rounds.map(r => r.actual_payout || 0));
  
  return {
    totalRounds,
    totalWinnings,
    winPercentage: totalRounds > 0 ? (wonRounds / totalRounds) * 100 : 0,
    averageEntry: totalRounds > 0 ? totalEntries / totalRounds : 0,
    bestPayout
  };
}

async function calculateUserPerformance(userId: string) {
  // Get user's performance metrics from database
  const { data: performance } = await supabase
    .from('rounds')
    .select(`
      status,
      entry_amount,
      actual_payout,
      total_picks,
      correct_picks,
      created_at,
      user_entries!inner (user_id)
    `)
    .eq('user_entries.user_id', userId);
  
  return calculateUserStats(performance || []);
}
