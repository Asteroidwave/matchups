"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, FastForward, Trash2, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Contest {
  id: string;
  track: string;
  date: string;
  status: string;
  is_active: boolean;
}

interface Simulation {
  id: string;
  contestId: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  speedMultiplier: number;
  currentRaceIndex: number;
  races: any[];
  rounds: any[];
  startedAt: Date | null;
  finishedAt: Date | null;
}

export function SimulationPanel() {
  const router = useRouter();
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(10);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Load contests
  useEffect(() => {
    loadContests();
  }, []);

  const loadContests = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/contests`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error('Failed to fetch contests:', response.status, response.statusText);
        throw new Error('Failed to fetch contests');
      }
      
      const data = await response.json();
      console.log('[SimulationPanel] Loaded contests:', data);
      // API returns array directly, not wrapped in object
      const contestsArray = Array.isArray(data) ? data : (data.contests || []);
      setContests(contestsArray);
    } catch (error) {
      console.error('Error loading contests:', error);
      alert('Failed to load contests. Check console for details.');
    }
  };

  // Create simulation
  const handleCreateSimulation = async () => {
    if (!selectedContestId) {
      alert('Please select a contest');
      return;
    }

    try {
      setIsLoading(true);
      
      const contest = contests.find(c => c.id === selectedContestId);
      if (!contest) throw new Error('Contest not found');

      const response = await fetch(`${BACKEND_URL}/api/simulation/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contestId: selectedContestId,
          tracks: [contest.track],
          date: contest.date,
          speedMultiplier,
          autoStart: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create simulation');
      }

      const data = await response.json();
      setSimulations(prev => [data.simulation, ...prev]);
      alert(`Simulation created: ${data.simulation.id}`);
    } catch (error: any) {
      console.error('Error creating simulation:', error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Control actions
  const handleStart = async (simId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/${simId}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to start simulation');
      
      const data = await response.json();
      updateSimulation(data.simulation);
    } catch (error: any) {
      console.error('Error starting simulation:', error);
      alert(error.message);
    }
  };

  const handlePause = async (simId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/${simId}/pause`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to pause simulation');
      
      const data = await response.json();
      updateSimulation(data.simulation);
    } catch (error: any) {
      console.error('Error pausing simulation:', error);
      alert(error.message);
    }
  };

  const handleResume = async (simId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/${simId}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to resume simulation');
      
      const data = await response.json();
      updateSimulation(data.simulation);
    } catch (error: any) {
      console.error('Error resuming simulation:', error);
      alert(error.message);
    }
  };

  const handleReset = async (simId: string) => {
    if (!confirm('Reset this simulation? All progress will be lost.')) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/${simId}/reset`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to reset simulation');
      
      const data = await response.json();
      updateSimulation(data.simulation);
    } catch (error: any) {
      console.error('Error resetting simulation:', error);
      alert(error.message);
    }
  };

  const handleChangeSpeed = async (simId: string, speed: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulation/${simId}/speed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ speedMultiplier: speed }),
      });
      
      if (!response.ok) throw new Error('Failed to change speed');
      
      const data = await response.json();
      updateSimulation(data.simulation);
    } catch (error: any) {
      console.error('Error changing speed:', error);
      alert(error.message);
    }
  };

  const updateSimulation = (updated: Simulation) => {
    setSimulations(prev => 
      prev.map(sim => sim.id === updated.id ? updated : sim)
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case 'finished':
        return <Badge className="bg-gray-500">Finished</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Contest</label>
            <Select value={selectedContestId} onValueChange={setSelectedContestId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a contest" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(contests) && contests.map(contest => (
                  <SelectItem key={contest.id} value={contest.id}>
                    {contest.track} - {contest.date} ({contest.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Speed Multiplier</label>
            <Select value={speedMultiplier.toString()} onValueChange={(v) => setSpeedMultiplier(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x (Real-time: 1 min/race)</SelectItem>
                <SelectItem value="2">2x (30 sec/race)</SelectItem>
                <SelectItem value="5">5x (12 sec/race)</SelectItem>
                <SelectItem value="10">10x (6 sec/race)</SelectItem>
                <SelectItem value="20">20x (3 sec/race)</SelectItem>
                <SelectItem value="60">60x (1 sec/race)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreateSimulation}
            disabled={!selectedContestId || isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating...' : 'Create Simulation'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Simulations */}
      <Card>
        <CardHeader>
          <CardTitle>Active Simulations</CardTitle>
        </CardHeader>
        <CardContent>
          {simulations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No simulations created yet
            </div>
          ) : (
            <div className="space-y-4">
              {simulations.map(sim => {
                const contest = contests.find(c => c.id === sim.contestId);
                const progress = sim.races.filter(r => r.status === 'finished').length;
                const total = sim.races.length;

                return (
                  <div
                    key={sim.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          {contest?.track || 'Unknown'} - {contest?.date || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-600">
                          ID: {sim.id.slice(0, 16)}...
                        </div>
                      </div>
                      {getStatusBadge(sim.status)}
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{progress} / {total} races</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${(progress / total) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {sim.status === 'running' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePause(sim.id)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      ) : sim.status === 'ready' || sim.status === 'paused' ? (
                        <Button
                          size="sm"
                          onClick={() => sim.status === 'ready' ? handleStart(sim.id) : handleResume(sim.id)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {sim.status === 'ready' ? 'Start' : 'Resume'}
                        </Button>
                      ) : null}

                      <Select
                        value={sim.speedMultiplier.toString()}
                        onValueChange={(v) => handleChangeSpeed(sim.id, parseInt(v))}
                        disabled={sim.status === 'finished'}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1x</SelectItem>
                          <SelectItem value="2">2x</SelectItem>
                          <SelectItem value="5">5x</SelectItem>
                          <SelectItem value="10">10x</SelectItem>
                          <SelectItem value="20">20x</SelectItem>
                          <SelectItem value="60">60x</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReset(sim.id)}
                        disabled={sim.status === 'running'}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/live?sim=${sim.id}`)}
                      >
                        <Radio className="w-4 h-4 mr-1" />
                        View Live
                      </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t text-sm">
                      <div>
                        <div className="text-gray-600">Rounds</div>
                        <div className="font-semibold">{sim.rounds.length}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Current Race</div>
                        <div className="font-semibold">{sim.currentRaceIndex + 1} / {total}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Speed</div>
                        <div className="font-semibold">{sim.speedMultiplier}x</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

