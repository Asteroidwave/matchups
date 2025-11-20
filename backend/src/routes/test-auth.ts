/**
 * Test Authentication - Create users for Phase 2 testing
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const testAuthRouter = Router();

/**
 * POST /api/test-auth/create-user
 * Create authenticated user for testing (creates both auth.users and profiles)
 */
testAuthRouter.post('/create-user', async (req: Request, res: Response) => {
  try {
    const { email, password, username, displayName } = req.body;
    
    console.log(`🔐 Creating authenticated user: ${email}`);
    
    // Create authenticated user (this will trigger profile creation via database trigger)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email || `demo-${Date.now()}@example.com`,
      password: password || 'demo123456',
      email_confirm: true // Skip email confirmation for testing
    });
    
    if (authError) {
      console.error('Auth user creation error:', authError);
      return res.status(400).json({
        error: 'Failed to create authenticated user',
        message: authError.message,
        authError
      });
    }
    
    console.log(`✅ Auth user created: ${authData.user.id}`);
    
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the profile with enhanced fields
    const profileUpdates: any = {};
    
    if (username) profileUpdates.username = username;
    if (displayName) profileUpdates.display_name = displayName;
    
    // Set defaults for new fields
    profileUpdates.total_winnings = 0;
    profileUpdates.total_entries = 0; 
    profileUpdates.win_percentage = 0;
    profileUpdates.favorite_tracks = ['CD', 'GP', 'SA'];
    profileUpdates.subscription_tier = 'free';
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', authData.user.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({
        error: 'User created but profile update failed',
        authUser: authData.user,
        updateError: updateError.message
      });
    }
    
    console.log(`✅ Profile updated for user: ${updatedProfile.username || updatedProfile.email}`);
    
    res.json({
      success: true,
      authUser: {
        id: authData.user.id,
        email: authData.user.email
      },
      profile: updatedProfile,
      testEndpoints: {
        profile: `/api/users/${authData.user.id}/profile`,
        rounds: `/api/users/${authData.user.id}/rounds`,
        migrate: `/api/users/${authData.user.id}/migrate`
      },
      message: `Authenticated user created: ${updatedProfile.username || authData.user.email}`
    });
    
  } catch (error) {
    console.error('Test auth creation error:', error);
    res.status(500).json({
      error: 'Failed to create test user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/test-auth/create-sample-users
 * Create multiple authenticated test users for multi-user testing
 */
testAuthRouter.post('/create-sample-users', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Creating sample authenticated users for multi-user testing');
    
    const usersToCreate = [
      { email: 'alice@phase2test.com', username: 'alice_player', displayName: 'Alice (High Roller)' },
      { email: 'bob@phase2test.com', username: 'bob_casual', displayName: 'Bob (Casual Player)' },
      { email: 'charlie@phase2test.com', username: 'charlie_expert', displayName: 'Charlie (Expert)' }
    ];
    
    const createdUsers = [];
    
    for (const userData of usersToCreate) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: 'testpass123',
          email_confirm: true
        });
        
        if (authError) {
          console.error(`Failed to create auth user ${userData.email}:`, authError.message);
          continue;
        }
        
        // Wait for profile trigger
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update profile with enhanced data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .update({
            username: userData.username,
            display_name: userData.displayName,
            total_winnings: 0,
            total_entries: 0,
            win_percentage: 0,
            favorite_tracks: ['CD', 'GP'],
            subscription_tier: 'free'
          })
          .eq('id', authData.user.id)
          .select()
          .single();
        
        if (!profileError && profile) {
          createdUsers.push({
            authUser: authData.user,
            profile: profile
          });
        }
        
      } catch (userError) {
        console.error(`Error creating user ${userData.email}:`, userError.message);
      }
    }
    
    res.json({
      success: true,
      usersCreated: createdUsers.length,
      users: createdUsers.map(u => ({
        id: u.authUser.id,
        email: u.authUser.email,
        username: u.profile.username,
        displayName: u.profile.display_name,
        testEndpoints: {
          profile: `/api/users/${u.authUser.id}/profile`,
          migrate: `/api/users/${u.authUser.id}/migrate`
        }
      })),
      message: `Created ${createdUsers.length} authenticated test users`
    });
    
  } catch (error) {
    console.error('Sample users creation error:', error);
    res.status(500).json({
      error: 'Failed to create sample users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
