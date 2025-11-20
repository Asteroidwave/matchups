/**
 * useUserData Hook - REPLACES localStorage dependencies
 * Provides user data management with automatic persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userDataService } from '@/lib/services/userDataService';

export interface UseUserDataReturn {
  // User profile
  profile: any | null;
  bankroll: number;
  
  // User rounds & history  
  rounds: any[];
  roundsLoading: boolean;
  
  // Actions
  loadUserData: () => Promise<void>;
  submitRound: (contestId: string, picks: any[], entryAmount: number) => Promise<boolean>;
  updateProfile: (updates: any) => Promise<boolean>;
  
  // Migration
  needsMigration: boolean;
  migrateData: () => Promise<boolean>;
  
  // State
  loading: boolean;
  error: string | null;
}

/**
 * Hook for user data management - replaces localStorage usage
 */
export function useUserData(): UseUserDataReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Initialize user data service and check migration needs
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setRounds([]);
      setNeedsMigration(false);
      return;
    }

    userDataService.setUser(user.id);
    loadUserData();
    checkMigrationNeeds();
  }, [user?.id]);

  /**
   * Load user profile and rounds from database
   */
  const loadUserData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const [userProfile, userRounds] = await Promise.all([
        userDataService.getUserProfile(),
        userDataService.getUserRounds()
      ]);

      setProfile(userProfile);
      setRounds(userRounds);

      console.log(`✅ User data loaded: ${userRounds.length} rounds, $${userProfile?.bankroll} bankroll`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load user data';
      setError(errorMsg);
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Submit contest entry - REPLACES saveRound() localStorage
   */
  const submitRound = useCallback(async (
    contestId: string,
    picks: any[],
    entryAmount: number
  ): Promise<boolean> => {
    if (!user?.id) {
      setError('No user authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await userDataService.submitContestEntry({
        contestId,
        picks,
        entryAmount
      });

      if (result.success) {
        // Refresh user data to show updated bankroll and new round
        await loadUserData();
        console.log('✅ Round submitted and saved to database');
        return true;
      } else {
        setError(result.error || 'Failed to submit round');
        return false;
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit round';
      setError(errorMsg);
      console.error('Error submitting round:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadUserData]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates: any): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const success = await userDataService.updateProfile(updates);
      if (success) {
        await loadUserData(); // Refresh to get updated data
      }
      return success;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }, [user?.id, loadUserData]);

  /**
   * Check if user needs to migrate localStorage data
   */
  const checkMigrationNeeds = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const hasLocalData = 
        localStorage.getItem('horse-racing-rounds') ||
        localStorage.getItem('horse-racing-rounds-history');

      setNeedsMigration(!!hasLocalData);
    } catch (error) {
      console.error('Error checking migration needs:', error);
    }
  }, []);

  /**
   * Migrate localStorage data to database
   */
  const migrateData = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    setLoading(true);

    try {
      const result = await userDataService.migrateLocalStorageData();
      
      if (result.success) {
        setNeedsMigration(false);
        await loadUserData(); // Refresh to show migrated data
        console.log(`✅ Migration successful: ${result.migrated} rounds migrated`);
        return true;
      } else {
        setError(`Migration failed: ${result.errors.join(', ')}`);
        return false;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Migration failed';
      setError(errorMsg);
      console.error('Migration error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadUserData]);

  return {
    profile,
    bankroll: profile?.bankroll || 0,
    rounds,
    roundsLoading,
    loadUserData,
    submitRound,
    updateProfile,
    needsMigration,
    migrateData,
    loading,
    error
  };
}
