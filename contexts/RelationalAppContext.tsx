/**
 * Relational App Context - REPLACES AppContext.tsx localStorage dependencies
 * Uses relational database APIs instead of localStorage and in-memory processing
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { userDataService, UserDataService } from "@/lib/services/userDataService";
import { relationalDataService, RelationalDataService } from "@/lib/services/relationalDataService";

export interface RelationalAppState {
  // User-specific data (from database)
  userProfile: any | null;
  userRounds: any[];
  userBankroll: number;
  
  // Contest data (from relational APIs)
  availableContests: any[];
  currentContest: any | null;
  contestConnections: any[];
  contestMatchups: any[];
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Migration status
  hasMigratedFromLocalStorage: boolean;
  migrationStatus: 'pending' | 'in_progress' | 'complete' | 'error';
}

interface RelationalAppContextType extends RelationalAppState {
  // User actions
  loadUserData: () => Promise<void>;
  submitRound: (contestId: string, picks: any[], entryAmount: number, multiplier: number) => Promise<boolean>;
  updateUserProfile: (updates: any) => Promise<boolean>;
  
  // Contest actions  
  loadAvailableContests: () => Promise<void>;
  selectContest: (contestId: string) => Promise<void>;
  generateMatchups: (options?: any) => Promise<void>;
  
  // Migration
  migrateFromLocalStorage: () => Promise<void>;
  
  // Utilities
  refreshUserData: () => Promise<void>;
}

const RelationalAppContext = createContext<RelationalAppContextType | undefined>(undefined);

export function RelationalAppProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth(); // Get authenticated user
  
  // State management
  const [state, setState] = useState<RelationalAppState>({
    userProfile: null,
    userRounds: [],
    userBankroll: 0,
    availableContests: [],
    currentContest: null,
    contestConnections: [],
    contestMatchups: [],
    isLoading: false,
    error: null,
    hasMigratedFromLocalStorage: false,
    migrationStatus: 'pending'
  });

  // Initialize user data service when user changes
  useEffect(() => {
    if (user?.id) {
      console.log(`🔄 Initializing relational data for user: ${user.id}`);
      userDataService.setUser(user.id);
      loadUserData();
      checkMigrationStatus();
    } else {
      if (process.env.NODE_ENV === 'development') {
      console.log('👤 No user authenticated, clearing state');
    }
      setState(prev => ({
        ...prev,
        userProfile: null,
        userRounds: [],
        userBankroll: 0,
        hasMigratedFromLocalStorage: false
      }));
    }
  }, [user?.id]);

  /**
   * Load all user data from database
   */
  const loadUserData = useCallback(async () => {
    if (!user?.id) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [userProfile, userRounds, availableContests] = await Promise.all([
        userDataService.getUserProfile(),
        userDataService.getUserRounds(),
        relationalDataService.getAvailableContests()
      ]);

      setState(prev => ({
        ...prev,
        userProfile,
        userRounds,
        userBankroll: userProfile?.bankroll || 0,
        availableContests,
        isLoading: false
      }));

      console.log(`✅ Loaded user data: ${userRounds.length} rounds, $${userProfile?.bankroll} bankroll`);

    } catch (error) {
      console.error('Error loading user data:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load user data',
        isLoading: false
      }));
    }
  }, [user?.id]);

  /**
   * Submit contest round using relational database
   */
  const submitRound = useCallback(async (
    contestId: string, 
    picks: any[], 
    entryAmount: number, 
    multiplier: number
  ): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('No user authenticated');
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await userDataService.submitContestEntry({
        contestId,
        picks,
        entryAmount,
        multiplier
      });

      if (result.success) {
        // Refresh user data to get updated bankroll and rounds
        await loadUserData();
        console.log('✅ Round submitted successfully');
        return true;
      } else {
        setState(prev => ({ ...prev, error: result.error || 'Failed to submit round' }));
        return false;
      }

    } catch (error) {
      console.error('Error submitting round:', error);
      setState(prev => ({ ...prev, error: 'Failed to submit round', isLoading: false }));
      return false;
    }
  }, [user?.id, loadUserData]);

  /**
   * Select contest and load its data
   */
  const selectContest = useCallback(async (contestId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const contestData = await relationalDataService.getContestData(contestId);

      if (contestData) {
        setState(prev => ({
          ...prev,
          currentContest: contestData.contest,
          contestConnections: contestData.connections,
          contestMatchups: contestData.matchups,
          isLoading: false
        }));

        console.log(`✅ Contest selected: ${contestData.contest.name}`);
      } else {
        setState(prev => ({ ...prev, error: 'Failed to load contest data', isLoading: false }));
      }

    } catch (error) {
      console.error('Error selecting contest:', error);
      setState(prev => ({ ...prev, error: 'Failed to select contest', isLoading: false }));
    }
  }, []);

  /**
   * Generate matchups using relational data
   */
  const generateMatchups = useCallback(async (options: any = {}) => {
    if (!state.currentContest) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const matchups = await relationalDataService.generateRelationalMatchups(
        state.currentContest.id,
        options
      );

      setState(prev => ({
        ...prev,
        contestMatchups: matchups,
        isLoading: false
      }));

      console.log(`✅ Generated ${matchups.length} matchups using relational data`);

    } catch (error) {
      console.error('Error generating matchups:', error);
      setState(prev => ({ ...prev, error: 'Failed to generate matchups', isLoading: false }));
    }
  }, [state.currentContest]);

  /**
   * Check if user has localStorage data that needs migration
   */
  const checkMigrationStatus = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const hasLocalStorageData = 
        localStorage.getItem('horse-racing-rounds') ||
        localStorage.getItem('horse-racing-rounds-history');

      setState(prev => ({
        ...prev,
        hasMigratedFromLocalStorage: !hasLocalStorageData,
        migrationStatus: hasLocalStorageData ? 'pending' : 'complete'
      }));

    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  }, []);

  /**
   * Migrate localStorage data to database
   */
  const migrateFromLocalStorage = useCallback(async () => {
    if (!user?.id) return;

    setState(prev => ({ ...prev, migrationStatus: 'in_progress' }));

    try {
      const result = await userDataService.migrateLocalStorageData();

      if (result.success) {
        setState(prev => ({
          ...prev,
          hasMigratedFromLocalStorage: true,
          migrationStatus: 'complete'
        }));

        // Refresh user data to show migrated rounds
        await loadUserData();

        console.log(`✅ Migration complete: ${result.migrated} rounds migrated`);
      } else {
        setState(prev => ({ ...prev, migrationStatus: 'error' }));
        console.error('Migration failed:', result.errors);
      }

    } catch (error) {
      console.error('Error during migration:', error);
      setState(prev => ({ ...prev, migrationStatus: 'error' }));
    }
  }, [user?.id, loadUserData]);

  /**
   * Update user profile
   */
  const updateUserProfile = useCallback(async (updates: any): Promise<boolean> => {
    const success = await userDataService.updateProfile(updates);
    if (success) {
      await loadUserData(); // Refresh to get updated data
    }
    return success;
  }, [loadUserData]);

  /**
   * Load available contests
   */
  const loadAvailableContests = useCallback(async () => {
    try {
      const contests = await relationalDataService.getAvailableContests();
      setState(prev => ({ ...prev, availableContests: contests }));
    } catch (error) {
      console.error('Error loading contests:', error);
    }
  }, []);

  /**
   * Refresh all user data
   */
  const refreshUserData = useCallback(async () => {
    await loadUserData();
  }, [loadUserData]);

  const contextValue: RelationalAppContextType = {
    ...state,
    loadUserData,
    submitRound,
    updateUserProfile,
    loadAvailableContests,
    selectContest,
    generateMatchups,
    migrateFromLocalStorage,
    refreshUserData
  };

  return (
    <RelationalAppContext.Provider value={contextValue}>
      {children}
    </RelationalAppContext.Provider>
  );
}

export function useRelationalApp() {
  const context = useContext(RelationalAppContext);
  if (context === undefined) {
    throw new Error('useRelationalApp must be used within a RelationalAppProvider');
  }
  return context;
}

export default RelationalAppContext;
