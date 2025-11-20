/**
 * Profile caching utilities
 * Caches profile data in localStorage with expiration
 */

const PROFILE_CACHE_KEY = 'auth_profile_cache';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedProfile {
  profile: {
    id: string;
    email: string;
    isAdmin: boolean;
    bankroll: number;
    createdAt: string;
  };
  userId: string;
  timestamp: number;
}

export function cacheProfile(profile: CachedProfile['profile'], userId: string): void {
  try {
    const cached: CachedProfile = {
      profile,
      userId,
      timestamp: Date.now(),
    };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached));
    console.log('💾 Profile cached in localStorage');
  } catch (error) {
    console.warn('⚠️ Failed to cache profile:', error);
  }
}

export function getCachedProfile(): CachedProfile | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedProfile = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    // Check if cache is expired
    if (age > CACHE_EXPIRATION_MS) {
      console.log('⏰ Profile cache expired, clearing...');
      clearCachedProfile();
      return null;
    }

    console.log(`✅ Using cached profile (age: ${Math.round(age / 1000)}s)`);
    return parsed;
  } catch (error) {
    console.warn('⚠️ Failed to read cached profile:', error);
    return null;
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    console.log('🗑️ Profile cache cleared');
  } catch (error) {
    console.warn('⚠️ Failed to clear profile cache:', error);
  }
}

export function isProfileCacheValid(): boolean {
  const cached = getCachedProfile();
  return cached !== null;
}

