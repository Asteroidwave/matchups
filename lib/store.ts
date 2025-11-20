import { Round } from "@/types";

const STORAGE_KEY = "horse-racing-rounds";
const HISTORY_STORAGE_KEY = "horse-racing-rounds-history"; // Persistent history that survives contest deletion
const MAX_ROUNDS = 50;
const MAX_HISTORY_ROUNDS = 200; // Keep more history rounds

export function saveRound(round: Round): void {
  const rounds = loadRounds();
  rounds.unshift(round); // Add to beginning
  
  // Keep only last MAX_ROUNDS
  const trimmed = rounds.slice(0, MAX_ROUNDS);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    
    // Also save to history (persistent, survives contest deletion)
    const historyRounds = loadHistoryRounds();
    historyRounds.unshift(round);
    const trimmedHistory = historyRounds.slice(0, MAX_HISTORY_ROUNDS);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    // If localStorage is full, clear old data and try again
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("LocalStorage quota exceeded. Clearing old rounds history...");
      try {
        // Clear history and keep only recent rounds
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        
        // Save only the current round to history
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([round]));
        console.log("Successfully cleared old data and saved round");
      } catch (retryError) {
        console.error("Failed to save round even after clearing storage:", retryError);
        // Last resort: clear everything except current round
        localStorage.clear();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([round]));
        } catch (finalError) {
          console.error("Critical: Cannot save to localStorage at all:", finalError);
        }
      }
    } else {
    console.error("Failed to save round:", error);
    }
  }
}

export function loadRounds(): Round[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const rounds = JSON.parse(stored) as Round[];
    return rounds;
  } catch (error) {
    console.error("Failed to load rounds:", error);
    return [];
  }
}

export function loadHistoryRounds(): Round[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];
    
    const rounds = JSON.parse(stored) as Round[];
    return rounds;
  } catch (error) {
    console.error("Failed to load history rounds:", error);
    return [];
  }
}

export function clearRounds(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Note: We don't clear history rounds - they persist even when contests are deleted
  } catch (error) {
    console.error("Failed to clear rounds:", error);
  }
}

/**
 * Clear all old cache data to free up localStorage space
 * This includes rounds history and any other cached data
 */
export function clearOldCacheData(): void {
  try {
    console.log('[Store] Clearing old cache data...');
    
    // Clear rounds history
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    
    // Clear any other cache keys that might be taking up space
    const cacheKeys = [
      'horse-racing-cache',
      'horse-racing-matchups-cache',
      'horse-racing-connections-cache',
      'horse-racing-profile-cache',
    ];
    
    cacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`[Store] Cleared cache: ${key}`);
      }
    });
    
    console.log('[Store] Cache cleanup complete');
  } catch (error) {
    console.error('[Store] Failed to clear cache data:', error);
  }
}

/**
 * Get the current localStorage usage (approximate)
 */
export function getLocalStorageUsage(): { used: number; total: number; percentage: number } {
  try {
    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Most browsers limit localStorage to 5-10MB
    const total = 5 * 1024 * 1024; // Assume 5MB limit
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  } catch (error) {
    console.error('[Store] Failed to get localStorage usage:', error);
    return { used: 0, total: 0, percentage: 0 };
  }
}

