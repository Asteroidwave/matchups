/**
 * DEPRECATED: lib/store.ts functionality
 * 
 * This file is kept for reference but should NOT be used in new code.
 * All localStorage functionality has been replaced with relational database storage.
 * 
 * OLD SYSTEM (DEPRECATED):
 * - saveRound() -> localStorage
 * - loadRounds() -> localStorage  
 * - clearRounds() -> localStorage
 * 
 * NEW SYSTEM (USE INSTEAD):
 * - userDataService.submitContestEntry() -> Database
 * - userDataService.getUserRounds() -> Database
 * - useUserData() hook for React components
 * 
 * MIGRATION GUIDE:
 * 
 * OLD: import { saveRound, loadRounds } from "@/lib/store";
 * NEW: import { useUserData } from "@/hooks/useUserData";
 * 
 * OLD: saveRound(roundData);
 * NEW: const { submitRound } = useUserData(); 
 *      await submitRound(contestId, picks, entryAmount);
 * 
 * OLD: const rounds = loadRounds();
 * NEW: const { rounds } = useUserData();
 * 
 * BENEFITS OF NEW SYSTEM:
 * ✅ Data persists across devices and sessions
 * ✅ Multi-user support with data isolation
 * ✅ Real-time synchronization
 * ✅ Complete audit trail
 * ✅ Scalable to thousands of users
 * ✅ Professional user account system
 */

// Re-export the original functions for backward compatibility during migration
// These will show deprecation warnings
export function saveRound(round: any): void {
  console.warn('⚠️ DEPRECATED: saveRound() is deprecated. Use userDataService.submitContestEntry() instead.');
  console.warn('📖 Migration guide: See lib/store-deprecated.ts');
  
  // Original localStorage implementation (for temporary compatibility)
  if (typeof window !== 'undefined') {
    try {
      const rounds = loadRounds();
      rounds.unshift(round);
      localStorage.setItem('horse-racing-rounds', JSON.stringify(rounds.slice(0, 50)));
    } catch (error) {
      console.error('localStorage saveRound error:', error);
    }
  }
}

export function loadRounds(): any[] {
  console.warn('⚠️ DEPRECATED: loadRounds() is deprecated. Use useUserData() hook instead.');
  console.warn('📖 Migration guide: See lib/store-deprecated.ts');
  
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('horse-racing-rounds');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('localStorage loadRounds error:', error);
    return [];
  }
}

export function clearRounds(): void {
  console.warn('⚠️ DEPRECATED: clearRounds() is deprecated. Data now managed by user accounts.');
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('horse-racing-rounds');
    localStorage.removeItem('horse-racing-rounds-history');
  }
}
