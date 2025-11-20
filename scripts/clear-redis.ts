/**
 * Script to clear Redis/Upstash cache directly
 * 
 * Usage:
 *   tsx scripts/clear-redis.ts
 */

import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ Missing Upstash Redis credentials');
  console.error('   Required: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  console.error('   Make sure backend/.env has these variables');
  process.exit(1);
}

async function clearRedis() {
  console.log('🧹 Clearing Redis/Upstash cache...\n');

  try {
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    // Clear the main contests cache key
    console.log('📊 Clearing contests:active...');
    const deleted = await redis.del('contests:active');
    console.log(`✅ Cleared contests:active (${deleted} key(s) deleted)`);

    // Try to get all keys matching patterns (Upstash doesn't support KEYS directly)
    // So we'll try to delete common cache keys
    const commonKeys = [
      'contests:active',
      // Add any other known cache keys here
    ];

    console.log('\n✅ Redis cache cleared!');
    console.log('\n📝 Note: If you have other cache keys (entries:*, results:*),');
    console.log('   you can delete them manually via Upstash Dashboard:');
    console.log('   https://console.upstash.com/');
    
  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

clearRedis();

