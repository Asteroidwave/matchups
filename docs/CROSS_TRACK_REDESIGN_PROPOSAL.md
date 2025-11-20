# Cross-Track System Redesign Proposal

## Problems to Solve

### 1. Multiple Refreshes After Matchup Calculation ❌
**Current Issue:** Page refreshes 5+ times after configuring matchups

**Root Cause:**
```typescript
// In ContestManagement.tsx
const handleMatchupTypesSuccess = async () => {
  await loadContestStatuses([selectedContest.id]); // Call 1
  await loadContests(); // Call 2, which triggers loadContestStatuses again (Call 3)
  // Plus polling in MatchupTypesDialog causes more calls
};
```

**Fix:** Remove duplicate calls, use single refresh

### 2. Cross-Track Should Be Multi-Contest Feature ❌
**Current Issue:** Cross-track is per-contest, but needs data from multiple contests

**Proposed Solution:** Make cross-track a separate "Multi-Contest Matchup" feature

### 3. Dynamic Track Filtering ❌
**Current Issue:** If user hides a track, matchups should reorganize

**Challenge:** Would require pre-generating all combinations (2^n scenarios)

**Proposed Solution:** Client-side filtering with smart caching

---

## Solution 1: Fix Multiple Refreshes ✅

### Quick Fix (Immediate)

**File:** `components/admin/ContestManagement.tsx`

```typescript
// BEFORE (causes 5+ refreshes):
const handleMatchupTypesSuccess = async () => {
  if (selectedContest) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await loadContestStatuses([selectedContest.id]); // ❌ Duplicate
    await loadContests(); // ❌ Calls loadContestStatuses again
  }
};

// AFTER (single refresh):
const handleMatchupTypesSuccess = async () => {
  if (selectedContest) {
    // Wait for backend to finish
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Single call - loadContests will handle status loading
    await loadContests();
  }
};
```

### Better Fix (Recommended)

Add debouncing to prevent multiple rapid calls:

```typescript
const loadContestsDebounced = useCallback(
  debounce(async () => {
    await loadContests();
  }, 500), // Wait 500ms after last call
  [loadContests]
);

const handleMatchupTypesSuccess = async () => {
  if (selectedContest) {
    loadContestsDebounced();
  }
};
```

---

## Solution 2: Redesign Cross-Track as Multi-Contest Feature ✅

### Current Architecture (Single Contest)
```
Contest (DEL, 2025-11-15)
  ├─ Jockey vs Jockey
  ├─ Trainer vs Trainer
  ├─ Sire vs Sire
  ├─ Mixed
  └─ Cross-Track ❌ (Limited to one contest's data)
```

### Proposed Architecture (Multi-Contest)
```
Individual Contests:
  Contest 1 (DEL, 2025-11-15)
    ├─ Jockey vs Jockey
    ├─ Trainer vs Trainer
    ├─ Sire vs Sire
    └─ Mixed

  Contest 2 (SA, 2025-11-15)
    ├─ Jockey vs Jockey
    ├─ Trainer vs Trainer
    ├─ Sire vs Sire
    └─ Mixed

  Contest 3 (GP, 2025-11-15)
    ├─ Jockey vs Jockey
    ├─ Trainer vs Trainer
    ├─ Sire vs Sire
    └─ Mixed

Multi-Contest Matchups (NEW):
  Cross-Track Bundle (DEL + SA + GP, 2025-11-15)
    ├─ Cross-Track Jockeys
    ├─ Cross-Track Trainers
    ├─ Cross-Track Sires
    └─ Cross-Track Mixed
```

### Database Schema Changes

#### New Table: `multi_contest_bundles`
```sql
CREATE TABLE multi_contest_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  contest_ids UUID[] NOT NULL, -- Array of contest IDs
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_multi_contest_bundles_date ON multi_contest_bundles(date);
CREATE INDEX idx_multi_contest_bundles_active ON multi_contest_bundles(is_active);
```

#### Update `matchups` Table
```sql
ALTER TABLE matchups ADD COLUMN bundle_id UUID REFERENCES multi_contest_bundles(id);
ALTER TABLE matchups ADD COLUMN included_tracks TEXT[]; -- Tracks used in this matchup

CREATE INDEX idx_matchups_bundle ON matchups(bundle_id);
```

### Admin UI Flow

#### Step 1: Create Multi-Contest Bundle
```
┌─────────────────────────────────────────┐
│ Create Cross-Track Bundle               │
├─────────────────────────────────────────┤
│ Name: [Weekend Warriors              ] │
│ Date: [Nov 15, 2025                  ] │
│                                         │
│ Select Contests:                        │
│ ☑ DEL - Delaware Park                  │
│ ☑ SA - Santa Anita                     │
│ ☑ GP - Gulfstream Park                 │
│ ☐ KEE - Keeneland                      │
│ ☐ CD - Churchill Downs                 │
│                                         │
│ [Cancel] [Create Bundle]                │
└─────────────────────────────────────────┘
```

#### Step 2: Configure Matchup Types
```
┌─────────────────────────────────────────┐
│ Configure: Weekend Warriors             │
│ Tracks: DEL, SA, GP                     │
├─────────────────────────────────────────┤
│ Matchup Types:                          │
│ ☑ Cross-Track Jockeys                  │
│ ☑ Cross-Track Trainers                 │
│ ☑ Cross-Track Sires                    │
│ ☑ Cross-Track Mixed                    │
│                                         │
│ Settings:                               │
│ Min Appearances: [2]                    │
│ Salary Tolerance: [1000]                │
│ Number of Matchups: [40]                │
│                                         │
│ [Cancel] [Calculate Matchups]           │
└─────────────────────────────────────────┘
```

#### Step 3: View in Matchups Page
```
┌─────────────────────────────────────────┐
│ Select Contest:                         │
│ ○ DEL - Delaware Park                  │
│ ○ SA - Santa Anita                     │
│ ○ GP - Gulfstream Park                 │
│ ● Weekend Warriors (Cross-Track) ← NEW │
└─────────────────────────────────────────┘
```

---

## Solution 3: Dynamic Track Filtering with Smart Caching ✅

### The Challenge

**Scenario:** User has 3 tracks (KEE, AQU, BAQ) in a cross-track bundle

**Problem:** If user hides BAQ, should we:
1. Pre-generate all combinations? (2^3 = 8 scenarios)
2. Filter client-side? (Fast but may break matchups)
3. Regenerate on-demand? (Slow)

### Recommended Approach: Hybrid System

#### Backend: Pre-Generate Primary Scenarios

Generate matchups for common scenarios only:

```typescript
interface BundleMatchupScenarios {
  all_tracks: Matchup[];           // All 3 tracks
  two_track_combinations: {
    'KEE_AQU': Matchup[];          // KEE + AQU only
    'KEE_BAQ': Matchup[];          // KEE + BAQ only
    'AQU_BAQ': Matchup[];          // AQU + BAQ only
  };
  single_track: {
    'KEE': Matchup[];              // KEE only (fallback)
    'AQU': Matchup[];              // AQU only (fallback)
    'BAQ': Matchup[];              // BAQ only (fallback)
  };
}
```

**Storage Strategy:**
```sql
-- Store all scenarios in matchups table
INSERT INTO matchups (
  bundle_id,
  matchup_type,
  included_tracks,  -- ['KEE', 'AQU'] or ['KEE', 'AQU', 'BAQ']
  matchup_data,
  scenario_key      -- 'all' or 'KEE_AQU' or 'KEE' etc.
) VALUES (...);
```

**Benefits:**
- ✅ Fast switching (pre-generated)
- ✅ Works on reload (persisted)
- ✅ Reasonable storage (not exponential)

**Limitations:**
- Only supports common scenarios
- 3 tracks = 7 scenarios (manageable)
- 5 tracks = 31 scenarios (still ok)
- 10 tracks = 1023 scenarios (too many)

#### Frontend: Client-Side Filtering with Validation

```typescript
function filterMatchupsByVisibleTracks(
  matchups: Matchup[],
  visibleTracks: string[]
): Matchup[] {
  return matchups.filter(matchup => {
    // Get all tracks in this matchup
    const matchupTracks = new Set<string>();
    
    matchup.setA.connections.forEach(c => {
      c.trackSet.forEach(t => matchupTracks.add(t));
    });
    matchup.setB.connections.forEach(c => {
      c.trackSet.forEach(t => matchupTracks.add(t));
    });
    
    // Only show if ALL matchup tracks are visible
    return Array.from(matchupTracks).every(t => visibleTracks.includes(t));
  });
}
```

**Benefits:**
- ✅ Instant filtering
- ✅ No backend calls
- ✅ Works for any combination

**Limitations:**
- May reduce available matchups significantly
- Doesn't generate new matchups

### Hybrid Implementation

```typescript
async function getMatchupsForTracks(
  bundleId: string,
  visibleTracks: string[]
): Promise<Matchup[]> {
  // 1. Try to get pre-generated scenario
  const scenarioKey = generateScenarioKey(visibleTracks);
  
  const { data: preGenerated } = await supabase
    .from('matchups')
    .select('*')
    .eq('bundle_id', bundleId)
    .eq('scenario_key', scenarioKey);
  
  if (preGenerated && preGenerated.length > 0) {
    console.log('Using pre-generated scenario:', scenarioKey);
    return preGenerated;
  }
  
  // 2. Fallback: Get 'all' scenario and filter client-side
  const { data: allMatchups } = await supabase
    .from('matchups')
    .select('*')
    .eq('bundle_id', bundleId)
    .eq('scenario_key', 'all');
  
  if (allMatchups) {
    console.log('Filtering all matchups client-side');
    return filterMatchupsByVisibleTracks(allMatchups, visibleTracks);
  }
  
  // 3. Last resort: Generate on-demand (async)
  console.log('Generating new scenario on-demand');
  await generateMatchupsForScenario(bundleId, visibleTracks);
  // Return empty for now, will be available after generation
  return [];
}

function generateScenarioKey(tracks: string[]): string {
  return tracks.sort().join('_'); // e.g., 'AQU_KEE' or 'all'
}
```

---

## Solution 4: Results Integration ✅

### Current State
- Using old/past data for entries
- Need to pull results for results page

### Implementation

#### Backend: Auto-Fetch Results

```typescript
// backend/src/services/matchupCalculation.ts

async function calculateContestMatchups(
  contestId: string,
  matchupTypes: string[]
) {
  // ... existing code ...
  
  // After generating matchups, fetch results if available
  const contestDate = new Date(contestData.date);
  const today = new Date();
  
  if (contestDate < today) {
    // Past contest - fetch results
    console.log(`[${opId}] Past contest detected, fetching results...`);
    await fetchAndMergeResults(contestData.track, contestData.date);
  }
}

async function fetchAndMergeResults(
  track: string,
  date: string
): Promise<void> {
  try {
    // Fetch results from API
    const results = await getTrackResults(track, date);
    
    if (results.length === 0) {
      console.warn(`No results found for ${track} on ${date}`);
      return;
    }
    
    // Merge with existing track_data
    const { data: trackData } = await supabase
      .from('track_data')
      .select('*')
      .eq('track_code', track)
      .eq('date', date)
      .single();
    
    if (trackData) {
      // Merge results into entries
      const mergedData = mergeEntriesWithResults(
        trackData.data.entries,
        results
      );
      
      // Update track_data
      await supabase
        .from('track_data')
        .update({
          data: { entries: mergedData, results },
          updated_at: new Date().toISOString()
        })
        .eq('id', trackData.id);
      
      console.log(`✅ Results merged for ${track} on ${date}`);
    }
  } catch (error) {
    console.error(`Error fetching results:`, error);
    // Don't throw - matchups can still work without results
  }
}
```

#### Frontend: Display Results

```typescript
// In matchups page or results page
function ConnectionCard({ connection }: { connection: Connection }) {
  const hasResults = connection.starters.some(s => s.points > 0);
  
  return (
    <div>
      <div>{connection.name}</div>
      <div>Salary: ${connection.salarySum}</div>
      {hasResults ? (
        <div className="text-green-600">
          Points: {connection.pointsSum}
        </div>
      ) : (
        <div className="text-gray-400">
          Expected: {connection.expectedPoints || 'TBD'}
        </div>
      )}
    </div>
  );
}
```

---

## Solution 5: Future Races Support ✅

### Requirements
- Support contests with future dates
- Show expected points (no results yet)
- Auto-update when results become available

### Implementation

#### Contest Lifecycle States

```typescript
type ContestLifecycleStatus = 
  | 'scheduled'   // Future date, no results
  | 'locked'      // Contest locked, racing in progress
  | 'live'        // Races running
  | 'settling'    // Races complete, calculating results
  | 'settled';    // Results final

interface Contest {
  // ... existing fields
  lifecycle_status: ContestLifecycleStatus;
  first_post_time: string | null;
  last_post_time: string | null;
  lock_time: string | null;
}
```

#### Auto-Update Service

```typescript
// backend/src/services/contestLifecycle.ts

export async function updateContestLifecycle() {
  const now = new Date();
  
  // Find contests that need status updates
  const { data: contests } = await supabase
    .from('contests')
    .select('*')
    .in('lifecycle_status', ['scheduled', 'locked', 'live']);
  
  for (const contest of contests || []) {
    const lockTime = new Date(contest.lock_time);
    const lastPostTime = new Date(contest.last_post_time);
    
    if (now >= lastPostTime) {
      // Races should be complete - fetch results
      await fetchAndMergeResults(contest.track, contest.date);
      
      await supabase
        .from('contests')
        .update({ lifecycle_status: 'settled' })
        .eq('id', contest.id);
    } else if (now >= lockTime) {
      await supabase
        .from('contests')
        .update({ lifecycle_status: 'live' })
        .eq('id', contest.id);
    }
  }
}

// Run every 5 minutes
setInterval(updateContestLifecycle, 5 * 60 * 1000);
```

---

## Implementation Priority

### Phase 1: Fix Immediate Issues (1 day)
1. ✅ Fix multiple refreshes
2. ✅ Add debouncing
3. ✅ Test and verify

### Phase 2: Multi-Contest Bundles (1 week)
1. Create database schema
2. Build admin UI for bundles
3. Update matchup calculation
4. Update frontend display
5. Test with multiple tracks

### Phase 3: Smart Filtering (3 days)
1. Implement scenario generation
2. Add client-side filtering
3. Build hybrid system
4. Test performance

### Phase 4: Results Integration (2 days)
1. Auto-fetch results for past contests
2. Merge with entries
3. Display in UI
4. Test with real data

### Phase 5: Future Races (3 days)
1. Implement lifecycle states
2. Build auto-update service
3. Add expected points display
4. Test full lifecycle

**Total Timeline: ~2.5 weeks**

---

## Recommendation

**Start with Phase 1 (Fix Refreshes) immediately** - this is causing user frustration.

**Then implement Phase 2 (Multi-Contest Bundles)** - this is the proper architecture for cross-track matchups.

**Phases 3-5 can be done in parallel or sequentially** based on priorities.

---

**Last Updated:** 2025-11-13  
**Status:** Proposal - Awaiting Approval  
**Next Step:** Fix multiple refreshes issue

