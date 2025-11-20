/**
 * User Migration Service
 * Migrate localStorage data to relational database structure
 */
import { supabase } from '../utils/supabase';

export interface LocalStorageRound {
  id: string;
  createdAt: string;
  matchups: any[];
  picks: any[];
  entryAmount?: number;
  winnings?: number;
  multiplier?: number;
}

export interface MigrationResult {
  userId: string;
  roundsMigrated: number;
  entriesCreated: number;
  picksCreated: number;
  errors: string[];
  success: boolean;
}

export class UserMigrationService {
  
  /**
   * Migrate user's localStorage data to relational database
   */
  async migrateUserData(userId: string, localStorageData: {
    rounds: LocalStorageRound[];
    bankroll: number;
    preferences?: any;
  }): Promise<MigrationResult> {
    
    console.log(`🔄 Migrating data for user ${userId}: ${localStorageData.rounds.length} rounds`);
    
    const result: MigrationResult = {
      userId,
      roundsMigrated: 0,
      entriesCreated: 0, 
      picksCreated: 0,
      errors: [],
      success: false
    };
    
    try {
      // Update user profile with current data
      await this.updateUserProfile(userId, localStorageData);
      
      // Create a default contest for migration if none exists
      const defaultContest = await this.ensureDefaultContestExists();
      
      // Migrate each round
      for (const round of localStorageData.rounds) {
        try {
          const migrationResult = await this.migrateRound(userId, round, defaultContest.id);
          
          if (migrationResult.success) {
            result.roundsMigrated++;
            result.entriesCreated += migrationResult.entriesCreated;
            result.picksCreated += migrationResult.picksCreated;
          } else {
            result.errors.push(`Round ${round.id}: ${migrationResult.error}`);
          }
          
        } catch (roundError) {
          result.errors.push(`Round ${round.id}: ${roundError.message}`);
        }
      }
      
      result.success = result.roundsMigrated > 0;
      
      console.log(`✅ Migration complete: ${result.roundsMigrated}/${localStorageData.rounds.length} rounds migrated`);
      return result;
      
    } catch (error) {
      console.error(`❌ Migration failed for user ${userId}:`, error);
      result.errors.push(error.message);
      return result;
    }
  }
  
  /**
   * Migrate a single round from localStorage to relational structure
   */
  private async migrateRound(userId: string, round: LocalStorageRound, contestId: string) {
    console.log(`  📝 Migrating round ${round.id}...`);
    
    try {
      // Create user entry
      const { data: userEntry, error: entryError } = await supabase
        .from('user_entries')
        .insert({
          contest_id: contestId,
          user_id: userId,
          entry_amount: round.entryAmount || 10.00,
          max_multiplier: round.multiplier || 2,
          status: round.winnings ? (round.winnings > 0 ? 'won' : 'lost') : 'pending',
          total_picks: round.picks?.length || 0,
          correct_picks: this.calculateCorrectPicks(round),
          gross_winnings: round.winnings || 0,
          is_settled: !!round.winnings,
          settled_at: round.winnings ? round.createdAt : null
        })
        .select()
        .single();
      
      if (entryError) throw entryError;
      
      // Create individual picks
      let picksCreated = 0;
      
      for (const pick of round.picks || []) {
        try {
          // Try to find matching matchup in new system or create placeholder
          const matchupId = await this.findOrCreatePlaceholderMatchup(pick);
          
          const { error: pickError } = await supabase
            .from('user_picks')
            .insert({
              user_entry_id: userEntry.id,
              matchup_id: matchupId,
              selected_side: pick.side || 'A',
              is_winner: pick.isWinner,
              resulted_at: pick.resultedAt || null
            });
          
          if (pickError) {
            console.warn(`    Pick error: ${pickError.message}`);
          } else {
            picksCreated++;
          }
          
        } catch (pickError) {
          console.warn(`    Pick exception: ${pickError.message}`);
        }
      }
      
      // Create round record
      const { error: roundError } = await supabase
        .from('rounds')
        .insert({
          user_entry_id: userEntry.id,
          total_picks: round.picks?.length || 0,
          correct_picks: this.calculateCorrectPicks(round),
          entry_amount: round.entryAmount || 10.00,
          actual_payout: round.winnings || 0,
          status: round.winnings ? (round.winnings > 0 ? 'won' : 'lost') : 'live',
          completed_at: round.winnings ? round.createdAt : null
        });
      
      if (roundError) throw roundError;
      
      return {
        success: true,
        entriesCreated: 1,
        picksCreated,
        error: null
      };
      
    } catch (error) {
      return {
        success: false,
        entriesCreated: 0,
        picksCreated: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Update user profile with localStorage data
   */
  private async updateUserProfile(userId: string, localData: any) {
    const updates: any = {};
    
    if (localData.bankroll) {
      updates.bankroll = localData.bankroll;
    }
    
    if (localData.preferences) {
      updates.favorite_tracks = localData.preferences.tracks || [];
    }
    
    // Calculate user statistics from rounds
    const totalRounds = localData.rounds.length;
    const wonRounds = localData.rounds.filter(r => r.winnings && r.winnings > 0).length;
    const totalWinnings = localData.rounds.reduce((sum, r) => sum + (r.winnings || 0), 0);
    
    updates.total_entries = totalRounds;
    updates.total_winnings = totalWinnings;
    updates.win_percentage = totalRounds > 0 ? (wonRounds / totalRounds) * 100 : 0;
    updates.last_login = new Date().toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) {
      console.error('Profile update error:', error);
    } else {
      console.log(`✅ Updated profile for user ${userId}: ${totalRounds} rounds, $${totalWinnings} winnings`);
    }
  }
  
  /**
   * Ensure default contest exists for migration
   */
  private async ensureDefaultContestExists() {
    const { data: existing } = await supabase
      .from('contests')
      .select('id')
      .eq('name', 'Legacy Rounds Migration')
      .single();
    
    if (existing) return existing;
    
    // Get first admin user
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)
      .limit(1)
      .single();
    
    if (!admin) throw new Error('No admin user found for contest creation');
    
    // Use existing contest instead of creating new one (avoids schema issues)
    const { data: contest, error } = await supabase
      .from('contests')
      .select('id, name, track, date')
      .eq('is_active', true)
      .limit(1)
      .single();
      
    if (error || !contest) {
      // Create minimal contest with only required fields
      const { data: newContest, error: createError } = await supabase
        .from('contests')
        .insert({
          track: 'MIGRATION',
          date: '2025-11-20',
          entry_fee: 10.00,
          is_active: false
        })
        .select()
        .single();
        
      if (createError) throw createError;
      return newContest;
    }
    
    if (error) throw error;
    return contest;
  }
  
  /**
   * Find matching matchup in new system or create placeholder
   */
  private async findOrCreatePlaceholderMatchup(pick: any): Promise<string> {
    // Try to find existing matchup by ID
    if (pick.matchupId) {
      const { data: existing } = await supabase
        .from('matchups')
        .select('id')
        .eq('id', pick.matchupId)
        .single();
      
      if (existing) return existing.id;
    }
    
    // Create placeholder matchup for migration
    const defaultContest = await this.ensureDefaultContestExists();
    
    const { data: placeholderMatchup, error } = await supabase
      .from('matchups')
      .insert({
        contest_id: defaultContest.id,
        matchup_type: 'legacy_migration',
        set_a_connections: [],
        set_b_connections: [],
        set_a_total_salary: 0,
        set_b_total_salary: 0,
        generation_algorithm: 'localStorage_migration'
      })
      .select()
      .single();
    
    if (error) throw error;
    return placeholderMatchup.id;
  }
  
  /**
   * Calculate correct picks from localStorage round data
   */
  private calculateCorrectPicks(round: LocalStorageRound): number {
    if (!round.picks) return 0;
    
    return round.picks.filter(pick => {
      // Different ways localStorage might indicate a win
      return pick.isWinner || pick.won || pick.result === 'win';
    }).length;
  }
  
  /**
   * Export current localStorage data for migration
   */
  static exportLocalStorageData(): any {
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
}
