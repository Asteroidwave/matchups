/**
 * Test script for Phase 3 Backend APIs
 * 
 * Usage:
 *   tsx scripts/test-phase3-endpoints.ts
 * 
 * Prerequisites:
 *   - Backend running on localhost:3001
 *   - Admin user JWT token (get from browser localStorage or network tab)
 *   - MongoDB accessible
 *   - Supabase configured
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BACKEND_URL = process.env.CORS_ORIGIN?.replace('http://', 'http://') || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || '';

interface TestResult {
  name: string;
  success: boolean;
  status?: number;
  error?: string;
  data?: any;
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<TestResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BACKEND_URL}${path}`, options);
    const data = await response.json();

    return {
      name,
      success: response.ok,
      status: response.status,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (data.error || data.message || 'Unknown error'),
    };
  } catch (error) {
    return {
      name,
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Phase 3 Backend APIs\n');
  console.log('='.repeat(60));

  if (!ADMIN_TOKEN) {
    console.error('❌ TEST_ADMIN_TOKEN not set in backend/.env');
    console.error('   Get token from browser: localStorage.getItem("supabase.auth.token")');
    console.error('   Or from Network tab: Look for Authorization header');
    console.error('\n   For now, tests will run without authentication (will fail)');
  }

  const results: TestResult[] = [];

  // Test 1: Fetch Track Data
  console.log('\n📋 Test 1: POST /api/admin/tracks/fetch');
  const test1 = await testEndpoint(
    'Fetch Track Data (GP)',
    'POST',
    '/api/admin/tracks/fetch',
    {
      track: 'GP',
      date: '2025-11-02',
    },
    ADMIN_TOKEN
  );
  results.push(test1);
  console.log(test1.success ? '✅ Success' : `❌ Failed: ${test1.error}`);
  if (test1.data) {
    console.log(`   Track Data ID: ${test1.data.track_data_id}`);
    console.log(`   Preview: ${JSON.stringify(test1.data.preview, null, 2)}`);
  }

  // Get track_data_id from test1 for use in test 3
  const trackDataId = test1.data?.track_data_id;

  // Test 2: Get Preview
  console.log('\n📋 Test 2: GET /api/admin/tracks/GP/2025-11-02/preview');
  const test2 = await testEndpoint(
    'Get Track Data Preview',
    'GET',
    '/api/admin/tracks/GP/2025-11-02/preview',
    undefined,
    ADMIN_TOKEN
  );
  results.push(test2);
  console.log(test2.success ? '✅ Success' : `❌ Failed: ${test2.error}`);
  if (test2.data) {
    console.log(`   Preview: ${JSON.stringify(test2.data.preview, null, 2)}`);
  }

  // Test 3: Create Contest with Track Data
  console.log('\n📋 Test 3: POST /api/admin/contests (with track_data_id)');
  const test3 = await testEndpoint(
    'Create Contest with Track Data',
    'POST',
    '/api/admin/contests',
    {
      track: 'GP',
      date: '2025-11-02',
      track_data_id: trackDataId || null,
      contestType: 'jockey_vs_jockey',
    },
    ADMIN_TOKEN
  );
  results.push(test3);
  console.log(test3.success ? '✅ Success' : `❌ Failed: ${test3.error}`);
  const contestId = test3.data?.contest?.id;
  if (contestId) {
    console.log(`   Contest ID: ${contestId}`);
    console.log(`   Status: ${test3.data.contest.status}`);
  }

  // Test 4: Set Matchup Types
  if (contestId) {
    console.log('\n📋 Test 4: PUT /api/admin/contests/:id/matchup-types');
    const test4 = await testEndpoint(
      'Set Matchup Types',
      'PUT',
      `/api/admin/contests/${contestId}/matchup-types`,
      {
        matchup_types: ['jockey_vs_jockey', 'trainer_vs_trainer'],
      },
      ADMIN_TOKEN
    );
    results.push(test4);
    console.log(test4.success ? '✅ Success' : `❌ Failed: ${test4.error}`);
    if (test4.data) {
      console.log(`   Matchup Types: ${test4.data.contest.matchup_types}`);
      console.log(`   Status: ${test4.data.contest.status}`);
    }
  } else {
    console.log('\n⏭️  Test 4: Skipped (no contest ID from Test 3)');
    results.push({ name: 'Set Matchup Types', success: false, error: 'No contest ID' });
  }

  // Test 5: Get Contest Status
  if (contestId) {
    console.log('\n📋 Test 5: GET /api/admin/contests/:id/status');
    const test5 = await testEndpoint(
      'Get Contest Status',
      'GET',
      `/api/admin/contests/${contestId}/status`,
      undefined,
      ADMIN_TOKEN
    );
    results.push(test5);
    console.log(test5.success ? '✅ Success' : `❌ Failed: ${test5.error}`);
    if (test5.data) {
      console.log(`   Status: ${test5.data.status}`);
      console.log(`   Matchup Types: ${test5.data.matchup_types}`);
      console.log(`   Matchups Count: ${test5.data.matchups_count}`);
    }
  } else {
    console.log('\n⏭️  Test 5: Skipped (no contest ID from Test 3)');
    results.push({ name: 'Get Contest Status', success: false, error: 'No contest ID' });
  }

  // Test 6: Create Operation
  console.log('\n📋 Test 6: POST /api/admin/operations');
  const test6 = await testEndpoint(
    'Create Operation',
    'POST',
    '/api/admin/operations',
    {
      operation_type: 'fetch_track_data',
      input_data: { track: 'GP', date: '2025-11-02' },
    },
    ADMIN_TOKEN
  );
  results.push(test6);
  console.log(test6.success ? '✅ Success' : `❌ Failed: ${test6.error}`);
  const operationId = test6.data?.operation?.id;
  if (operationId) {
    console.log(`   Operation ID: ${operationId}`);
  }

  // Test 7: Get Operation Status
  if (operationId) {
    console.log('\n📋 Test 7: GET /api/admin/operations/:id');
    const test7 = await testEndpoint(
      'Get Operation Status',
      'GET',
      `/api/admin/operations/${operationId}`,
      undefined,
      ADMIN_TOKEN
    );
    results.push(test7);
    console.log(test7.success ? '✅ Success' : `❌ Failed: ${test7.error}`);
    if (test7.data) {
      console.log(`   Status: ${test7.data.operation.status}`);
      console.log(`   Progress: ${test7.data.operation.progress}%`);
    }
  } else {
    console.log('\n⏭️  Test 7: Skipped (no operation ID from Test 6)');
    results.push({ name: 'Get Operation Status', success: false, error: 'No operation ID' });
  }

  // Summary
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

  console.log('\n' + '='.repeat(60));
}

// Run tests
runTests().catch(console.error);

