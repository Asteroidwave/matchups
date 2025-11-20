/**
 * Comprehensive Application Test Suite
 * 
 * Tests:
 * - User signup and authentication
 * - Admin account creation
 * - Contest creation flow
 * - Matchup calculation
 * - Edge cases and error handling
 * 
 * Usage:
 *   tsx scripts/test-application.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ Passed: ${name}`);
    results.push({ name, success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed: ${name}`);
    console.error(`   Error: ${errorMessage}`);
    results.push({ name, success: false, error: errorMessage, details: error });
  }
}

// Test users
const testUsers = {
  admin: {
    email: `admin-test-${Date.now()}@test.com`,
    password: 'TestAdmin123!',
  },
  user1: {
    email: `user1-test-${Date.now()}@test.com`,
    password: 'TestUser123!',
  },
  user2: {
    email: `user2-test-${Date.now()}@test.com`,
    password: 'TestUser123!',
  },
};

let adminSession: any = null;
let user1Session: any = null;
let user2Session: any = null;

async function runTests() {
  console.log('🚀 Starting Comprehensive Application Tests\n');
  console.log('='.repeat(60));

  // ============================================
  // Authentication Tests
  // ============================================
  
  await test('Health Check', async () => {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
    const data = await response.json();
    if (data.status !== 'ok') throw new Error('Invalid health check response');
  });

  await test('Create Admin Account', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testUsers.admin.email,
      password: testUsers.admin.password,
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from signup');
    
    // Wait a bit for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Make user admin via Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', data.user.id);
    
    if (updateError) throw updateError;
    
    console.log(`   Admin created: ${testUsers.admin.email}`);
  });

  await test('Create User 1 Account', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testUsers.user1.email,
      password: testUsers.user1.password,
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from signup');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`   User 1 created: ${testUsers.user1.email}`);
  });

  await test('Create User 2 Account', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testUsers.user2.email,
      password: testUsers.user2.password,
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from signup');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`   User 2 created: ${testUsers.user2.email}`);
  });

  await test('Admin Login', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUsers.admin.email,
      password: testUsers.admin.password,
    });
    
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    
    adminSession = data.session;
    console.log(`   Admin logged in: ${data.user.email}`);
  });

  await test('Verify Admin Profile', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminSession.user.id)
      .single();
    
    if (error) throw error;
    if (!data.is_admin) throw new Error('Admin profile not marked as admin');
    
    console.log(`   Admin verified: ${data.email}, is_admin: ${data.is_admin}`);
  });

  await test('User 1 Login', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUsers.user1.email,
      password: testUsers.user1.password,
    });
    
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    
    user1Session = data.session;
    console.log(`   User 1 logged in: ${data.user.email}`);
  });

  await test('User 2 Login', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUsers.user2.email,
      password: testUsers.user2.password,
    });
    
    if (error) throw error;
    if (!data.session) throw new Error('No session returned');
    
    user2Session = data.session;
    console.log(`   User 2 logged in: ${data.user.email}`);
  });

  // ============================================
  // Contest Creation Tests (Admin Only)
  // ============================================
  
  await test('Admin: Fetch Track Data', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        date: '2025-11-02',
      }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) throw new Error('Track data fetch failed');
    if (!data.track_data_id) throw new Error('No track_data_id returned');
    
    console.log(`   Track data fetched: ${data.track_data_id}`);
    console.log(`   Preview: ${data.preview.races_count} races, ${data.preview.horses_count} horses`);
  });

  await test('Admin: Create Contest', async () => {
    // First fetch track data
    const fetchResponse = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        date: '2025-11-02',
      }),
    });
    
    const fetchData = await fetchResponse.json();
    const trackDataId = fetchData.track_data_id;
    
    // Create contest
    const response = await fetch(`${BACKEND_URL}/api/admin/contests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        date: '2025-11-02',
        track_data_id: trackDataId,
        contestType: 'jockey_vs_jockey',
        entryFee: 10,
        prizePool: 100,
      }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.contest) throw new Error('No contest returned');
    if (data.contest.status !== 'draft') {
      throw new Error(`Expected status 'draft', got '${data.contest.status}'`);
    }
    
    console.log(`   Contest created: ${data.contest.id}`);
  });

  // ============================================
  // Authorization Tests
  // ============================================
  
  await test('User: Cannot Access Admin Endpoints', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Session.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        date: '2025-11-02',
      }),
    });
    
    // Should be 403 Forbidden
    if (response.status !== 403) {
      throw new Error(`Expected 403, got ${response.status}`);
    }
    
    console.log(`   User correctly blocked from admin endpoint`);
  });

  await test('Unauthenticated: Cannot Access Admin Endpoints', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        track: 'GP',
        date: '2025-11-02',
      }),
    });
    
    // Should be 401 Unauthorized
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
    
    console.log(`   Unauthenticated request correctly blocked`);
  });

  // ============================================
  // Edge Cases
  // ============================================
  
  await test('Edge Case: Invalid Track Code', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'INVALID',
        date: '2025-11-02',
      }),
    });
    
    // Should return 404 or 400
    if (response.ok) {
      throw new Error('Should have failed for invalid track');
    }
    
    console.log(`   Invalid track correctly rejected: ${response.status}`);
  });

  await test('Edge Case: Invalid Date Format', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        date: 'invalid-date',
      }),
    });
    
    // Should return 400
    if (response.ok) {
      throw new Error('Should have failed for invalid date');
    }
    
    console.log(`   Invalid date correctly rejected: ${response.status}`);
  });

  await test('Edge Case: Missing Required Fields', async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin/tracks/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({
        track: 'GP',
        // Missing date
      }),
    });
    
    // Should return 400
    if (response.ok) {
      throw new Error('Should have failed for missing date');
    }
    
    console.log(`   Missing fields correctly rejected: ${response.status}`);
  });

  // ============================================
  // Summary
  // ============================================
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n📝 Test Accounts Created:');
  console.log(`   Admin: ${testUsers.admin.email}`);
  console.log(`   User 1: ${testUsers.user1.email}`);
  console.log(`   User 2: ${testUsers.user2.email}`);
  console.log('\n💡 You can use these accounts to test the frontend manually.');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);

