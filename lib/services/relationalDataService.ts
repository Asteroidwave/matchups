/**
 * Relational Data Service - Replaces in-memory data processing
 * Uses the new relational database APIs instead of client-side transformations
 */

export interface RelationalConnection {
  id: string;
  name: string;
  role: 'jockey' | 'trainer' | 'sire';
  totalEntries: number;
  totalPoints: number;
  averagePoints: number;
  winPercentage: number;
  recentRaces: Array<{
    track: string;
    raceNumber: number;
    horseName: string;
    finishPosition: number;
    pointsEarned: number;
  }>;
}

export interface RelationalMatchup {
  id: string;
  matchupType: string;
  setA: {
    connections: RelationalConnection[];
    totalSalary: number;
    totalPoints: number;
    averageOdds: number;
  };
  setB: {
    connections: RelationalConnection[];
    totalSalary: number;
    totalPoints: number;
    averageOdds: number;
  };
  qualityScore: number;
  balanceMetrics: any;
}

/**
 * RelationalDataService - Replaces client-side data processing
 */
export class RelationalDataService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get contest with relational data - REPLACES loadAndMergeAllTracks()
   */
  async getContestData(contestId: string): Promise<{
    contest: any;
    races: any[];
    connections: RelationalConnection[];
    matchups: RelationalMatchup[];
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/contests/${contestId}/relational`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get contest data:', data);
        return null;
      }

      // Transform the relational data into the format expected by frontend
      const connections = this.transformConnectionsData(data.entries || []);
      const matchups = await this.getMatchupsForContest(contestId);

      return {
        contest: data.contest,
        races: data.races,
        connections,
        matchups
      };

    } catch (error) {
      console.error('Error fetching contest data:', error);
      return null;
    }
  }

  /**
   * Get track summary with relational data - REPLACES loadTrackData()
   */
  async getTrackSummary(trackCode: string, date: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/fixed/summary/${trackCode}/${date}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get track summary:', data);
        return null;
      }

      return data;

    } catch (error) {
      console.error('Error fetching track summary:', error);
      return null;
    }
  }

  /**
   * Get connections for matchup generation - REPLACES mergeTrackData()
   */
  async getConnectionsForContest(contestId: string): Promise<RelationalConnection[]> {
    try {
      // This would use the matchup pools from the relational database
      const response = await fetch(`${this.baseUrl}/api/v2/contests/${contestId}/connections`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get connections:', data);
        return [];
      }

      return data.connections || [];

    } catch (error) {
      console.error('Error fetching connections:', error);
      return [];
    }
  }

  /**
   * Generate matchups using relational data - REPLACES lib/matchups.ts generateMatchups()
   */
  async generateRelationalMatchups(contestId: string, options: any = {}): Promise<RelationalMatchup[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/contests/${contestId}/generate-matchups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to generate matchups:', data);
        return [];
      }

      return data.matchups || [];

    } catch (error) {
      console.error('Error generating matchups:', error);
      return [];
    }
  }

  /**
   * Get available contests - REPLACES contest loading from various sources
   */
  async getAvailableContests(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/contests`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to get contests:', data);
        return [];
      }

      return data.contests || [];

    } catch (error) {
      console.error('Error fetching contests:', error);
      return [];
    }
  }

  /**
   * Private helper: Transform raw race entries into connection objects
   */
  private transformConnectionsData(raceEntries: any[]): RelationalConnection[] {
    const connectionMap = new Map<string, RelationalConnection>();

    for (const entry of raceEntries) {
      // Process jockey
      if (entry.connections && entry.connections.role === 'jockey') {
        const jockeyId = entry.connections.id;
        if (!connectionMap.has(jockeyId)) {
          connectionMap.set(jockeyId, {
            id: jockeyId,
            name: entry.connections.name,
            role: 'jockey',
            totalEntries: 0,
            totalPoints: 0,
            averagePoints: 0,
            winPercentage: 0,
            recentRaces: []
          });
        }

        const connection = connectionMap.get(jockeyId)!;
        connection.totalEntries++;

        // Add race result if available
        if (entry.race_results && entry.race_results.points_earned) {
          connection.totalPoints += entry.race_results.points_earned;
          connection.recentRaces.push({
            track: entry.races?.race_cards?.tracks?.code || '',
            raceNumber: entry.races?.race_number || 0,
            horseName: entry.horses?.name || '',
            finishPosition: entry.race_results.finish_position || 0,
            pointsEarned: entry.race_results.points_earned
          });
        }

        // Calculate average
        connection.averagePoints = connection.totalPoints / connection.totalEntries;
      }

      // Process trainer (similar logic)
      // Process sire (similar logic)
    }

    return Array.from(connectionMap.values());
  }

  /**
   * Get matchups for contest
   */
  private async getMatchupsForContest(contestId: string): Promise<RelationalMatchup[]> {
    // This would fetch pre-generated matchups from the relational database
    // instead of generating them client-side
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/contests/${contestId}/matchups`);
      const data = await response.json();
      return data.matchups || [];
    } catch (error) {
      console.error('Error fetching matchups:', error);
      return [];
    }
  }
}

// Global instance
export const relationalDataService = new RelationalDataService();
