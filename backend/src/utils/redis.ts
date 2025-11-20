/**
 * Redis cache using Upstash
 * Falls back to in-memory cache if Redis is not configured
 */

import { Redis } from '@upstash/redis';
import { cache as fallbackCache } from './cache';

let redis: Redis | null = null;
let initialized = false;

/**
 * Initialize Redis connection (should be called after dotenv.config())
 */
export function initializeRedis() {
  if (initialized) return;
  initialized = true;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      console.log('✅ Redis cache initialized (Upstash)');
    } catch (error) {
      console.warn('⚠️  Failed to initialize Redis, using in-memory cache:', error);
    }
  } else {
    console.log('ℹ️  Redis not configured, using in-memory cache');
  }
}

// DO NOT auto-initialize - we'll call initializeRedis() explicitly 
// from index.ts after dotenv.config() has run

/**
 * Get cached value (uses Redis if available, falls back to in-memory)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const data = await redis.get<T>(key);
      return data;
    } catch (error) {
      console.error('Redis get error:', error);
      // Fallback to in-memory cache
      return fallbackCache.get<T>(key);
    }
  }
  return fallbackCache.get<T>(key);
}

/**
 * Set cached value with TTL (uses Redis if available, falls back to in-memory)
 * @param key Cache key
 * @param data Data to cache
 * @param ttlSeconds Time to live in seconds (default: 24 hours for past data)
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = 24 * 60 * 60 // 24 hours default
): Promise<void> {
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, data);
      return;
    } catch (error) {
      console.error('Redis set error:', error);
      // Fallback to in-memory cache
      fallbackCache.set(key, data, ttlSeconds * 1000);
      return;
    }
  }
  fallbackCache.set(key, data, ttlSeconds * 1000);
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }
  fallbackCache.delete(key);
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}

