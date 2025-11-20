# Major Refactor Plan - Multi-Track System

## Overview

This document outlines the complete refactor needed to support true multi-track functionality with proper pick tracking across tracks.

---

## Issues to Fix

### 1. Multiple Refreshes in Manage Contests ✅ (Already Fixed)
- Removed duplicate loadContestStatuses call

### 2. Slow Track Switching ⚠️ CRITICAL (In Progress)
**Problem:** Takes too long to load matchups when switching tracks  
**Current Fix:** `AppContext` now preloads every active contest and caches data per track; switching pulls from memory instantly. Per-track refresh API and silent error fallback are in place. Need final QA across 10+ track scenarios and ensure toast messaging is available when refresh fails.

### 3. Pick Inconsistency Across Tabs/Tracks ✅ (Fixed 2025-11-15)
**Problem:** Picks disappeared or changed when switching tabs/tracks  
**Fix:** Global `track-type-matchupId` keys + metadata persistence in `app/matchups/page.tsx`

### 4. No Multi-Track Matchup Generation ⚠️ CRITICAL
**Problem:** Can't create matchups across multiple tracks  
**Solution:** Multi-track bundle system with UI

### 5. Global Connection Exclusion ⚠️ IMPORTANT
**Problem:** Same name appears in multiple matchup types/tracks  
**Requirement:** Once used in one matchup, exclude from all others  
**Solution:** Global used connections tracking

### 6. Matchup Quality (High Salary/Apps) ⚠️ IMPORTANT
**Problem:** Not seeing high salary/apps connections enough  
**Solution:** Already implemented tiered system, needs tuning

---

## New Architecture: Multi-Track System

### Core Concept

```
OLD (Current):
- User selects ONE track/contest
- Loads matchups for that track
- Makes picks
- Switches track → loses context

NEW (Proposed):
- User can select MULTIPLE tracks
- All tracks loaded simultaneously
- Picks tracked globally across all tracks
- Switch tracks instantly (no reload)
- Submit round with picks from any tracks
```

### Data Structure Changes

#### Current Pick Structure
```typescript
// Scoped by matchup type
selections: {
  'jockey_vs_jockey-matchup-1': 'A',
  'trainer_vs_trainer-matchup-2': 'B'
}
```

#### New Pick Structure
```typescript
// Scoped by track AND matchup type
selections: {
  'AQU-jockey_vs_jockey-matchup-1': 'A',
  'DEL-trainer_vs_trainer-matchup-2': 'B',
  'GP-sire_vs_sire-matchup-3': 'A'
}

// Or better: structured object
selections: {
  matchupId: {
    track: 'AQU',
    type: 'jockey_vs_jockey',
    chosen: 'A',
    matchup: {...} // Full matchup data
  }
}
```

---

## Implementation Plan

### Phase 1: Fix Critical Issues (2-3 days)

#### 1.1 Instant Track Switching
**Goal:** Load all tracks at once, switch instantly

```typescript
// contexts/AppContext.tsx

// Load ALL active contests on mount
const [allContests, setAllContests] = useState<Contest[]>([]);
const [contestData, setContestData] = useState<Map<string, ContestData>>(new Map());

const loadAllContests = async () => {
  // Load all active contests
  const contests = await fetchActiveContests();
  
  // Load matchups for ALL contests in parallel
  const dataPromises = contests.map(async (contest) => {
    const matchups = await fetchMatchupsForContest(contest.id);
    return { contestId: contest.id, track: contest.track, matchups };
  });
  
  const allData = await Promise.all(dataPromises);
  
  // Store in map for instant access
  const dataMap = new Map();
  allData.forEach(({ contestId, track, matchups }) => {
    dataMap.set(track, { contestId, matchups });
  });
  
  setContestData(dataMap);
  setAllContests(contests);
};

// Switch tracks instantly (no reload)
const switchTrack = (track: string) => {
  const data = contestData.get(track);
  if (data) {
    setMatchups(data.matchups); // Instant!
  }
};
```

✅ **Status (2025-11-15):** Implemented via `allTracksData` cache + `applyTrackData` helper in `contexts/AppContext`. Every active contest preloads on mount, and the track selector now swaps data instantly without hitting the backend.

#### 1.2 Global Pick Tracking ✅
**Status:** Implemented (2025-11-15)
**Notes:** Frontend now stores per-pick metadata (track, type, names) in session cache. Needs AppContext backing store next.

```typescript
// New pick structure
interface Pick {
  matchupId: string;
  track: string;
  matchupType: string;
  chosen: 'A' | 'B';
  matchup: Matchup; // Store full matchup for display
}

const [picks, setPicks] = useState<Map<string, Pick>>(new Map());

// Add pick
const addPick = (matchup: Matchup, chosen: 'A' | 'B') => {
  setPicks(prev => {
    const newPicks = new Map(prev);
    newPicks.set(matchup.id, {
      matchupId: matchup.id,
      track: getCurrentTrack(matchup),
      matchupType: matchup.matchupType,
      chosen,
      matchup
    });
    return newPicks;
  });
};

// Display picks grouped by track
const picksByTrack = useMemo(() => {
  const grouped = new Map<string, Pick[]>();
  picks.forEach(pick => {
    const trackPicks = grouped.get(pick.track) || [];
    trackPicks.push(pick);
    grouped.set(pick.track, trackPicks);
  });
  return grouped;
}, [picks]);
```

#### 1.3 Multi-Track Bundle UI
**Goal:** Create matchups across multiple tracks

```typescript
// components/admin/MultiTrackBundleDialog.tsx

<Dialog>
  <DialogHeader>
    <DialogTitle>Create Multi-Track Matchups</DialogTitle>
  </DialogHeader>
  
  <div className="space-y-4">
    {/* Track Selection */}
    <div>
      <Label>Select Tracks (2-4)</Label>
      {availableContests.map(contest => (
        <Checkbox
          key={contest.id}
          checked={selectedTracks.includes(contest.track)}
          onCheckedChange={() => toggleTrack(contest.track)}
        >
          {contest.track} - {contest.date}
        </Checkbox>
      ))}
    </div>
    
    {/* Matchup Types */}
    <div>
      <Label>Matchup Types</Label>
      <Checkbox checked={includeJockeys}>Cross-Track Jockeys</Checkbox>
      <Checkbox checked={includeTrainers}>Cross-Track Trainers</Checkbox>
      <Checkbox checked={includeSires}>Cross-Track Sires</Checkbox>
      <Checkbox checked={includeMixed}>Cross-Track Mixed</Checkbox>
    </div>
    
    <Button onClick={handleGenerate}>
      Generate Multi-Track Matchups
    </Button>
  </div>
</Dialog>
```

### Phase 2: Global Connection Exclusion (1 day)

#### 2.1 Track Used Connections Globally
**Goal:** Once a connection is used, exclude from all other matchups

```typescript
// backend/src/services/unifiedMatchupGenerator.ts

export function generateAllMatchupTypes(
  connections: Connection[],
  matchupTypes: string[]
): Record<string, Matchup[]> {
  const allMatchups: Record<string, Matchup[]> = {};
  const globalUsedConnections = new Set<string>(); // GLOBAL tracker
  
  // Generate in priority order (ensures high-value connections go to preferred types)
  const priorityOrder = ['jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed'];
  
  for (const type of priorityOrder) {
    if (!matchupTypes.includes(type)) continue;
    
    // Filter out globally used connections
    const availableConnections = connections.filter(c => 
      !globalUsedConnections.has(c.id)
    );
    
    // Generate matchups for this type
    const matchups = generateUnifiedMatchups(
      availableConnections,
      DEFAULT_UNIFIED_SETTINGS[type],
      buildConnectionHorseMap(availableConnections)
    );
    
    // Mark connections as used GLOBALLY
    matchups.forEach(matchup => {
      matchup.setA.connections.forEach(c => globalUsedConnections.add(c.id));
      matchup.setB.connections.forEach(c => globalUsedConnections.add(c.id));
    });
    
    allMatchups[type] = matchups;
  }
  
  return allMatchups;
}
```

### Phase 3: Improved Matchup Quality (1 day)

#### 3.1 Prioritize High Salary/Apps
**Goal:** Ensure high-value connections appear in matchups

```typescript
// Already implemented: Tiered system
// Enhancement: Adjust tier weights

function createSalaryTiers(connections: Connection[], numTiers: number = 3) {
  // CHANGED: Use 3 tiers instead of 4 for better concentration
  // Tier 1: Top 40% (was 25%)
  // Tier 2: Middle 40% (was 50%)
  // Tier 3: Bottom 20% (was 25%)
  
  const sorted = [...connections].sort((a, b) => {
    // Sort by salary AND apps (combined score)
    const scoreA = b.salarySum + (b.apps * 500); // Weight apps heavily
    const scoreB = a.salarySum + (a.apps * 500);
    return scoreB - scoreA;
  });
  
  const tier1Size = Math.floor(connections.length * 0.4);
  const tier2Size = Math.floor(connections.length * 0.4);
  
  return [
    { connections: sorted.slice(0, tier1Size), tier: 1 },
    { connections: sorted.slice(tier1Size, tier1Size + tier2Size), tier: 2 },
    { connections: sorted.slice(tier1Size + tier2Size), tier: 3 }
  ];
}

// Allocate matchups per tier
const tier1Matchups = Math.floor(num_matchups * 0.5); // 50% from top tier
const tier2Matchups = Math.floor(num_matchups * 0.35); // 35% from middle
const tier3Matchups = num_matchups - tier1Matchups - tier2Matchups; // 15% from bottom
```

---

## Implementation Timeline

### Week 1: Critical Fixes
- Day 1-2: Instant track switching + global pick tracking
- Day 3: Multi-track bundle UI
- Day 4: Global connection exclusion
- Day 5: Testing

### Week 2: Quality & Polish
- Day 1: Matchup quality tuning
- Day 2: Live/simulation multi-track support
- Day 3-4: Testing & bug fixes
- Day 5: Documentation & deployment

---

## Immediate Actions (Today)

Given the scope, let me prioritize the most critical fixes:

### Priority 1: Fix Pick Tracking (CRITICAL)
**Impact:** Users losing their picks  
**Effort:** 2-3 hours  
**Files:** `app/matchups/page.tsx`, `contexts/AppContext.tsx`

### Priority 2: Instant Track Switching (HIGH)
**Impact:** Better UX  
**Effort:** 2-3 hours  
**Files:** `contexts/AppContext.tsx`

### Priority 3: Multi-Track Button (HIGH) – In Progress
**Impact:** Enable cross-track  
**Effort:** 3-4 hours  
**Files:** `components/admin/ContestManagement.tsx`, new dialog  
**Status (2025-11-15):** Admin UI dialog + `/api/admin/multi-track-matchups` endpoint implemented. Next step is persisting generated pools and surfacing status in the dashboard.

### Priority 4: Global Exclusion (MEDIUM)
**Impact:** Better matchup quality  
**Effort:** 2-3 hours  
**Files:** `backend/src/services/unifiedMatchupGenerator.ts`

---

## Questions Before Proceeding

1. **Scope:** Should I implement all of this, or focus on specific issues first?

2. **Timeline:** Do you need this working today, or can it take 1-2 weeks?

3. **Testing:** Can you test incrementally, or need everything working at once?

4. **Priority:** Which is most important?
   - Instant track switching?
   - Pick tracking across tracks?
   - Multi-track matchup generation?
   - Global connection exclusion?

---

**Recommendation:** Let me start with Priority 1 & 2 (pick tracking + instant switching) since those affect current usability the most. Then we can add multi-track generation and global exclusion.

Would you like me to proceed with this plan?

