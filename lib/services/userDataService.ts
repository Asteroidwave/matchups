/**
 * User Data Service - Replaces localStorage with relational database
 * This replaces lib/store.ts and provides persistent user data
 */

export interface UserRound {
  id: string;
  status: string;
  entryAmount: number;
  actualPayout: number;
  totalPicks: number;
  correctPicks: number;
  winPercentage: number;
  contestName: string;
  contestDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  bankroll: number;
  totalWinnings: number;
  totalEntries: number;
  winPercentage: number;
  favoriteTracks: string[];
  subscriptionTier: string;
  lastLogin?: string;
  isAdmin?: boolean; // Add admin status
}

export interface ContestEntry {
  contestId: string;
  picks: Array<{ matchupId: string; side: 'A' | 'B' }>;
  entryAmount: number;
  multiplier?: number;
  isFlexible?: boolean;
}

/**
 * UserDataService - Complete replacement for localStorage
 */
export class UserDataService {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set current user (call after authentication)
   */
  setUser(userId: string) {
    this.userId = userId;
    console.log(`✅ UserDataService initialized for user: ${userId}`);
  }

  /**
   * Get user's profile and statistics
   */
  async getUserProfile(): Promise<UserProfile | null> {
    if (!this.userId) {
      throw new Error('No user authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/users/${this.userId}/profile`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get user profile:', data);
        return null;
      }

      return {
        id: data.profile.id,
        email: data.profile.email,
        username: data.profile.username,
        displayName: data.profile.display_name,
        bankroll: data.profile.bankroll,
        totalWinnings: data.profile.total_winnings || 0,
        totalEntries: data.profile.total_entries || 0,
        winPercentage: data.profile.win_percentage || 0,
        favoriteTracks: data.profile.favorite_tracks || [],
        subscriptionTier: data.profile.subscription_tier || 'free',
        lastLogin: data.profile.last_login,
        isAdmin: data.profile.is_admin === true // Include admin status
      };

    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Get user's round history - REPLACES loadRounds() from localStorage
   */
  async getUserRounds(limit: number = 50): Promise<UserRound[]> {
    if (!this.userId) {
      return []; // Return empty if no user (graceful degradation)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/users/${this.userId}/rounds?limit=${limit}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get user rounds:', data);
        return [];
      }

      return (data.rounds || []).map((round: any) => ({
        id: round.id,
        status: round.status,
        entryAmount: round.entry_amount,
        actualPayout: round.actual_payout || 0,
        totalPicks: round.total_picks,
        correctPicks: round.correct_picks,
        winPercentage: round.total_picks > 0 ? (round.correct_picks / round.total_picks) * 100 : 0,
        contestName: round.user_entries?.contests?.name || 'Unknown Contest',
        contestDate: round.user_entries?.contests?.contest_date || '',
        createdAt: round.created_at,
        completedAt: round.completed_at
      }));

    } catch (error) {
      console.error('Error fetching user rounds:', error);
      return [];
    }
  }

  /**
   * Submit contest entry - REPLACES saveRound() to localStorage  
   */
  async submitContestEntry(entry: ContestEntry): Promise<{ success: boolean; entryId?: string; error?: string }> {
    if (!this.userId) {
      throw new Error('No user authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/users/${this.userId}/contests/${entry.contestId}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          picks: entry.picks,
          entryAmount: entry.entryAmount,
          multiplier: entry.multiplier || 2,
          isFlexible: entry.isFlexible || false
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to submit entry'
        };
      }

      return {
        success: true,
        entryId: data.userEntry?.id
      };

    } catch (error) {
      console.error('Error submitting contest entry:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<boolean> {
    if (!this.userId) {
      throw new Error('No user authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/users/${this.userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      return response.ok;

    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  /**
   * Migrate localStorage data to database (one-time migration)
   */
  async migrateLocalStorageData(): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    if (!this.userId) {
      throw new Error('No user authenticated');
    }

    // Export localStorage data
    const localData = this.exportLocalStorageData();
    if (!localData || localData.rounds.length === 0) {
      return { success: true, migrated: 0, errors: ['No localStorage data to migrate'] };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/users/${this.userId}/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localStorageData: localData })
      });

      const data = await response.json();

      if (response.ok) {
        // Clear localStorage after successful migration
        this.clearLocalStorage();
        
        return {
          success: data.result.success,
          migrated: data.result.roundsMigrated,
          errors: data.result.errors || []
        };
      } else {
        return {
          success: false,
          migrated: 0,
          errors: [data.message || 'Migration failed']
        };
      }

    } catch (error) {
      console.error('Error during migration:', error);
      return {
        success: false,
        migrated: 0,
        errors: [error instanceof Error ? error.message : 'Migration error']
      };
    }
  }

  /**
   * Export localStorage data for migration
   */
  private exportLocalStorageData(): any {
    if (typeof window === 'undefined') return null;

    try {
      const rounds = localStorage.getItem('horse-racing-rounds');
      const history = localStorage.getItem('horse-racing-rounds-history');
      const bankroll = localStorage.getItem('bankroll');

      return {
        rounds: rounds ? JSON.parse(rounds) : [],
        history: history ? JSON.parse(history) : [],
        bankroll: bankroll ? parseFloat(bankroll) : 1000,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting localStorage:', error);
      return null;
    }
  }

  /**
   * Clear localStorage after migration
   */
  private clearLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('horse-racing-rounds');
      localStorage.removeItem('horse-racing-rounds-history');
      // Keep bankroll for now (might be used elsewhere)
      console.log('✅ localStorage cleared after successful migration');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  /**
   * Get user's current bankroll (for real-time display)
   */
  async getBankroll(): Promise<number> {
    const profile = await this.getUserProfile();
    return profile?.bankroll || 0;
  }

  /**
   * Update user's bankroll after contest entry
   */
  async updateBankroll(newAmount: number): Promise<boolean> {
    return await this.updateProfile({ bankroll: newAmount });
  }
}

// Global instance (will be initialized with user ID after auth)
export const userDataService = new UserDataService();
