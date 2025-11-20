/**
 * Test Profile Columns - Verify new columns exist and work
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../utils/supabase';

export const testProfileColumnsRouter = Router();

/**
 * GET /api/test/profile-columns
 * Test if new profile columns exist and work
 */
testProfileColumnsRouter.get('/profile-columns', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Testing profile columns...');
    
    const tests = {};
    
    // Test 1: Check if we can query new columns
    try {
      const { data: columnTest, error: columnError } = await supabase
        .from('profiles')
        .select('username, display_name, total_winnings, win_percentage, favorite_tracks, subscription_tier')
        .limit(1);
      
      tests.column_query = {
        success: !columnError,
        error: columnError?.message,
        details: 'Can query new profile columns'
      };
      
    } catch (err) {
      tests.column_query = {
        success: false,
        error: err.message,
        details: 'Failed to query new columns'
      };
    }
    
    // Test 2: Try to insert a simple profile with new fields
    try {
      const testProfile = {
        id: crypto.randomUUID(), // Generate proper UUID
        email: `test-${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        display_name: 'Test User',
        bankroll: 1000.00,
        total_winnings: 0,
        total_entries: 0,
        win_percentage: 0,
        favorite_tracks: ['CD'],
        subscription_tier: 'free'
      };
      
      console.log('Testing profile insert with data:', testProfile);
      
      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(testProfile)
        .select()
        .single();
      
      tests.profile_insert = {
        success: !insertError,
        error: insertError?.message,
        errorCode: insertError?.code,
        errorDetails: insertError?.details,
        hint: insertError?.hint,
        profileId: insertedProfile?.id
      };
      
      // Clean up test profile if created successfully
      if (insertedProfile) {
        await supabase.from('profiles').delete().eq('id', insertedProfile.id);
        console.log('Cleaned up test profile');
      }
      
    } catch (err) {
      tests.profile_insert = {
        success: false,
        error: err.message,
        details: 'Exception during profile insert'
      };
    }
    
    // Test 3: Check existing profiles table structure
    try {
      const { data: existingProfiles, error: existingError } = await supabase
        .from('profiles')
        .select('id, email, is_admin, bankroll')
        .limit(3);
      
      tests.existing_data = {
        success: !existingError,
        profileCount: existingProfiles?.length || 0,
        sampleProfile: existingProfiles?.[0] ? {
          id: existingProfiles[0].id,
          email: existingProfiles[0].email,
          hasAdmin: 'is_admin' in existingProfiles[0],
          hasBankroll: 'bankroll' in existingProfiles[0]
        } : null
      };
      
    } catch (err) {
      tests.existing_data = {
        success: false,
        error: err.message
      };
    }
    
    res.json({
      success: true,
      tests,
      summary: {
        allTestsPassed: Object.values(tests).every(test => test.success),
        failedTests: Object.entries(tests).filter(([_, test]) => !test.success).map(([name, _]) => name)
      },
      message: "Profile columns testing complete"
    });
    
  } catch (error) {
    console.error('Profile column test error:', error);
    res.status(500).json({
      error: 'Failed to test profile columns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/test/create-minimal-user
 * Create user with only basic required fields
 */
testProfileColumnsRouter.post('/create-minimal-user', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Testing minimal user creation...');
    
    // Create user with only basic fields that we know exist
    const minimalUser = {
      id: `minimal-user-${Date.now()}`,
      email: `minimal-${Date.now()}@example.com`,
      is_admin: false,
      bankroll: 1000.00
    };
    
    console.log('Creating minimal user:', minimalUser);
    
    const { data: user, error } = await supabase
      .from('profiles')
      .insert(minimalUser)
      .select()
      .single();
    
    if (error) {
      console.error('Minimal user creation error:', error);
      return res.json({
        success: false,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        hint: error.hint
      });
    }
    
    console.log('Minimal user created successfully:', user.id);
    
    res.json({
      success: true,
      user: user,
      message: "Minimal user creation successful"
    });
    
  } catch (error) {
    console.error('Minimal user test error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});
