# Database Schema Documentation

**Last Updated**: 2025-11-18  
**Database**: Supabase (PostgreSQL)

---

## Current Tables

### 1. `contests`
**Purpose**: Store contest metadata

```sql
CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track VARCHAR(10) NOT NULL,
  track_name VARCHAR(255),
  date DATE NOT NULL,
  contest_type VARCHAR(50),
  entry_fee DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  track_data_id UUID REFERENCES track_data(id),
  matchups_calculated_at TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contests_track_date ON contests(track, date);
CREATE INDEX idx_contests_status ON contests(status);
```

**Key Fields**:
- `id`: UUID - Unique contest identifier
- `track_data_id`: Links to track_data table
- `matchups_calculated_at`: When matchups were last generated

---

### 2. `track_data`
**Purpose**: Store race entries and results from MongoDB

```sql
CREATE TABLE track_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_code VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL, -- { entries: [...], results: [...] }
  metadata JSONB, -- { races_count, horses_count, etc. }
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_track_data_track_date ON track_data(track_code, date);
CREATE INDEX idx_track_data_date ON track_data(date);
```

**Key Fields**:
- `data.entries`: Array of race entries (horses, jockeys, trainers, odds, salaries)
- `data.results`: Array of race results (positions, points, payoffs)

---

### 3. `matchups`
**Purpose**: Store generated matchups for contests

```sql
CREATE TABLE matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  matchup_type VARCHAR(50) NOT NULL, -- 'jockey_vs_jockey', 'trainer_vs_trainer', etc.
  matchup_data JSONB NOT NULL, -- { matchups: [...], settings: {...}, stats: {...} }
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matchups_contest ON matchups(contest_id);
CREATE INDEX idx_matchups_contest_type ON matchups(contest_id, matchup_type);
```

**Key Fields**:
- `matchup_data.matchups`: Array of matchup objects
  - Each matchup has:
    - `id`: **UUID** (globally unique, permanent)
    - `setA`: { connections: [...], totalSalary, totalPoints }
    - `setB`: { connections: [...], totalSalary, totalPoints }
    - `matchupType`: Type classification
- `matchup_data.settings`: Generation settings used
- `matchup_data.stats`: Quality metrics

**⚠️ IMPORTANT**: After UUID implementation, all matchups will have UUIDs like:
- `550e8400-e29b-41d4-a716-446655440000`
- NOT short IDs like `matchup-1`

---

### 4. `entries`
**Purpose**: Store user-submitted rounds (picks)

```sql
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contest_id UUID NOT NULL REFERENCES contests(id),
  picks JSONB NOT NULL, -- [{ matchupId: UUID, chosen: 'A'|'B' }]
  entry_amount DECIMAL(10,2) NOT NULL,
  multiplier INTEGER NOT NULL CHECK (multiplier >= 1),
  is_flex BOOLEAN NOT NULL DEFAULT FALSE,
  pick_count INTEGER,
  multiplier_schedule JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'won', 'lost'
  winnings DECIMAL(10,2),
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entries_user ON entries(user_id);
CREATE INDEX idx_entries_contest ON entries(contest_id);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_entries_user_status ON entries(user_id, status);
```

**Key Fields**:
- `picks`: Array of pick objects with **UUID matchup IDs**
- `is_flex`: Whether flex play is enabled
- `multiplier_schedule`: Full schedule for settlement
- `status`: Current status (pending → won/lost after settlement)

---

### 5. `simulations`
**Purpose**: Store simulation state for live contests

```sql
CREATE TABLE simulations (
  id VARCHAR(255) PRIMARY KEY, -- 'sim-{contestId}-{timestamp}'
  contest_id UUID NOT NULL REFERENCES contests(id),
  status VARCHAR(50) NOT NULL, -- 'ready', 'running', 'paused', 'finished'
  speed_multiplier INTEGER DEFAULT 1,
  current_race_index INTEGER DEFAULT 0,
  simulation_data JSONB NOT NULL, -- Full simulation state
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_simulations_contest ON simulations(contest_id);
CREATE INDEX idx_simulations_status ON simulations(status);
```

**Key Fields**:
- `simulation_data`: Contains races, rounds, progress
  - `rounds`: Array of round progress with **UUID matchup IDs**

---

### 6. `profiles`
**Purpose**: Store user profiles and bankroll

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255),
  username VARCHAR(255),
  bankroll DECIMAL(10,2) DEFAULT 1000000.00,
  total_winnings DECIMAL(10,2) DEFAULT 0,
  total_losses DECIMAL(10,2) DEFAULT 0,
  rounds_played INTEGER DEFAULT 0,
  rounds_won INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 Pre-Calculation System (RECOMMENDED)

### Problem:
Currently, round outcomes are calculated during simulation. This means:
- Slow simulation startup
- Can't replay simulations
- Results depend on simulation running

### Solution: Pre-Calculate on Submission

Add new column to `entries` table:

```sql
ALTER TABLE entries 
ADD COLUMN precalculated_outcome JSONB;

COMMENT ON COLUMN entries.precalculated_outcome IS 
'Pre-calculated round outcome including matchup results, points, and final winnings. Allows instant results and repeatable simulations.';
```

**Structure of `precalculated_outcome`**:
```json
{
  "matchups": [
    {
      "matchupId": "uuid-here",
      "chosenSide": "A",
      "setA": {
        "totalPoints": 45,
        "starters": [
          {
            "horseName": "Solo Gano",
            "track": "DMR",
            "race": 1,
            "position": 2,
            "points": 15,
            "mlOdds": "5/1"
          }
        ]
      },
      "setB": {
        "totalPoints": 30,
        "starters": [...]
      },
      "winner": "A",
      "isCorrect": true
    }
  ],
  "correctPicks": 5,
  "totalPicks": 6,
  "actualMultiplier": 9.0,
  "finalWinnings": 900.00,
  "outcome": "won",
  "calculatedAt": "2025-11-18T..."
}
```

**Benefits**:
- ⚡ **Instant results** - No waiting for simulation
- 🎬 **Smooth UX** - Simulation just reveals pre-calculated data
- 🔄 **Repeatable** - Can replay simulations perfectly
- 📊 **Accurate** - Uses real results data
- 🚀 **Scalable** - Simulations are just UI animations

---

## 🔑 UUID Implementation

### Why UUIDs?

**Industry Standard**:
- DraftKings: Uses UUIDs for all entities
- FanDuel: Uses UUIDs for contests, lineups
- Underdog: Uses UUIDs for picks, contests

**Benefits**:
1. **Globally Unique** - Never collide, even across databases
2. **Permanent** - ID never changes
3. **Distributed** - Can generate in frontend or backend
4. **Debuggable** - Easy to trace in logs
5. **Database-friendly** - Excellent for primary keys

### Implementation:

**Backend** (`unifiedMatchupGenerator.ts`, `matchupCalculation.ts`):
```typescript
const matchup = {
  id: crypto.randomUUID(), // e.g., "550e8400-e29b-41d4-a716-446655440000"
  setA: {...},
  setB: {...}
};
```

**Frontend** (`AppContext.tsx`):
```typescript
// No fallback IDs - require proper UUIDs from backend
id: raw?.id || `error-no-id-${type}-${index}`
```

### Migration Steps:

1. ✅ **Code Updated** - UUID generation in place
2. ⏳ **Regenerate Matchups** - Admin panel → Calculate Matchups
3. ⏳ **Clear Old Entries** - Delete entries with old IDs
4. ⏳ **Test Flow** - Submit → Live → Simulate → Results

---

## 📊 Data Flow

### Contest Creation → Results

```
1. ADMIN: Create Contest
   ↓
   contests table (UUID id)
   
2. ADMIN: Fetch Track Data
   ↓
   track_data table (entries + results)
   ↓
   contests.track_data_id updated
   
3. ADMIN: Calculate Matchups
   ↓
   Generate matchups with UUID ids
   ↓
   matchups table (contest_id, matchup_data with UUIDs)
   
4. USER: Select Matchups
   ↓
   Frontend stores picks with UUID matchup IDs
   ↓
   Session storage: { matchupId: UUID, chosen: 'A'|'B' }
   
5. USER: Submit Round
   ↓
   POST /api/entries/:contestId
   ↓
   entries table (picks with UUID matchup IDs)
   ↓
   [FUTURE] Calculate outcome → precalculated_outcome
   ↓
   Bankroll updated
   
6. USER: Start Simulation
   ↓
   POST /api/simulation/create
   ↓
   Fetch entries (with UUID matchup IDs)
   ↓
   Fetch matchups (with UUID ids)
   ↓
   Match picks to matchups by UUID
   ↓
   simulations table (simulation_data with populated matchups)
   
7. SIMULATION: Run Races
   ↓
   [CURRENT] Calculate results from track_data
   ↓
   [FUTURE] Use precalculated_outcome
   ↓
   Update round status (won/lost)
   ↓
   WebSocket → Frontend updates
   
8. SIMULATION: Complete
   ↓
   Update entries.status → 'won' or 'lost'
   ↓
   Update entries.winnings
   ↓
   Update profiles.bankroll
   ↓
   entries.settled_at timestamp
   
9. USER: View Results
   ↓
   GET /api/entries?userId=X&status=settled
   ↓
   Display on Results page
```

---

## 🔧 Required Database Changes

### Immediate (For UUID Support):
**None required!** - Current schema already supports UUIDs in JSONB fields.

### Recommended (For Pre-Calculation):

```sql
-- Add pre-calculated outcome column
ALTER TABLE entries 
ADD COLUMN precalculated_outcome JSONB;

-- Add index for faster queries
CREATE INDEX idx_entries_precalculated 
ON entries(contest_id, status) 
WHERE precalculated_outcome IS NOT NULL;

-- Add comment
COMMENT ON COLUMN entries.precalculated_outcome IS 
'Pre-calculated round outcome with matchup results, points, and winnings. Calculated on submission using real results data.';
```

### Optional (For Better Performance):

```sql
-- Composite index for user's pending entries
CREATE INDEX idx_entries_user_pending 
ON entries(user_id, contest_id) 
WHERE status = 'pending';

-- Index for simulation queries
CREATE INDEX idx_simulations_contest_status 
ON simulations(contest_id, status);

-- Partial index for active simulations
CREATE INDEX idx_simulations_active 
ON simulations(contest_id) 
WHERE status IN ('ready', 'running', 'paused');
```

---

## 🎯 Current Schema Status

### ✅ Ready for UUID System:
- All tables support UUID storage in JSONB
- No schema changes needed for UUID migration
- Just need to regenerate matchups

### 🔮 Ready for Pre-Calculation:
- Need to add `precalculated_outcome` column
- Need to create outcome calculator service
- Will dramatically improve UX

### 📈 Performance:
- Current indexes are adequate
- Recommended indexes will improve query speed
- Can add after launch if needed

---

## 🚨 Action Items

### IMMEDIATE:
1. **Regenerate matchups** in Admin panel (LRL and DMR contests)
2. **Delete old entries** in Supabase (they have old IDs)
3. **Test new flow** with UUID matchup IDs

### SHORT-TERM:
1. **Add `precalculated_outcome` column** to entries table
2. **Create outcome calculator** service
3. **Modify entry submission** to pre-calculate
4. **Update simulation** to use pre-calculated data

### LONG-TERM:
1. Add recommended performance indexes
2. Implement caching strategy
3. Add monitoring and analytics

