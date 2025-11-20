/**
 * Demo User Creation for Phase 2 Testing
 * Creates test users to validate multi-user functionality
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const demoUserRouter = Router();

/**
 * POST /api/demo/create-user
 * Create a demo user for testing Phase 2 functionality
 */
demoUserRouter.post('/create-user', async (req: Request, res: Response) => {
  try {
    const { username, email, displayName } = req.body;
    
    // Generate a proper UUID for the demo user
    const demoUserId = crypto.randomUUID();
    
    const userData = {
      id: demoUserId, // Use proper UUID
      email: email || `demo-${Date.now()}@example.com`,
      username: username || `demouser${Date.now()}`,
      display_name: displayName || 'Demo User',
      bankroll: 1000.00,
      is_admin: false,
      total_winnings: 0,
      total_entries: 0,
      win_percentage: 0,
      favorite_tracks: ['CD', 'GP', 'SA'],
      subscription_tier: 'free'
    };
    
    console.log('Creating demo user:', userData.username);
    
    const { data: user, error } = await supabase
      .from('profiles')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        bankroll: user.bankroll,
        favorite_tracks: user.favorite_tracks
      },
      message: `Demo user created: ${user.username}`,
      testEndpoints: {
        profile: `/api/users/${user.id}/profile`,
        rounds: `/api/users/${user.id}/rounds`,
        migrate: `/api/users/${user.id}/migrate`
      }
    });
    
  } catch (error) {
    console.error('Demo user creation error:', error);
    console.error('Full error details:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack
    });
    res.status(500).json({
      error: 'Failed to create demo user',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: {
        name: error?.name,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      }
    });
  }
});

/**
 * POST /api/demo/create-sample-data/:userId
 * Create sample user data for testing
 */
demoUserRouter.post('/create-sample-data/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    console.log(`Creating sample data for user ${userId}`);
    
    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get a contest to use for entries
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, name')
      .limit(1)
      .single();
    
    if (contestError || !contest) {
      return res.status(404).json({ 
        error: 'No contest found',
        message: 'Create a contest first, or run the migration which creates a default contest'
      });
    }
    
    // Create sample user entries
    const sampleEntries = [
      {
        contest_id: contest.id,
        user_id: userId,
        entry_amount: 10.00,
        status: 'won',
        total_picks: 3,
        correct_picks: 3,
        gross_winnings: 25.00,
        is_settled: true
      },
      {
        contest_id: contest.id,
        user_id: userId,
        entry_amount: 15.00,
        status: 'lost', 
        total_picks: 2,
        correct_picks: 1,
        gross_winnings: 0.00,
        is_settled: true
      },
      {
        contest_id: contest.id,
        user_id: userId,
        entry_amount: 20.00,
        status: 'won',
        total_picks: 4,
        correct_picks: 4,
        gross_winnings: 50.00,
        is_settled: true
      }
    ];
    
    const entriesCreated = [];
    
    for (const entryData of sampleEntries) {
      // Create user entry
      const { data: userEntry, error: entryError } = await supabase
        .from('user_entries')
        .insert(entryData)
        .select()
        .single();
      
      if (entryError) {
        console.error('Error creating entry:', entryError.message);
        continue;
      }
      
      // Create corresponding round
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert({
          user_entry_id: userEntry.id,
          total_picks: entryData.total_picks,
          correct_picks: entryData.correct_picks,
          entry_amount: entryData.entry_amount,
          actual_payout: entryData.gross_winnings,
          status: entryData.status,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (!roundError) {
        entriesCreated.push({ userEntry, round });
      }
    }
    
    // Update user statistics
    const totalWinnings = entriesCreated.reduce((sum, e) => sum + e.userEntry.gross_winnings, 0);
    const totalEntries = entriesCreated.length;
    const wonEntries = entriesCreated.filter(e => e.userEntry.status === 'won').length;
    const winPercentage = totalEntries > 0 ? (wonEntries / totalEntries) * 100 : 0;
    
    await supabase
      .from('profiles')
      .update({
        total_entries: totalEntries,
        total_winnings: totalWinnings,
        win_percentage: winPercentage
      })
      .eq('id', userId);
    
    res.json({
      success: true,
      user: user.username,
      entriesCreated: entriesCreated.length,
      statistics: {
        totalEntries,
        totalWinnings,
        winPercentage: Math.round(winPercentage * 100) / 100
      },
      message: `Created ${entriesCreated.length} sample entries for ${user.username}`
    });
    
  } catch (error) {
    console.error('Sample data creation error:', error);
    res.status(500).json({
      error: 'Failed to create sample data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/demo/test-multi-user
 * Create multiple demo users and test data isolation
 */
demoUserRouter.get('/test-multi-user', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Creating multi-user test scenario');
    
    const users = [];
    
    // Create 3 demo users
    for (let i = 1; i <= 3; i++) {
      const userData = {
        id: crypto.randomUUID(), // Generate proper UUID
        email: `testuser${i}-${Date.now()}@phase2.com`,
        username: `testuser${i}_${Date.now()}`,
        display_name: `Test User ${i}`,
        bankroll: 1000 + (i * 500), // Different bankrolls
        favorite_tracks: i === 1 ? ['CD'] : i === 2 ? ['GP'] : ['SA'],
        total_winnings: 0,
        total_entries: 0,
        win_percentage: 0,
        subscription_tier: 'free'
      };
      
      const { data: user, error } = await supabase
        .from('profiles')
        .insert(userData)
        .select()
        .single();
      
      if (!error && user) {
        users.push(user);
      }
    }
    
    res.json({
      success: true,
      usersCreated: users.length,
      testUsers: users.map(u => ({
        id: u.id,
        username: u.username,
        bankroll: u.bankroll,
        profileUrl: `/api/users/${u.id}/profile`,
        roundsUrl: `/api/users/${u.id}/rounds`
      })),
      message: "Multi-user test scenario created"
    });
    
  } catch (error) {
    console.error('Multi-user test error:', error);
    res.status(500).json({
      error: 'Failed to create multi-user test',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
