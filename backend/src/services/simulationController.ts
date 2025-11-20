/**
 * Simulation Controller
 * Manages simulated live races for testing
 */

import { supabase } from '../utils/supabase';
import { SimulationConfig, SimulationState, SimulatedRace, RaceResult, MatchupProgress, RoundProgress, SimulationEvent } from '../types/simulation';
import { EventEmitter } from 'events';
import { getEquibaseResults } from '../utils/mongodb';

class SimulationController extends EventEmitter {
  private simulations: Map<string, SimulationState> = new Map();
  private timers: Map<string, NodeJS.Timeout[]> = new Map();
  
  /**
   * Create a new simulation from a contest
   */
  async createSimulation(config: SimulationConfig): Promise<SimulationState> {
    console.log('[Simulation] Creating simulation for contest:', config.contestId);
    
    // Fetch contest data
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('id', config.contestId)
      .single();
    
    if (contestError || !contest) {
      throw new Error('Contest not found');
    }
    
    // Fetch track data for the contest
    let records: any[] = [];
    let trackDataObj: any = null;
    
    // Check if this is an ALL TRACKS contest
    if (contest.track === 'ALL') {
      console.log('[Simulation] ALL TRACKS contest detected, loading data from all tracks...');
      
      // Load track data from ALL tracks for this date
      const { data: allTrackData, error: allTrackError } = await supabase
        .from('track_data')
        .select('*')
        .eq('date', contest.date);
      
      if (allTrackError || !allTrackData || allTrackData.length === 0) {
        throw new Error('No track data found for ALL TRACKS contest. Please fetch track data for individual tracks first.');
      }
      
      console.log(`[Simulation] Loaded data from ${allTrackData.length} tracks`);
      
      // Merge all records from all tracks
      for (const trackData of allTrackData) {
        const trackRecords = trackData.data?.records || trackData.data?.entries || [];
        records.push(...trackRecords);
      }
      
      trackDataObj = { data: { records, entries: records } };
      
    } else if (contest.track_data_id) {
      // Use the track_data_id from the contest
      const { data: trackData, error: trackError } = await supabase
        .from('track_data')
        .select('*')
        .eq('id', contest.track_data_id)
        .single();
      
      if (trackError || !trackData) {
        console.error('[Simulation] Error fetching track data by ID:', trackError);
        throw new Error('Track data not found. Make sure you have fetched track data for this contest.');
      }
      
      trackDataObj = trackData;
      records = trackData.data?.records || trackData.data?.entries || [];
    } else {
      // Fallback: try to find by track and date
      const { data: trackData, error: trackError } = await supabase
        .from('track_data')
        .select('*')
        .eq('track_code', contest.track)
        .eq('date', contest.date)
        .single();
      
      if (trackError || !trackData) {
        console.error('[Simulation] Error fetching track data:', trackError);
        throw new Error('Track data not found. Please fetch track data for this contest first in the Admin panel.');
      }
      
      trackDataObj = trackData;
      records = trackData.data?.records || trackData.data?.entries || [];
    }
    
    console.log('[Simulation] Track data structure:', Object.keys(trackDataObj?.data || {}));
    console.log('[Simulation] Records found:', records.length);
    
    if (records.length === 0) {
      throw new Error('No race data found in track data. The data field has keys: ' + Object.keys(trackDataObj?.data || {}).join(', ') + '. Please ensure track data was fetched correctly.');
    }
    
    console.log('[Simulation] Loaded', records.length, 'race records for', contest.track, contest.date);
    
    // Group races by track and race number
    const racesMap = new Map<string, any[]>();
    for (const record of records) {
      const key = `${record.track}-${record.race}`;
      if (!racesMap.has(key)) {
        racesMap.set(key, []);
      }
      racesMap.get(key)!.push(record);
    }
    
    // Create simulated races with 1-minute intervals
    const races: SimulatedRace[] = [];
    const now = new Date();
    let raceIndex = 0;
    
    for (const [key, horses] of Array.from(racesMap.entries())) {
      const [track, raceNumStr] = key.split('-');
      const raceNumber = parseInt(raceNumStr);
      
      // Get post time from any horse in the race (they should all have the same post time)
      let postTime = '';
      for (const horse of horses) {
        postTime = horse.post_time || horse.postTime || horse.post || horse.mtp || horse.scheduledStart || '';
        if (postTime) break; // Use first found post time
      }
      
      // Schedule races at 2-minute intervals (1 min race + 1 min break)
      const startOffset = raceIndex * 2 * 60 * 1000 / config.speedMultiplier;
      const endOffset = (raceIndex * 2 + 1) * 60 * 1000 / config.speedMultiplier;
      
      races.push({
        track,
        raceNumber,
        scheduledStart: new Date(now.getTime() + startOffset),
        actualStart: null,
        scheduledEnd: new Date(now.getTime() + endOffset),
        actualEnd: null,
        status: 'pending',
        horses,
        results: [], // Will be populated from actual results when race finishes
        postTime: postTime,
      });
      
      raceIndex++;
    }
    
    // Sort races by scheduled start time
    races.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
    
    // Fetch all PENDING entries (rounds) for this contest
    // IMPORTANT: Only load pending entries to avoid including completed rounds
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*')
      .eq('contest_id', config.contestId)
      .eq('status', 'pending'); // Only load pending entries
    
    if (entriesError) {
      console.error('[Simulation] Error fetching entries:', entriesError);
    }
    
    // Fetch matchups for ALL contests on this date (to support multi-track picks)
    // This allows users to pick from any track and have the simulation work
    const { data: allContestsForDate, error: contestsError } = await supabase
      .from('contests')
      .select('id')
      .eq('date', contest.date);
    
    const contestIds = allContestsForDate?.map(c => c.id) || [config.contestId];
    console.log(`[Simulation] Loading matchups from ${contestIds.length} contests for date ${contest.date}`);
    
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .in('contest_id', contestIds);
    
    if (matchupsError) {
      console.error('[Simulation] Error fetching matchups:', matchupsError);
    }
    
    // Also fetch cross-track bundles
    const { data: bundles, error: bundleError } = await supabase
      .from('multi_track_bundles')
      .select('*')
      .eq('date', contest.date)
      .eq('status', 'ready');
    
    console.log(`[Simulation] Found ${bundles?.length || 0} cross-track bundles`);
    
    // Build a map of all matchups by ID
    const allMatchups = new Map<string, any>();
    if (matchupsData) {
      for (const row of matchupsData) {
        const matchupData = row.matchup_data;
        if (matchupData && matchupData.matchups) {
          for (const matchup of matchupData.matchups) {
            if (matchup.id) {
              allMatchups.set(matchup.id, matchup);
            }
          }
        }
      }
    }
    
    // Add cross-track matchups from bundles
    if (bundles) {
      for (const bundle of bundles) {
        const bundleMatchups = bundle.matchup_data?.matchups || [];
        for (const matchup of bundleMatchups) {
          if (matchup.id) {
            allMatchups.set(matchup.id, matchup);
          }
        }
        console.log(`[Simulation] Added ${bundleMatchups.length} cross-track matchups from bundle`);
      }
    }
    
    console.log('[Simulation] Loaded', allMatchups.size, 'matchups for contest', config.contestId);
    
    // Log first few matchup IDs for debugging
    const matchupIdSample = Array.from(allMatchups.keys()).slice(0, 5);
    console.log('[Simulation] Sample matchup IDs in database:', matchupIdSample);
    
    // Create round progress tracking for each entry with populated matchups
    const rounds: RoundProgress[] = (entries || []).map((entry: any) => {
      const picks = entry.picks || [];
      
      console.log('[Simulation] Processing entry:', entry.id, 'with', picks.length, 'picks');
      console.log('[Simulation] Pick matchup IDs:', picks.map((p: any) => p.matchupId || p.matchup_id));
      
      // Populate matchup progress for each pick
      const matchups: MatchupProgress[] = picks.map((pick: any) => {
        const matchupId = pick.matchupId || pick.matchup_id;
        const matchup = allMatchups.get(matchupId);
        
        if (!matchup) {
          console.warn('[Simulation] ❌ Matchup not found for pick:', matchupId);
          console.warn('[Simulation] Available matchup IDs:', Array.from(allMatchups.keys()).slice(0, 10));
          return null;
        }
        
        console.log('[Simulation] ✅ Found matchup:', matchupId);
        
        const chosenSide = (pick.chosen || pick.side || 'A').toUpperCase();
        
        return {
          matchupId: matchupId,
          chosenSide: chosenSide,
          setA: {
            connections: matchup.setA.connections,
            currentPoints: 0,
            totalRaces: this.countTotalRaces(matchup.setA.connections, races),
            finishedRaces: 0,
          },
          setB: {
            connections: matchup.setB.connections,
            currentPoints: 0,
            totalRaces: this.countTotalRaces(matchup.setB.connections, races),
            finishedRaces: 0,
          },
          status: 'pending',
          winner: null,
        };
      }).filter(Boolean) as MatchupProgress[];
      
      // Check if this entry has pre-calculated outcome
      const precalculated = entry.precalculated_outcome;
      
      if (precalculated) {
        console.log('[Simulation] Entry has pre-calculated outcome:', entry.id, precalculated.outcome);
      }
      
      return {
        roundId: entry.id,
        userId: entry.user_id,
        entryAmount: entry.entry_amount || 0,
        multiplier: entry.multiplier || 1,
        isFlex: entry.is_flex || false,
        pickCount: entry.pick_count || (entry.picks?.length || 0),
        multiplierSchedule: entry.multiplier_schedule || null,
        picks: picks,
        matchups: matchups,
        precalculatedOutcome: precalculated || null, // Store for use during simulation
        status: 'pending',
        wonMatchups: 0,
        lostMatchups: 0,
        totalPoints: 0,
        potentialWinnings: 0,
      };
    });
    
    const simulationId = `sim-${config.contestId}-${Date.now()}`;
    
    const simulation: SimulationState = {
      id: simulationId,
      contestId: config.contestId,
      status: 'ready',
      speedMultiplier: config.speedMultiplier,
      currentRaceIndex: 0,
      races,
      rounds,
      startedAt: null,
      pausedAt: null,
      pausedDuration: 0,
      finishedAt: null,
      createdAt: now,
    };
    
    this.simulations.set(simulationId, simulation);
    
    // Store in database
    await supabase.from('simulations').insert({
      id: simulationId,
      contest_id: config.contestId,
      status: 'ready',
      speed_multiplier: config.speedMultiplier,
      current_race_index: 0,
      simulation_data: simulation,
    });
    
    console.log('[Simulation] Created simulation:', simulationId, 'with', races.length, 'races', 'and', rounds.length, 'rounds');
    
    // Warn if simulation has 0 rounds
    if (rounds.length === 0) {
      console.warn('[Simulation] Warning: Simulation created with 0 rounds. This simulation will have nothing to simulate.');
    }
    
    // Only auto-start if there are rounds to simulate
    if (config.autoStart && rounds.length > 0) {
      await this.startSimulation(simulationId);
    } else if (config.autoStart && rounds.length === 0) {
      console.warn('[Simulation] Auto-start disabled: Simulation has 0 rounds');
    }
    
    return simulation;
  }
  
  /**
   * Start a simulation
   */
  async startSimulation(simulationId: string): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    if (simulation.status === 'running') {
      console.log('[Simulation] Already running:', simulationId);
      return;
    }
    
    // Prevent starting simulation with 0 rounds
    if (!simulation.rounds || simulation.rounds.length === 0) {
      throw new Error('Cannot start simulation: No rounds to simulate. Please submit entries first.');
    }
    
    console.log('[Simulation] Starting simulation:', simulationId, 'with', simulation.rounds.length, 'rounds');
    
    simulation.status = 'running';
    simulation.startedAt = new Date();
    
    // Emit started event
    this.emitEvent(simulationId, {
      type: 'simulation_started',
      simulationId,
      timestamp: new Date(),
      data: { simulation },
    });
    
    // Schedule all races
    this.scheduleRaces(simulationId);
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        status: 'running',
        started_at: simulation.startedAt,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Pause a simulation
   */
  async pauseSimulation(simulationId: string): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    if (simulation.status !== 'running') {
      return;
    }
    
    console.log('[Simulation] Pausing simulation:', simulationId);
    
    simulation.status = 'paused';
    simulation.pausedAt = new Date();
    
    // Clear all timers
    const timers = this.timers.get(simulationId) || [];
    timers.forEach(timer => clearTimeout(timer));
    this.timers.delete(simulationId);
    
    // Emit paused event
    this.emitEvent(simulationId, {
      type: 'simulation_paused',
      simulationId,
      timestamp: new Date(),
      data: { currentRaceIndex: simulation.currentRaceIndex },
    });
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        status: 'paused',
        paused_at: simulation.pausedAt,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Resume a paused simulation
   */
  async resumeSimulation(simulationId: string): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    if (simulation.status !== 'paused') {
      return;
    }
    
    console.log('[Simulation] Resuming simulation:', simulationId);
    
    const pauseDuration = simulation.pausedAt 
      ? new Date().getTime() - simulation.pausedAt.getTime()
      : 0;
    
    simulation.pausedDuration += pauseDuration;
    simulation.status = 'running';
    simulation.pausedAt = null;
    
    // Emit resumed event
    this.emitEvent(simulationId, {
      type: 'simulation_resumed',
      simulationId,
      timestamp: new Date(),
      data: { currentRaceIndex: simulation.currentRaceIndex },
    });
    
    // Reschedule remaining races
    this.scheduleRaces(simulationId);
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        status: 'running',
        paused_at: null,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Set simulation speed
   */
  async setSpeed(simulationId: string, speedMultiplier: number): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    const wasRunning = simulation.status === 'running';
    
    if (wasRunning) {
      await this.pauseSimulation(simulationId);
    }
    
    simulation.speedMultiplier = speedMultiplier;
    
    // Recalculate race times based on new speed
    const baseTime = simulation.startedAt || new Date();
    const elapsed = new Date().getTime() - baseTime.getTime() - simulation.pausedDuration;
    
    for (let i = simulation.currentRaceIndex; i < simulation.races.length; i++) {
      const offsetMinutes = (i - simulation.currentRaceIndex) * 2; // 2 min per race (1 run + 1 break)
      const startOffset = offsetMinutes * 60 * 1000 / speedMultiplier;
      const endOffset = (offsetMinutes + 1) * 60 * 1000 / speedMultiplier;
      
      simulation.races[i].scheduledStart = new Date(Date.now() + startOffset);
      simulation.races[i].scheduledEnd = new Date(Date.now() + endOffset);
    }
    
    await supabase
      .from('simulations')
      .update({
        speed_multiplier: speedMultiplier,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
    
    if (wasRunning) {
      await this.resumeSimulation(simulationId);
    }
  }
  
  /**
   * Skip to a specific race
   */
  async skipToRace(simulationId: string, raceIndex: number): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    if (raceIndex < 0 || raceIndex >= simulation.races.length) {
      throw new Error('Invalid race index');
    }
    
    // Mark all previous races as finished
    for (let i = 0; i < raceIndex; i++) {
      if (simulation.races[i].status !== 'finished') {
        await this.finishRace(simulationId, i);
      }
    }
    
    simulation.currentRaceIndex = raceIndex;
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        current_race_index: raceIndex,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Reset simulation to beginning
   */
  async resetSimulation(simulationId: string): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      throw new Error('Simulation not found');
    }
    
    // Clear all timers
    const timers = this.timers.get(simulationId) || [];
    timers.forEach(timer => clearTimeout(timer));
    this.timers.delete(simulationId);
    
    // Reset all races
    simulation.races.forEach(race => {
      race.status = 'pending';
      race.actualStart = null;
      race.actualEnd = null;
    });
    
    // Re-query entries from database to get fresh data (in case database was cleared)
    // IMPORTANT: Only fetch PENDING entries to avoid loading completed rounds
    console.log('[Simulation] Reloading entries from database for simulation:', simulationId);
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('*')
      .eq('contest_id', simulation.contestId)
      .eq('status', 'pending'); // Only load pending entries
    
    if (entriesError) {
      console.error('[Simulation] Error reloading entries:', entriesError);
    }
    
    // Fetch matchups for this contest
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .eq('contest_id', simulation.contestId);
    
    if (matchupsError) {
      console.error('[Simulation] Error fetching matchups:', matchupsError);
    }
    
    // Build a map of all matchups by ID
    const allMatchups = new Map<string, any>();
    if (matchupsData) {
      for (const row of matchupsData) {
        const matchupData = row.matchup_data;
        if (matchupData && matchupData.matchups) {
          for (const matchup of matchupData.matchups) {
            if (matchup.id) {
              allMatchups.set(matchup.id, matchup);
            }
          }
        }
      }
    }
    
    console.log('[Simulation] Loaded', allMatchups.size, 'matchups for reset');
    
    // Recreate rounds from fresh database entries with populated matchups
    const freshRounds: RoundProgress[] = (entries || []).map((entry: any) => {
      const picks = entry.picks || [];
      
      // Populate matchup progress for each pick
      const matchups: MatchupProgress[] = picks.map((pick: any) => {
        const matchupId = pick.matchupId || pick.matchup_id;
        const matchup = allMatchups.get(matchupId);
        
        if (!matchup) {
          console.warn('[Simulation] Matchup not found for pick during reset:', matchupId);
          return null;
        }
        
        const chosenSide = (pick.chosen || pick.side || 'A').toUpperCase();
        
        return {
          matchupId: matchupId,
          chosenSide: chosenSide,
          setA: {
            connections: matchup.setA.connections,
            currentPoints: 0,
            totalRaces: this.countTotalRaces(matchup.setA.connections, simulation.races),
            finishedRaces: 0,
          },
          setB: {
            connections: matchup.setB.connections,
            currentPoints: 0,
            totalRaces: this.countTotalRaces(matchup.setB.connections, simulation.races),
            finishedRaces: 0,
          },
          status: 'pending',
          winner: null,
        };
      }).filter(Boolean) as MatchupProgress[];
      
      return {
        roundId: entry.id,
        userId: entry.user_id,
        entryAmount: entry.entry_amount || 0,
        multiplier: entry.multiplier || 1,
        isFlex: entry.is_flex || false,
        pickCount: entry.pick_count || (entry.picks?.length || 0),
        multiplierSchedule: entry.multiplier_schedule || null,
        picks: picks,
        matchups: matchups,
        status: 'pending',
        wonMatchups: 0,
        lostMatchups: 0,
        totalPoints: 0,
        potentialWinnings: 0,
      };
    });
    
    console.log('[Simulation] Reloaded', freshRounds.length, 'rounds from database with populated matchups');
    
    // Replace rounds with fresh data (already has status reset)
    simulation.rounds = freshRounds;
    
    simulation.status = 'ready';
    simulation.currentRaceIndex = 0;
    simulation.startedAt = null;
    simulation.pausedAt = null;
    simulation.pausedDuration = 0;
    simulation.finishedAt = null;
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        status: 'ready',
        current_race_index: 0,
        started_at: null,
        paused_at: null,
        finished_at: null,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
    
    console.log('[Simulation] Reset simulation:', simulationId);
  }
  
  /**
   * Get simulation state
   * Optionally refresh rounds from database to ensure data is current
   */
  async getSimulation(simulationId: string, refreshRounds: boolean = false): Promise<SimulationState | null> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) {
      return null;
    }
    
    // If requested, refresh rounds from database
    if (refreshRounds) {
      console.log('[Simulation] Refreshing rounds from database for simulation:', simulationId);
      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('contest_id', simulation.contestId);
      
      if (entriesError) {
        console.error('[Simulation] Error refreshing entries:', entriesError);
      } else {
      // Recreate rounds from fresh database entries
      // Filter out any entries that are not pending (shouldn't happen with the query above, but double-check)
      const pendingEntries = (entries || []).filter((e: any) => e.status === 'pending' || !e.status);
      const freshRounds: RoundProgress[] = pendingEntries.map((entry: any) => ({
        roundId: entry.id,
        userId: entry.user_id,
        entryAmount: entry.entry_amount || 0,
        multiplier: entry.multiplier || 1,
        isFlex: entry.is_flex || false,
        pickCount: entry.pick_count || (entry.picks?.length || 0),
        multiplierSchedule: entry.multiplier_schedule || null,
        picks: entry.picks || [],
        matchups: simulation.rounds.find(r => r.roundId === entry.id)?.matchups || [], // Preserve existing matchup progress
        status: 'pending', // Always reset to pending when reloading
          wonMatchups: simulation.rounds.find(r => r.roundId === entry.id)?.wonMatchups || 0,
          lostMatchups: simulation.rounds.find(r => r.roundId === entry.id)?.lostMatchups || 0,
          totalPoints: simulation.rounds.find(r => r.roundId === entry.id)?.totalPoints || 0,
          potentialWinnings: simulation.rounds.find(r => r.roundId === entry.id)?.potentialWinnings || 0,
        }));
        
        console.log('[Simulation] Refreshed', freshRounds.length, 'rounds from database');
        simulation.rounds = freshRounds;
      }
    }
    
    return simulation;
  }
  
  /**
   * Schedule all pending races
   */
  private scheduleRaces(simulationId: string): void {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return;
    
    const timers: NodeJS.Timeout[] = [];
    const now = new Date().getTime();
    
    for (let i = simulation.currentRaceIndex; i < simulation.races.length; i++) {
      const race = simulation.races[i];
      
      if (race.status !== 'pending') continue;
      
      // Calculate delay until race starts
      const startDelay = Math.max(0, race.scheduledStart.getTime() - now);
      const endDelay = Math.max(0, race.scheduledEnd.getTime() - now);
      
      // Schedule race start
      const startTimer = setTimeout(() => {
        if (simulation.status === 'running') {
          this.startRace(simulationId, i);
        }
      }, startDelay);
      
      // Schedule race end
      const endTimer = setTimeout(() => {
        if (simulation.status === 'running') {
          this.finishRace(simulationId, i);
        }
      }, endDelay);
      
      timers.push(startTimer, endTimer);
    }
    
    this.timers.set(simulationId, timers);
  }
  
  /**
   * Start a race
   */
  private async startRace(simulationId: string, raceIndex: number): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return;
    
    const race = simulation.races[raceIndex];
    if (!race) return;
    
    console.log('[Simulation] Starting race:', race.track, 'R' + race.raceNumber);
    
    race.status = 'running';
    race.actualStart = new Date();
    simulation.currentRaceIndex = raceIndex;
    
    // Emit race started event
    this.emitEvent(simulationId, {
      type: 'race_started',
      simulationId,
      timestamp: new Date(),
      data: {
        raceIndex,
        track: race.track,
        raceNumber: race.raceNumber,
        horses: race.horses.map((h: any) => ({
          horseName: h.horse,
          jockey: h.jockey,
          trainer: h.trainer,
          odds: h.ml_odds_frac,
          programNumber: h.program_number,
        })),
      },
    });
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        current_race_index: raceIndex,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Finish a race and reveal results
   */
  private async finishRace(simulationId: string, raceIndex: number): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return;
    
    const race = simulation.races[raceIndex];
    if (!race) return;
    
    console.log('[Simulation] Finishing race:', race.track, 'R' + race.raceNumber);
    
    race.status = 'finished';
    race.actualEnd = new Date();
    
    // Fetch actual results from MongoDB with payoffs
    console.log('[Simulation] Fetching results from MongoDB for race', race.track, 'R' + race.raceNumber);
    
    let results: RaceResult[] = [];
    
    try {
      // Get the contest date to build race name
      const simulation = this.simulations.get(simulationId);
      if (!simulation) return;
      
      // Find contest to get date
      const { data: contest } = await supabase
        .from('contests')
        .select('date')
        .eq('id', simulation.contestId)
        .single();
      
      if (!contest) {
        console.warn('[Simulation] Contest not found, falling back to mock results');
      } else {
        // Build race name: TRACK-DATE-RACE (e.g., "AQU-2025-11-02-1")
        const dateStr = contest.date; // Format: YYYY-MM-DD
        const raceNameForDB = `${race.track}-${dateStr}-${race.raceNumber}`;
        
        console.log('[Simulation] Looking for race results:', raceNameForDB);
        
        try {
          const resultsCollection = await getEquibaseResults();
          
          // Debug: Check if MongoDB is accessible and see what race names exist
          const sampleResults = await resultsCollection.find({}).limit(5).toArray();
          console.log('[Simulation] MongoDB connection works. Sample race names:', sampleResults.map(r => r.raceNameForDB));
          
          let resultDoc = await resultsCollection.findOne({ raceNameForDB });
          
          if (!resultDoc) {
            console.warn('[Simulation] No results found for', raceNameForDB, 'in MongoDB');
            // Try variations of the race name format based on sample data
            const variations = [
              `${race.track}-${dateStr}-${race.raceNumber}`, // Original: GP-2025-11-16-6
              `${race.track}-${dateStr}-USA-D-${race.raceNumber}`, // Sample format: AQU-2024-02-24-USA-D-1
              `${race.track}-${dateStr.replace(/-/g, '')}-${race.raceNumber}`, // No dashes: GP20251116-6
              `${race.track}_${dateStr}_${race.raceNumber}`, // Underscores
              `${race.track}${dateStr}${race.raceNumber}`, // No separators
            ];
            
            for (const variation of variations) {
              resultDoc = await resultsCollection.findOne({ raceNameForDB: variation });
              if (resultDoc) {
                console.log('[Simulation] Found results with alternative format:', variation);
                break;
              }
            }
          }
          
          if (resultDoc && resultDoc.starters) {
            console.log('[Simulation] Found results in MongoDB for', resultDoc.raceNameForDB || raceNameForDB);
            
            // Map MongoDB results to RaceResult format
            const FINISH_BONUS: Record<number, number> = {
              1: 25,
              2: 15,
              3: 5,
            };
            
            results = resultDoc.starters.map((starter: any) => {
              const horseRef = starter.starter?.horse?.referenceNumber;
              const position = starter.mutuelFinish || 0;
              const win = starter.winPayoff || 0;
              const place = starter.placePayoff || 0;
              const show = starter.showPayoff || 0;
              
              // Calculate points using exact Python formula: tot = (win + plc + sho) / 100, then add bonus
              const tot = (win + place + show) / 100.0;
              const bonus = FINISH_BONUS[position] || 0;
              const points = tot + bonus;
              
              // Find the horse name from race.horses
              const horseData = race.horses.find((h: any) => {
                const hRef = h.referenceNumber || h.horse_reference_number;
                return hRef === horseRef;
              });
              const horseName = horseData?.horse || starter.starter?.horse?.name || 'Unknown';
              
              return {
                track: race.track,
                race: race.raceNumber,
                horseName,
                position,
                points: Math.round(points * 100) / 100,
                win,
                place,
                show,
                jockey: horseData?.jockey,
                trainer: horseData?.trainer,
                sire1: horseData?.sire1,
                sire2: horseData?.sire2,
              };
            }).filter((r: RaceResult) => r.position >= 1 && r.position <= 3); // Only top 3 get points
            
            console.log(`[Simulation] Loaded ${results.length} results from MongoDB for ${resultDoc.raceNameForDB}`);
          } else {
            console.warn('[Simulation] No results found in MongoDB for', raceNameForDB, '- falling back to mock results');
          }
        } catch (mongoError) {
          console.error('[Simulation] MongoDB connection error:', mongoError);
          console.warn('[Simulation] Falling back to mock results');
        }
      }
    } catch (error) {
      console.error('[Simulation] Error fetching results from MongoDB:', error);
      console.warn('[Simulation] Falling back to mock results');
    }
    
    // If no MongoDB results found, skip this race (no mock fallback in production)
    if (results.length === 0) {
      console.warn('[Simulation] No results found for race', race.track, 'R' + race.raceNumber, '- skipping race (no mock fallback)');
      race.status = 'finished';
      race.actualEnd = new Date();
      race.results = [];
      return; // Skip this race entirely
    }
    
    // Store results in race object
    race.results = results;
    
    // Update round progress for all rounds
    await this.updateRoundProgress(simulationId, race, results);
    
    // Emit race finished event
    this.emitEvent(simulationId, {
      type: 'race_finished',
      simulationId,
      timestamp: new Date(),
      data: {
        raceIndex,
        track: race.track,
        raceNumber: race.raceNumber,
        results,
      },
    });
    
    // Check if simulation is complete
    if (raceIndex === simulation.races.length - 1) {
      await this.finishSimulation(simulationId);
    }
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Update round progress after a race finishes
   */
  private async updateRoundProgress(
    simulationId: string, 
    race: SimulatedRace, 
    results: RaceResult[]
  ): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return;
    
    console.log('[Simulation] Updating round progress for race:', race.track, 'R' + race.raceNumber);
    
    // Fetch matchups for this contest to get connection details
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .eq('contest_id', simulation.contestId);
    
    if (matchupsError || !matchupsData) {
      console.error('[Simulation] Error fetching matchups:', matchupsError);
      return;
    }
    
    // Build a map of all matchups by ID
    const allMatchups = new Map<string, any>();
    for (const row of matchupsData) {
      const matchupData = row.matchup_data;
      if (matchupData && matchupData.matchups) {
        for (const matchup of matchupData.matchups) {
          if (matchup.id) {
            allMatchups.set(matchup.id, matchup);
          }
        }
      }
    }
    
    // For each round, update matchup progress
    for (const round of simulation.rounds) {
      // If round has pre-calculated outcome, use it for instant results
      if (round.precalculatedOutcome) {
        // Use pre-calculated data to update starter points
        const precalc = round.precalculatedOutcome;
        
        for (let i = 0; i < round.matchups.length; i++) {
          const matchupProgress = round.matchups[i];
          const precalcMatchup = precalc.matchups[i];
          
          if (!precalcMatchup) continue;
          
          // Update starters with pre-calculated points for this race
          for (const conn of matchupProgress.setA.connections) {
            for (const starter of conn.starters || []) {
              if (starter.track === race.track && starter.race === race.raceNumber) {
                // Find this starter in pre-calculated data
                const precalcStarter = precalcMatchup.setA.starters.find((s: any) => 
                  s.track === starter.track && s.race === starter.race && s.horseName === starter.horseName
                );
                if (precalcStarter) {
                  starter.points = precalcStarter.points;
                  starter.position = precalcStarter.position;
                  starter.finished = true;
                  matchupProgress.setA.currentPoints += precalcStarter.points || 0;
                  matchupProgress.setA.finishedRaces++;
                }
              }
            }
          }
          
          for (const conn of matchupProgress.setB.connections) {
            for (const starter of conn.starters || []) {
              if (starter.track === race.track && starter.race === race.raceNumber) {
                const precalcStarter = precalcMatchup.setB.starters.find((s: any) => 
                  s.track === starter.track && s.race === starter.race && s.horseName === starter.horseName
                );
                if (precalcStarter) {
                  starter.points = precalcStarter.points;
                  starter.position = precalcStarter.position;
                  starter.finished = true;
                  matchupProgress.setB.currentPoints += precalcStarter.points || 0;
                  matchupProgress.setB.finishedRaces++;
                }
              }
            }
          }
          
          // Update matchup status if both sets finished
          const setARacesComplete = matchupProgress.setA.finishedRaces === matchupProgress.setA.totalRaces;
          const setBRacesComplete = matchupProgress.setB.finishedRaces === matchupProgress.setB.totalRaces;
          
          if (setARacesComplete && setBRacesComplete) {
            matchupProgress.status = precalcMatchup.winner === 'A' ? 'setA_won' : 
                                     precalcMatchup.winner === 'B' ? 'setB_won' : 'tied';
            matchupProgress.winner = precalcMatchup.winner;
          } else {
            matchupProgress.status = 'in_progress';
          }
        }
        
        // Update round status based on pre-calculated outcome
        const completedMatchups = round.matchups.filter(m => 
          m.status === 'setA_won' || m.status === 'setB_won' || m.status === 'tied'
        ).length;
        
        if (completedMatchups === round.matchups.length) {
          // All matchups complete - use pre-calculated outcome
          round.status = precalc.outcome;
          round.wonMatchups = precalc.correctPicks;
          round.lostMatchups = precalc.totalPicks - precalc.correctPicks;
          round.potentialWinnings = precalc.finalWinnings;
        } else if (completedMatchups > 0) {
          round.status = 'in_progress';
        }
        
        continue; // Skip to next round (already processed with pre-calc)
      }
      
      // No pre-calculated data - calculate on the fly (fallback)
      if (!round.matchups || round.matchups.length === 0) {
        // Initialize matchup progress for this round
        round.matchups = round.picks.map(pick => {
          const matchup = allMatchups.get(pick.matchupId);
          if (!matchup) {
            console.warn('[Simulation] Matchup not found:', pick.matchupId);
            return null;
          }
          
          const chosenSet = pick.chosen === 'A' ? matchup.setA : matchup.setB;
          const opponentSet = pick.chosen === 'A' ? matchup.setB : matchup.setA;
          
          return {
            matchupId: pick.matchupId,
            chosenSide: pick.chosen,
            setA: {
              connections: matchup.setA.connections,
              currentPoints: 0,
              totalRaces: this.countTotalRaces(matchup.setA.connections, simulation.races),
              finishedRaces: 0,
            },
            setB: {
              connections: matchup.setB.connections,
              currentPoints: 0,
              totalRaces: this.countTotalRaces(matchup.setB.connections, simulation.races),
              finishedRaces: 0,
            },
            status: 'pending',
            winner: null,
          };
        }).filter(Boolean) as MatchupProgress[];
      }
      
      // Update points for connections that ran in this race
      for (const matchupProgress of round.matchups) {
        let updated = false;
        
        // Check Set A connections
        for (const conn of matchupProgress.setA.connections) {
          const pointsData = this.getConnectionPointsForRace(conn, race, results);
          if (pointsData !== null) {
            matchupProgress.setA.currentPoints += pointsData.points;
            matchupProgress.setA.finishedRaces++;
            
            // Update the starter with points
            if (conn.starters) {
              for (const starter of conn.starters) {
                if (starter.track === race.track && starter.race === race.raceNumber) {
                  starter.points = pointsData.points;
                  starter.finished = true;
                  console.log('[Simulation] Updated starter points:', starter.horseName, '=', pointsData.points, 'pts');
                }
              }
            }
            
            updated = true;
          }
        }
        
        // Check Set B connections
        for (const conn of matchupProgress.setB.connections) {
          const pointsData = this.getConnectionPointsForRace(conn, race, results);
          if (pointsData !== null) {
            matchupProgress.setB.currentPoints += pointsData.points;
            matchupProgress.setB.finishedRaces++;
            
            // Update the starter with points
            if (conn.starters) {
              for (const starter of conn.starters) {
                if (starter.track === race.track && starter.race === race.raceNumber) {
                  starter.points = pointsData.points;
                  starter.finished = true;
                  console.log('[Simulation] Updated starter points:', starter.horseName, '=', pointsData.points, 'pts');
                }
              }
            }
            
            updated = true;
          }
        }
        
        if (updated) {
          // Update matchup status
          // Check if the last race for each set has finished (not all races on the track)
          const setALastRace = this.getLastRaceForSet(matchupProgress.setA.connections);
          const setBLastRace = this.getLastRaceForSet(matchupProgress.setB.connections);
          
          let setALastRaceFinished = false;
          let setBLastRaceFinished = false;
          
          // Find the simulation to check race status
          const simulation = this.simulations.get(simulationId);
          
          if (setALastRace && simulation) {
            const lastRace = simulation.races.find(r => 
              r.track === setALastRace.track && r.raceNumber === setALastRace.raceNumber
            );
            setALastRaceFinished = lastRace?.status === 'finished';
          }
          
          if (setBLastRace && simulation) {
            const lastRace = simulation.races.find(r => 
              r.track === setBLastRace.track && r.raceNumber === setBLastRace.raceNumber
            );
            setBLastRaceFinished = lastRace?.status === 'finished';
          }
          
          // Matchup is finished when both sets' last races have finished
          if (setALastRaceFinished && setBLastRaceFinished) {
            // Both sets' last races finished, determine winner
            if (matchupProgress.setA.currentPoints > matchupProgress.setB.currentPoints) {
              matchupProgress.status = 'setA_won';
              matchupProgress.winner = 'A';
            } else if (matchupProgress.setB.currentPoints > matchupProgress.setA.currentPoints) {
              matchupProgress.status = 'setB_won';
              matchupProgress.winner = 'B';
            } else {
              matchupProgress.status = 'tied';
              matchupProgress.winner = null;
            }
            console.log(`[Simulation] Matchup ${matchupProgress.matchupId} finished: ${matchupProgress.status}, Set A: ${matchupProgress.setA.currentPoints} pts, Set B: ${matchupProgress.setB.currentPoints} pts`);
          } else {
            matchupProgress.status = 'in_progress';
          }
          
          // Emit matchup update
          this.emitEvent(simulationId, {
            type: 'matchup_updated',
            simulationId,
            timestamp: new Date(),
            data: {
              roundId: round.roundId,
              matchupId: matchupProgress.matchupId,
              matchupProgress,
            },
          });
        }
      }
      
      // Update round totals
      round.wonMatchups = round.matchups.filter(m => 
        (m.chosenSide === 'A' && m.status === 'setA_won') ||
        (m.chosenSide === 'B' && m.status === 'setB_won')
      ).length;
      
      round.lostMatchups = round.matchups.filter(m => 
        (m.chosenSide === 'A' && m.status === 'setB_won') ||
        (m.chosenSide === 'B' && m.status === 'setA_won')
      ).length;
      
      round.totalPoints = round.matchups.reduce((sum, m) => {
        const chosenSet = m.chosenSide === 'A' ? m.setA : m.setB;
        return sum + chosenSet.currentPoints;
      }, 0);
      
      // Update round status
      if (round.status === 'pending' && round.matchups.some(m => m.status === 'in_progress')) {
        round.status = 'in_progress';
      }
      
      // Check if all races relevant to this round have finished
      // This handles both single-track and cross-track rounds
      const relevantRaces = new Set<string>(); // Track-race pairs like "LRL-1", "GP-2", etc.
      round.matchups.forEach(m => {
        [...m.setA.connections, ...m.setB.connections].forEach(conn => {
          // Check trackSet for cross-track matchups
          if (conn.trackSet && Array.isArray(conn.trackSet)) {
            conn.trackSet.forEach(track => {
              // For cross-track connections, we need to find all races they participate in
              if (conn.starters) {
                conn.starters.forEach(starter => {
                  if (starter.track === track && starter.race) {
                    relevantRaces.add(`${starter.track}-${starter.race}`);
                  }
                });
              }
            });
          }
          
          // Also check starters directly (for single-track connections)
          if (conn.starters) {
            conn.starters.forEach(starter => {
              if (starter.track && starter.race) {
                relevantRaces.add(`${starter.track}-${starter.race}`);
              }
            });
          }
        });
      });
      
      const allRelevantRacesFinished = Array.from(relevantRaces).every(raceKey => {
        const [track, raceNum] = raceKey.split('-');
        const race = simulation.races.find(r => 
          r.track === track && r.raceNumber === parseInt(raceNum) && r.status === 'finished'
        );
        return race !== undefined;
      });
      
      // Log for debugging cross-track rounds
      if (relevantRaces.size > 1 && Array.from(relevantRaces).some(r => {
        const track = r.split('-')[0];
        return Array.from(relevantRaces).some(r2 => r2.split('-')[0] !== track);
      })) {
        console.log(`[Simulation] Cross-track round ${round.roundId}: ${relevantRaces.size} races across multiple tracks, ${allRelevantRacesFinished ? 'all finished' : 'waiting for races'}`);
      }
      
      // Check if round is finished (all matchups decided AND all relevant races finished)
      const allMatchupsDecided = round.matchups.every(m => 
        m.status === 'setA_won' || m.status === 'setB_won' || m.status === 'tied'
      );
      
      // Only mark round as won/lost if:
      // 1. All matchups are decided, AND
      // 2. All races relevant to this round have finished
      // This prevents marking rounds as "lost" before all their races finish
      if (allMatchupsDecided && allRelevantRacesFinished) {
        // Determine if round won or lost
        const requiredWins = round.isFlex ? round.picks.length - 1 : round.picks.length;
        round.status = round.wonMatchups >= requiredWins ? 'won' : 'lost';
        
        if (round.status === 'won') {
          // Calculate actual multiplier based on correct picks and flex option
          let actualMultiplier = round.multiplier || 1; // Default to 1 if not set
          
          if (round.multiplierSchedule && round.pickCount) {
            const schedule = round.multiplierSchedule as Record<number, { 
              standard: number; 
              flexAllWin: number; 
              flexOneMiss: number;
            }>;
            const scheduled = schedule[round.pickCount];
            
            if (scheduled) {
              if (round.isFlex) {
                // Flex mode: use flexAllWin if all correct, flexOneMiss if missed one
                if (round.wonMatchups === round.picks.length) {
                  // All picks correct
                  actualMultiplier = scheduled.flexAllWin;
                } else if (round.wonMatchups === round.picks.length - 1) {
                  // Missed one pick (flex allows this)
                  actualMultiplier = scheduled.flexOneMiss;
                } else {
                  // More than one miss - shouldn't happen if status is 'won', but handle it
                  actualMultiplier = 0;
                }
              } else {
                // Standard mode: must get all correct to win
                actualMultiplier = scheduled.standard;
              }
            } else {
              // Schedule exists but no entry for this pickCount - use default multiplier
              console.warn(`[Simulation] No multiplier schedule found for pickCount ${round.pickCount}, using default multiplier ${actualMultiplier}`);
            }
          } else {
            // No multiplierSchedule - use the round's multiplier or default to 1
            console.log(`[Simulation] No multiplierSchedule for round ${round.roundId}, using multiplier ${actualMultiplier}`);
          }
          
          // Ensure entryAmount is valid
          const entryAmount = round.entryAmount || 0;
          round.potentialWinnings = entryAmount * actualMultiplier;
          round.multiplier = actualMultiplier; // Update to actual calculated multiplier
          
          console.log(`[Simulation] Calculated winnings for round ${round.roundId}: entryAmount=${entryAmount}, multiplier=${actualMultiplier}, winnings=${round.potentialWinnings}`);
        } else {
          // Round lost - set winnings to 0
          round.potentialWinnings = 0;
        }
        
        // Persist round result to database
        console.log(`[Simulation] Settling round ${round.roundId}: ${round.status}, winnings: ${round.potentialWinnings}, wonMatchups: ${round.wonMatchups}, lostMatchups: ${round.lostMatchups}`);
        
        const { error: updateError } = await supabase
          .from('entries')
          .update({
            status: round.status,
            settled_at: new Date().toISOString()
          })
          .eq('id', round.roundId);
        
        if (updateError) {
          console.error(`[Simulation] Error updating round ${round.roundId} in database:`, updateError);
        } else {
          console.log(`[Simulation] Round ${round.roundId} settled in database: ${round.status}`);
        }
      } else if (allMatchupsDecided && !allRelevantRacesFinished) {
        // All matchups decided but races not finished - keep as "in_progress"
        // This can happen if a matchup is decided early (e.g., one side has no horses in remaining races)
        // But we should wait for all races to finish before finalizing the round
        if (round.status === 'pending') {
          round.status = 'in_progress';
        }
        // Don't mark as won/lost yet - wait for all races to finish
        console.log(`[Simulation] Round ${round.roundId} matchups decided but waiting for races to finish. Status: ${round.status}`);
      } else if (!allMatchupsDecided) {
        // Some matchups not yet decided - ensure status is at least "in_progress" if any races have finished
        const hasAnyFinishedRaces = allRelevantRacesFinished || simulation.races.some(r => {
          const raceKey = `${r.track}-${r.raceNumber}`;
          return relevantRaces.has(raceKey) && r.status === 'finished';
        });
        
        if (hasAnyFinishedRaces && round.status === 'pending') {
          round.status = 'in_progress';
        }
      }
      
      // Emit round update
      this.emitEvent(simulationId, {
        type: 'round_updated',
        simulationId,
        timestamp: new Date(),
        data: {
          roundId: round.roundId,
          userId: round.userId,
          status: round.status,
          wonMatchups: round.wonMatchups,
          lostMatchups: round.lostMatchups,
          totalPoints: round.totalPoints,
          matchups: round.matchups,
        },
      });
    }
  }
  
  /**
   * Count total races for a set of connections
   */
  private countTotalRaces(connections: any[], allRaces: SimulatedRace[]): number {
    // Count unique races (track-raceNumber combinations) for this set
    const uniqueRaces = new Set<string>();
    for (const conn of connections) {
      for (const starter of conn.starters || []) {
        const raceKey = `${starter.track}-${starter.race || starter.raceNumber}`;
        const raceExists = allRaces.some(r => 
          r.track === starter.track && r.raceNumber === (starter.race || starter.raceNumber)
        );
        if (raceExists) {
          uniqueRaces.add(raceKey);
        }
      }
    }
    return uniqueRaces.size;
  }
  
  /**
   * Get the last race number for a set of connections
   */
  private getLastRaceForSet(connections: any[]): { track: string; raceNumber: number } | null {
    let lastRace: { track: string; raceNumber: number } | null = null;
    for (const conn of connections) {
      for (const starter of conn.starters || []) {
        const raceNum = starter.race || starter.raceNumber;
        if (raceNum) {
          if (!lastRace || raceNum > lastRace.raceNumber) {
            lastRace = { track: starter.track, raceNumber: raceNum };
          }
        }
      }
    }
    return lastRace;
  }
  
  /**
   * Get points for a connection in a specific race
   */
  private getConnectionPointsForRace(
    connection: any, 
    race: SimulatedRace, 
    results: RaceResult[]
  ): { points: number; horseName: string } | null {
    // Check if this connection has a horse in this race
    for (const starter of connection.starters || []) {
      if (starter.track === race.track && starter.race === race.raceNumber) {
        // Find result for this horse
        const result = results.find(r => 
          r.horseName === starter.horseName && 
          r.track === race.track && 
          r.race === race.raceNumber
        );
        
        if (result) {
          // Only count points if horse finished in top 3 (position 1, 2, or 3)
          // This matches the contest_result.py logic where points are only recorded for top 3 finishes
          if (result.position >= 1 && result.position <= 3) {
            console.log('[Simulation] Connection', connection.name, 'scored', result.points, 'points on', starter.horseName, '(position', result.position, ')');
          return { points: result.points, horseName: starter.horseName };
          } else {
            // Horse finished but not in top 3 - no points
            console.log('[Simulation] Connection', connection.name, 'horse', starter.horseName, 'finished position', result.position, '- no points');
            return { points: 0, horseName: starter.horseName };
          }
        }
        
        // Horse ran but no result yet (shouldn't happen in simulation)
        return { points: 0, horseName: starter.horseName };
      }
    }
    
    // Connection didn't run in this race
    return null;
  }
  
  /**
   * Finish simulation
   */
  private async finishSimulation(simulationId: string): Promise<void> {
    const simulation = this.simulations.get(simulationId);
    if (!simulation) return;
    
    console.log('[Simulation] Finishing simulation:', simulationId);
    
    // Final check: Ensure all rounds are properly finalized
    // Since all races are now finished, finalize any rounds that are still "in_progress"
    for (const round of simulation.rounds) {
      if (round.status === 'in_progress' || round.status === 'pending') {
        // All races are finished, so we can now determine final status
        const allMatchupsDecided = round.matchups.every(m => 
          m.status === 'setA_won' || m.status === 'setB_won' || m.status === 'tied'
        );
        
        if (allMatchupsDecided) {
          // Determine if round won or lost
          const requiredWins = round.isFlex ? round.picks.length - 1 : round.picks.length;
          round.status = round.wonMatchups >= requiredWins ? 'won' : 'lost';
          
          if (round.status === 'won') {
            // Calculate actual multiplier based on correct picks and flex option
            let actualMultiplier = round.multiplier || 1; // Default to 1 if not set
            
            if (round.multiplierSchedule && round.pickCount) {
              const schedule = round.multiplierSchedule as Record<number, { 
                standard: number; 
                flexAllWin: number; 
                flexOneMiss: number;
              }>;
              const scheduled = schedule[round.pickCount];
              
              if (scheduled) {
                if (round.isFlex) {
                  if (round.wonMatchups === round.picks.length) {
                    actualMultiplier = scheduled.flexAllWin;
                  } else if (round.wonMatchups === round.picks.length - 1) {
                    actualMultiplier = scheduled.flexOneMiss;
                  } else {
                    actualMultiplier = 0;
                  }
                } else {
                  actualMultiplier = scheduled.standard;
                }
              } else {
                console.warn(`[Simulation] No multiplier schedule found for pickCount ${round.pickCount}, using default multiplier ${actualMultiplier}`);
              }
            } else {
              console.log(`[Simulation] No multiplierSchedule for round ${round.roundId}, using multiplier ${actualMultiplier}`);
            }
            
            // Ensure entryAmount is valid
            const entryAmount = round.entryAmount || 0;
            round.potentialWinnings = entryAmount * actualMultiplier;
            round.multiplier = actualMultiplier;
            
            console.log(`[Simulation] Finalized winnings for round ${round.roundId}: entryAmount=${entryAmount}, multiplier=${actualMultiplier}, winnings=${round.potentialWinnings}`);
          } else {
            // Round lost - set winnings to 0
            round.potentialWinnings = 0;
          }
          
          // Persist round result to database
          console.log(`[Simulation] Finalizing round ${round.roundId}: ${round.status}, winnings: ${round.potentialWinnings}`);
          
            const { error: updateError } = await supabase
              .from('entries')
              .update({
                status: round.status,
                settled_at: new Date().toISOString()
              })
            .eq('id', round.roundId);
          
          if (updateError) {
            console.error(`[Simulation] Error finalizing round ${round.roundId}:`, updateError);
          } else {
            console.log(`[Simulation] Round ${round.roundId} finalized: ${round.status}`);
          }
        }
      }
    }
    
    simulation.status = 'finished';
    simulation.finishedAt = new Date();
    
    // Clear timers
    const timers = this.timers.get(simulationId) || [];
    timers.forEach(timer => clearTimeout(timer));
    this.timers.delete(simulationId);
    
    // Emit finished event
    this.emitEvent(simulationId, {
      type: 'simulation_finished',
      simulationId,
      timestamp: new Date(),
      data: {
        rounds: simulation.rounds.map(r => ({
          roundId: r.roundId,
          status: r.status,
          totalPoints: r.totalPoints,
          wonMatchups: r.wonMatchups,
          lostMatchups: r.lostMatchups,
        })),
      },
    });
    
    // Update database
    await supabase
      .from('simulations')
      .update({
        status: 'finished',
        finished_at: simulation.finishedAt,
        simulation_data: simulation,
      })
      .eq('id', simulationId);
  }
  
  /**
   * Emit event to subscribers
   */
  private emitEvent(simulationId: string, event: SimulationEvent): void {
    this.emit('simulation_event', event);
    
    // Also store in database for replay
    supabase.from('simulation_events').insert({
      simulation_id: simulationId,
      event_type: event.type,
      event_data: event.data,
      simulated_time: event.timestamp,
    }).then(({ error }) => {
      if (error) {
        console.error('[Simulation] Error storing event:', error);
      }
    });
  }
}

// Singleton instance
export const simulationController = new SimulationController();

