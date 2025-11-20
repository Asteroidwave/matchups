/**
 * useSimulation Hook
 * Connect to simulation WebSocket and manage simulation state
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SimulatedRace {
  track: string;
  raceNumber: number;
  scheduledStart: Date;
  actualStart: Date | null;
  scheduledEnd: Date;
  actualEnd: Date | null;
  status: 'pending' | 'running' | 'finished';
  horses: any[];
  results: any[];
  postTime: string;
}

interface RoundProgress {
  roundId: string;
  userId: string;
  entryAmount: number;
  multiplier: number;
  isFlex: boolean;
  picks: Array<{ matchupId: string; chosen: 'A' | 'B' }>;
  matchups: any[];
  status: 'pending' | 'in_progress' | 'won' | 'lost';
  wonMatchups: number;
  lostMatchups: number;
  totalPoints: number;
  potentialWinnings: number;
}

interface SimulationState {
  id: string;
  contestId: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  speedMultiplier: number;
  currentRaceIndex: number;
  races: SimulatedRace[];
  rounds: RoundProgress[];
  startedAt: Date | null;
  pausedAt: Date | null;
  pausedDuration: number;
  finishedAt: Date | null;
  createdAt: Date;
}

interface UseSimulationResult {
  simulation: SimulationState | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createSimulation: (contestId: string, speedMultiplier?: number, date?: string) => Promise<void>;
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  setSpeed: (speedMultiplier: number) => Promise<void>;
  skipToRace: (raceIndex: number) => Promise<void>;
  resetSimulation: () => Promise<void>;
}

export function useSimulation(simulationId?: string): UseSimulationResult {
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const currentSimulationIdRef = useRef<string | null>(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });
    
    socket.on('connect', () => {
      console.log('[useSimulation] Connected to WebSocket');
      setIsConnected(true);
      setError(null);
    });
    
    socket.on('disconnect', () => {
      console.log('[useSimulation] Disconnected from WebSocket');
      setIsConnected(false);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[useSimulation] Connection error:', err);
      setError('Failed to connect to simulation server');
      setIsConnected(false);
    });
    
    // Listen for simulation events
    socket.on('simulation_state', (state: SimulationState) => {
      const sampleRound = state.rounds?.[0];
      console.log('[useSimulation] Received simulation state:', {
        id: state.id,
        status: state.status,
        roundsCount: state.rounds?.length || 0,
        racesCount: state.races?.length || 0,
        sampleRound: sampleRound ? {
          roundId: sampleRound.roundId,
          matchupsCount: sampleRound.matchups?.length || 0,
          picksCount: sampleRound.picks?.length || 0,
          hasMatchupData: sampleRound.matchups?.[0] ? 'yes' : 'no',
          firstMatchup: sampleRound.matchups?.[0] ? {
            matchupId: sampleRound.matchups[0].matchupId,
            setAConnectionsCount: sampleRound.matchups[0].setA?.connections?.length || 0,
            setBConnectionsCount: sampleRound.matchups[0].setB?.connections?.length || 0
          } : null
        } : null
      });
      setSimulation(state);
    });
    
    socket.on('simulation_started', (data: any) => {
      console.log('[useSimulation] Simulation started');
      setSimulation(prev => prev ? { ...prev, ...data.simulation } : data.simulation);
    });
    
    socket.on('race_started', (data: any) => {
      console.log('[useSimulation] Race started:', data.track, 'R' + data.raceNumber);
      setSimulation(prev => {
        if (!prev) return null;
        const races = [...prev.races];
        const race = races.find(r => r.track === data.track && r.raceNumber === data.raceNumber);
        if (race) {
          race.status = 'running';
          race.actualStart = new Date();
        }
        return { ...prev, races };
      });
    });
    
    socket.on('race_finished', (data: any) => {
      console.log('[useSimulation] Race finished:', data.track, 'R' + data.raceNumber);
      setSimulation(prev => {
        if (!prev) return null;
        const races = [...prev.races];
        const race = races.find(r => r.track === data.track && r.raceNumber === data.raceNumber);
        if (race) {
          race.status = 'finished';
          race.actualEnd = new Date();
          race.results = data.results;
        }
        return { ...prev, races };
      });
    });
    
    socket.on('round_updated', (data: any) => {
      console.log('[useSimulation] Round updated:', data.roundId);
      setSimulation(prev => {
        if (!prev) return null;
        const rounds = prev.rounds.map(r => 
          r.roundId === data.roundId ? { ...r, ...data } : r
        );
        return { ...prev, rounds };
      });
    });
    
    socket.on('simulation_finished', (data: any) => {
      console.log('[useSimulation] Simulation finished');
      setSimulation(prev => prev ? { ...prev, status: 'finished', finishedAt: new Date() } : null);
    });
    
    socketRef.current = socket;
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  // Subscribe to simulation updates
  useEffect(() => {
    if (!simulationId || !socketRef.current || !isConnected) return;
    
    // Unsubscribe from previous simulation
    if (currentSimulationIdRef.current && currentSimulationIdRef.current !== simulationId) {
      socketRef.current.emit('unsubscribe_from_simulation', {
        simulationId: currentSimulationIdRef.current,
      });
    }
    
    // Subscribe to new simulation
    console.log('[useSimulation] Subscribing to simulation:', simulationId);
    socketRef.current.emit('subscribe_to_simulation', { simulationId });
    currentSimulationIdRef.current = simulationId;
    
    // Fetch initial state
    fetchSimulation(simulationId);
    
    return () => {
      if (socketRef.current && currentSimulationIdRef.current) {
        socketRef.current.emit('unsubscribe_from_simulation', {
          simulationId: currentSimulationIdRef.current,
        });
      }
    };
  }, [simulationId, isConnected]);
  
  // Fetch simulation state from API
  const fetchSimulation = async (simId: string) => {
    try {
      setIsLoading(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Simulation doesn't exist - clear stored ID and reset state
          console.log('[useSimulation] Simulation not found (404), clearing stored ID');
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('currentSimulationId');
            // Clear the simulation ID from URL if present
            const url = new URL(window.location.href);
            if (url.searchParams.get('sim') === simId) {
              url.searchParams.delete('sim');
              window.history.replaceState({}, '', url.toString());
            }
          }
          setSimulation(null);
          setError(null);
          // Clear the simulation ID reference
          if (currentSimulationIdRef.current === simId) {
            currentSimulationIdRef.current = null;
          }
          return;
        }
        throw new Error('Failed to fetch simulation');
      }
      
      const data = await response.json();
      const sim = data.simulation;
      
      // If simulation has 0 rounds, clear it (stale data)
      if (sim && (!sim.rounds || sim.rounds.length === 0)) {
        console.log('[useSimulation] Simulation has 0 rounds, clearing stale simulation');
        setSimulation(null);
        setError(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('currentSimulationId');
          const url = new URL(window.location.href);
          if (url.searchParams.get('sim') === simId) {
            url.searchParams.delete('sim');
            window.history.replaceState({}, '', url.toString());
          }
        }
        if (currentSimulationIdRef.current === simId) {
          currentSimulationIdRef.current = null;
        }
        return;
      }
      
      setSimulation(sim);
      setError(null);
    } catch (err: any) {
      console.error('[useSimulation] Error fetching simulation:', err);
      setError(err.message);
      // If it's a 404 or network error, clear the simulation state
      if (err.message.includes('404') || err.message.includes('Failed to fetch')) {
        setSimulation(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('currentSimulationId');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create simulation
  const createSimulation = useCallback(async (contestId: string, speedMultiplier: number = 1, date?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!contestId || !date) {
        throw new Error('Missing required fields: contestId and date are required');
      }
      
      console.log('[useSimulation] Creating simulation:', { contestId, date, speedMultiplier });
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contestId,
          date,
          speedMultiplier,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[useSimulation] Backend error:', errorData);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      const sampleRound = data.simulation.rounds?.[0];
      console.log('[useSimulation] Simulation created:', {
        id: data.simulation.id,
        roundsCount: data.simulation.rounds?.length || 0,
        racesCount: data.simulation.races?.length || 0,
        sampleRound: sampleRound ? {
          roundId: sampleRound.roundId,
          matchupsCount: sampleRound.matchups?.length || 0,
          picksCount: sampleRound.picks?.length || 0,
          status: sampleRound.status,
          hasMatchups: !!sampleRound.matchups,
          firstMatchup: sampleRound.matchups?.[0] ? {
            matchupId: sampleRound.matchups[0].matchupId,
            hasSetA: !!sampleRound.matchups[0].setA,
            hasSetB: !!sampleRound.matchups[0].setB,
            setAConnectionsCount: sampleRound.matchups[0].setA?.connections?.length || 0,
            setBConnectionsCount: sampleRound.matchups[0].setB?.connections?.length || 0
          } : null
        } : null
      });
      
      setSimulation(data.simulation);
      
      // Subscribe to the new simulation
      if (socketRef.current) {
        socketRef.current.emit('subscribe_to_simulation', {
          simulationId: data.simulation.id,
        });
        currentSimulationIdRef.current = data.simulation.id;
      }
    } catch (err: any) {
      console.error('[useSimulation] Error creating simulation:', err);
      setError(err.message || 'Failed to create simulation');
      throw err; // Re-throw so the caller can handle it
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Start simulation
  const startSimulation = useCallback(async () => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/start`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start simulation');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error starting simulation:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  // Pause simulation
  const pauseSimulation = useCallback(async () => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/pause`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to pause simulation');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error pausing simulation:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  // Resume simulation
  const resumeSimulation = useCallback(async () => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/resume`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to resume simulation');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error resuming simulation:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  // Set speed
  const setSpeed = useCallback(async (speedMultiplier: number) => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/speed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedMultiplier }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to set speed');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error setting speed:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  // Skip to race
  const skipToRace = useCallback(async (raceIndex: number) => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/skip/${raceIndex}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to skip to race');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error skipping to race:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  // Reset simulation
  const resetSimulation = useCallback(async () => {
    if (!simulation) return;
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/simulation/${simulation.id}/reset`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset simulation');
      }
      
      const data = await response.json();
      setSimulation(data.simulation);
    } catch (err: any) {
      console.error('[useSimulation] Error resetting simulation:', err);
      setError(err.message);
    }
  }, [simulation]);
  
  return {
    simulation,
    isConnected,
    isLoading,
    error,
    createSimulation,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    setSpeed,
    skipToRace,
    resetSimulation,
  };
}

