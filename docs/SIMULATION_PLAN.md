# Live Race Simulation System

**Purpose:** Build and test live features using past race data  
**Date:** 2025-11-12  
**Simulation Date:** 2025-11-09 (LRL, GP, DMR, CD, AQU)

---

## Overview

We'll create a simulation system that:
- Uses real race data from 11/09/2025
- Simulates races running at 1-minute intervals
- Updates matchup progress in real-time
- Allows testing of all live features before going live with actual races

---

## Simulation Architecture

### 1. Data Layer
```
Source: MongoDB + Supabase (past race data from 11/09/2025)
Tracks: LRL, GP, DMR, CD, AQU
Status: Use actual entries + results from that date
```

### 2. Time Simulation
```
Real Time → Simulated Time
- Race 1 starts at T+0 (now)
- Race 1 ends at T+1min
- Race 2 starts at T+2min
- Race 2 ends at T+3min
- etc.

Post times are recalculated relative to "now"
Results are revealed at simulated post time + 1 minute
```

### 3. Simulation Controller
```
Location: /backend/src/services/simulationController.ts

Features:
- Start simulation for a contest
- Pause/Resume simulation
- Speed control (1x, 2x, 5x, 10x)
- Skip to specific race
- Reset simulation
```

### 4. WebSocket Integration
```
Events emitted:
- simulation_started
- race_started (raceNumber, postTime, horses)
- race_finished (raceNumber, results, points)
- matchup_updated (matchupId, setA_points, setB_points, status)
- round_updated (roundId, totalPoints, status)
```

---

## Implementation Plan

### Phase 1: Backend Simulation Service

#### Step 1: Create Simulation Data Structure
```typescript
interface SimulationConfig {
  contestId: string;
  tracks: string[]; // ['LRL', 'GP', 'DMR', 'CD', 'AQU']
  date: string; // '2025-11-09'
  speedMultiplier: number; // 1x = 1 min per race
  autoStart: boolean;
}

interface SimulatedRace {
  track: string;
  raceNumber: number;
  scheduledStart: Date; // Simulated time
  actualStart: Date | null; // When simulation started this race
  scheduledEnd: Date; // Simulated time
  actualEnd: Date | null; // When simulation finished this race
  status: 'pending' | 'running' | 'finished';
  horses: Starter[];
  results: RaceResult[];
}

interface SimulationState {
  id: string;
  contestId: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  currentRace: number;
  races: SimulatedRace[];
  startedAt: Date | null;
  pausedAt: Date | null;
  finishedAt: Date | null;
}
```

#### Step 2: Build Simulation Controller
```typescript
// backend/src/services/simulationController.ts

class SimulationController {
  private simulations: Map<string, SimulationState> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  async createSimulation(config: SimulationConfig): Promise<SimulationState>
  async startSimulation(simulationId: string): Promise<void>
  async pauseSimulation(simulationId: string): Promise<void>
  async resumeSimulation(simulationId: string): Promise<void>
  async skipToRace(simulationId: string, raceNumber: number): Promise<void>
  async setSpeed(simulationId: string, speedMultiplier: number): Promise<void>
  async resetSimulation(simulationId: string): Promise<void>
  
  private scheduleRaces(simulation: SimulationState): void
  private startRace(simulationId: string, raceIndex: number): void
  private finishRace(simulationId: string, raceIndex: number): void
  private emitUpdate(simulationId: string, event: string, data: any): void
}
```

#### Step 3: Create API Endpoints
```
POST   /api/simulation/create
POST   /api/simulation/:id/start
POST   /api/simulation/:id/pause
POST   /api/simulation/:id/resume
POST   /api/simulation/:id/skip/:raceNumber
PUT    /api/simulation/:id/speed
DELETE /api/simulation/:id/reset
GET    /api/simulation/:id/status
```

#### Step 4: Set Up WebSocket Server
```typescript
// backend/src/services/websocket.ts

- Socket.io or native WebSocket
- Rooms per simulation ID
- Emit race updates in real-time
- Handle client subscriptions
```

---

### Phase 2: Frontend Live Page

#### Step 1: Live Page Structure
```tsx
// app/live/page.tsx

Components:
- SimulationControls (play/pause/speed/reset)
- RoundsList (user's active rounds)
- RoundDetails (expanded view)
- MatchupProgress (progress line with nodes)
- RaceNode (individual race in progress)
- PointsTracker (running total)
- RaceSummary (modal with race details)
```

#### Step 2: WebSocket Client
```tsx
// hooks/useSimulation.ts

- Connect to WebSocket
- Subscribe to simulation updates
- Handle race_started, race_finished events
- Update local state
- Emit user actions (pause, speed change)
```

#### Step 3: Progress Visualization
```
Layout:
┌─────────────────────────────────────────────┐
│ Round 1: 4 Matchups                  ✓ 3/4 │
├─────────────────────────────────────────────┤
│ Matchup 1: Jose Lezcano vs Marcos Meneses  │
│ ●─────●─────●─────●                  🟢 +12│
│ R1    R3    R5    R9                        │
│                                             │
│ Matchup 2: Hard Spun vs William Mott       │
│ ●═════●═════●                        🟡 +3 │
│ R2    R4    R7     (R7 in progress...)     │
└─────────────────────────────────────────────┘

Legend:
● = Race node (hover for details)
─ = Not started (grey)
═ = Finished (blue if won, red if lost)
🟢 = Winning
🟡 = In progress / tied
🔴 = Losing / Lost
```

#### Step 4: Race Node Component
```tsx
interface RaceNodeProps {
  race: SimulatedRace;
  connection: Connection;
  starter: Starter;
  isFinished: boolean;
  points: number;
  onClick: () => void;
}

Features:
- Shows race number
- Green if won, red if lost, yellow if in progress
- Hover tooltip: horse name, post time, odds, position
- Click to open race detail modal
```

---

### Phase 3: Simulation Testing Workflow

#### Workflow
```
1. Admin creates contest for 11/09/2025 with multiple tracks
2. Admin generates matchups (use real past data)
3. User (tester) selects matchups and submits round
4. Admin/Tester starts simulation
5. Simulation runs:
   - T+0: First race starts
   - T+1min: First race finishes, results revealed
   - T+2min: Second race starts
   - T+3min: Second race finishes
   - ... continues for all races
6. Live page updates in real-time:
   - Race nodes change color
   - Points update
   - Matchup status updates (winning/losing)
   - Round status updates (won/lost/in-progress)
7. When all races finish, round auto-transitions to results
```

#### Test Scenarios
```
Scenario 1: All matchups win
- Select 4 matchups
- All chosen sets outperform opponents
- Result: Round wins, see green progress

Scenario 2: One matchup loses (no flex)
- Select 4 matchups
- One chosen set loses
- Result: Round ends immediately (red), goes to results

Scenario 3: One matchup loses (with flex)
- Select 4 matchups with flex
- One chosen set loses
- Result: Round continues (yellow), needs 3/4 to win

Scenario 4: Races in different time slots
- Connection in Race 1 vs Connection in Race 9
- Early race finishes first
- See partial progress while waiting for late races
```

---

## Database Schema

### simulations Table
```sql
CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID REFERENCES contests(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready', -- ready, running, paused, finished
  speed_multiplier INTEGER NOT NULL DEFAULT 1,
  current_race_index INTEGER DEFAULT 0,
  simulation_data JSONB NOT NULL, -- SimulationState
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX idx_simulations_contest ON simulations(contest_id);
CREATE INDEX idx_simulations_status ON simulations(status);
```

### simulation_events Table (for replay)
```sql
CREATE TABLE simulation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_id UUID REFERENCES simulations(id) NOT NULL,
  event_type TEXT NOT NULL, -- race_started, race_finished, etc.
  event_data JSONB NOT NULL,
  simulated_time TIMESTAMP NOT NULL,
  actual_time TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulation_events_sim ON simulation_events(simulation_id);
CREATE INDEX idx_simulation_events_time ON simulation_events(simulated_time);
```

---

## API Endpoints

### Create Simulation
```
POST /api/simulation/create
Body: {
  contestId: string;
  speedMultiplier: number; // 1, 2, 5, 10
}
Response: {
  simulationId: string;
  state: SimulationState;
}
```

### Control Simulation
```
POST /api/simulation/:id/start
POST /api/simulation/:id/pause
POST /api/simulation/:id/resume
PUT  /api/simulation/:id/speed { speedMultiplier: number }
POST /api/simulation/:id/skip/:raceNumber
POST /api/simulation/:id/reset
```

### Get Simulation State
```
GET /api/simulation/:id
Response: SimulationState
```

### WebSocket Events
```
Client → Server:
- subscribe_to_simulation { simulationId }
- unsubscribe_from_simulation { simulationId }

Server → Client:
- simulation_started { simulationId, state }
- race_started { raceNumber, track, horses, postTime }
- race_progress { raceNumber, elapsed, total }
- race_finished { raceNumber, results, points }
- matchup_updated { matchupId, setA, setB, status }
- round_updated { roundId, matchups, totalPoints, status }
- simulation_finished { finalResults }
```

---

## Implementation Steps

### Step 1: Backend (Week 1)
1. Create `simulationController.ts`
2. Create simulation API routes
3. Set up WebSocket server
4. Test with Postman/curl

### Step 2: Frontend Hooks (Week 1)
1. Create `useSimulation.ts` hook
2. Create `useWebSocket.ts` hook
3. Test connection and events

### Step 3: Live Page UI (Week 2)
1. Build layout and components
2. Connect to WebSocket
3. Render progress visualization
4. Add simulation controls

### Step 4: Testing & Polish (Week 2)
1. Run full simulations
2. Test all scenarios
3. Fix bugs
4. Polish UI/UX

---

## Success Criteria

✅ Simulation runs smoothly with 1-minute race intervals  
✅ Live page updates in real-time as races finish  
✅ Progress visualization is clear and informative  
✅ All race results match actual historical data  
✅ Round status updates correctly (won/lost/in-progress)  
✅ Can pause/resume/reset simulation  
✅ Can speed up simulation (2x, 5x, 10x)  
✅ Multiple users can watch same simulation  

---

## Next Actions

1. Create backend simulation controller
2. Set up WebSocket server
3. Build frontend WebSocket client
4. Create live page structure
5. Implement progress visualization
6. Add simulation controls
7. Test end-to-end

Ready to start building? Let's begin with the backend simulation controller!

