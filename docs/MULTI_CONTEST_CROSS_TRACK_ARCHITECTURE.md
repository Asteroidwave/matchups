# Multi-Contest Cross-Track Architecture

## Executive Summary

This document proposes a complete redesign of cross-track matchups to properly support:
1. Multiple contests/tracks in a single matchup bundle
2. Dynamic track visibility filtering
3. Results integration for past data
4. Future race support

---

## Current Problems

### Problem 1: Multiple Refreshes ✅ FIXED
**Issue:** Page refreshes 5+ times after matchup calculation  
**Cause:** Duplicate `loadContestStatuses` and `loadContests` calls  
**Fix:** Removed duplicate call in `handleMatchupTypesSuccess`  
**Status:** ✅ Complete

### Problem 2: Cross-Track Architecture ⚠️ NEEDS REDESIGN
**Issue:** Cross-track is per-contest, but needs multi-contest data  
**Current:** Each contest calculates its own cross-track matchups  
**Problem:** Limited to connections within one contest  
**Solution:** Multi-contest bundles (see below)

### Problem 3: Dynamic Track Filtering ⚠️ COMPLEX
**Issue:** If user hides a track, matchups should reorganize  
**Challenge:** Pre-generating all combinations is exponential (2^n)  
**Solution:** Hybrid approach (see below)

### Problem 4: Results Integration ⚠️ TODO
**Issue:** Past data needs results pulled and merged  
**Solution:** Auto-fetch results for past contests

### Problem 5: Future Races ⚠️ TODO
**Issue:** Need to support future contests  
**Solution:** Lifecycle states and auto-updates

---

## Proposed Architecture

### Concept: Multi-Contest Bundles

Instead of cross-track being a matchup type per contest, create **bundles** that span multiple contests.

```
┌─────────────────────────────────────────────────────┐
│ Multi-Contest Bundle: "Weekend Warriors"            │
├─────────────────────────────────────────────────────┤
│ Date: November 15, 2025                             │
│ Contests Included:                                  │
│   - Contest 1: DEL (Delaware Park)                  │
│   - Contest 2: SA (Santa Anita)                     │
│   - Contest 3: GP (Gulfstream Park)                 │
│                                                     │
│ Matchup Types:                                      │
│   - Cross-Track Jockeys (40 matchups)              │
│   - Cross-Track Trainers (30 matchups)             │
│   - Cross-Track Sires (30 matchups)                │
│   - Cross-Track Mixed (50 matchups)                │
│                                                     │
│ Total Matchups: 150                                 │
│ Status: Active                                      │
└─────────────────────────────────────────────────────┘
```

### Database Schema

#### 1. New Table: `multi_contest_bundles`

```sql
CREATE TABLE multi_contest_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  contest_ids UUID[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT bundle_name_date_unique UNIQUE (name, date)
);

CREATE INDEX idx_bundles_date ON multi_contest_bundles(date);
CREATE INDEX idx_bundles_active ON multi_contest_bundles(is_active);
CREATE INDEX idx_bundles_status ON multi_contest_bundles(status);
```

#### 2. Update `matchups` Table

```sql
ALTER TABLE matchups ADD COLUMN bundle_id UUID REFERENCES multi_contest_bundles(id) ON DELETE CASCADE;
ALTER TABLE matchups ADD COLUMN included_tracks TEXT[];
ALTER TABLE matchups ADD COLUMN scenario_key VARCHAR(100);

CREATE INDEX idx_matchups_bundle ON matchups(bundle_id);
CREATE INDEX idx_matchups_scenario ON matchups(bundle_id, scenario_key);

-- Add constraint: matchup must have either contest_id OR bundle_id
ALTER TABLE matchups ADD CONSTRAINT matchup_parent_check 
  CHECK (
    (contest_id IS NOT NULL AND bundle_id IS NULL) OR
    (contest_id IS NULL AND bundle_id IS NOT NULL)
  );
```

#### 3. New Table: `bundle_track_visibility`

```sql
CREATE TABLE bundle_track_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id UUID REFERENCES multi_contest_bundles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_tracks TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT bundle_user_unique UNIQUE (bundle_id, user_id)
);

CREATE INDEX idx_bundle_visibility_user ON bundle_track_visibility(user_id);
CREATE INDEX idx_bundle_visibility_bundle ON bundle_track_visibility(bundle_id);
```

---

## Dynamic Track Filtering Solution

### Strategy: Pre-Generate Common Scenarios + Client-Side Fallback

#### Scenarios to Pre-Generate

For a bundle with N tracks, generate:
1. **All tracks** (1 scenario)
2. **All 2-track combinations** (C(n,2) scenarios)
3. **Each single track** (n scenarios)

**Example with 3 tracks (KEE, AQU, BAQ):**
```
Scenarios to generate:
1. all: [KEE, AQU, BAQ]           (all tracks)
2. KEE_AQU: [KEE, AQU]            (2-track combo)
3. KEE_BAQ: [KEE, BAQ]            (2-track combo)
4. AQU_BAQ: [AQU, BAQ]            (2-track combo)
5. KEE: [KEE]                     (single track)
6. AQU: [AQU]                     (single track)
7. BAQ: [BAQ]                     (single track)

Total: 7 scenarios
```

**Complexity Analysis:**
```
3 tracks: 1 + 3 + 3 = 7 scenarios
4 tracks: 1 + 6 + 4 = 11 scenarios
5 tracks: 1 + 10 + 5 = 16 scenarios
10 tracks: 1 + 45 + 10 = 56 scenarios (still manageable)
```

#### Backend Implementation

```typescript
// backend/src/services/bundleMatchupCalculation.ts

interface BundleScenario {
  key: string;
  tracks: string[];
  matchups: Matchup[];
}

async function generateBundleMatchups(
  bundleId: string,
  contestIds: string[]
): Promise<void> {
  // 1. Load all contest data
  const allContests = await loadContestsData(contestIds);
  const allTracks = allContests.map(c => c.track);
  
  // 2. Generate scenarios
  const scenarios: BundleScenario[] = [];
  
  // Scenario 1: All tracks
  scenarios.push({
    key: 'all',
    tracks: allTracks,
    matchups: []
  });
  
  // Scenario 2: All 2-track combinations
  for (let i = 0; i < allTracks.length; i++) {
    for (let j = i + 1; j < allTracks.length; j++) {
      const tracks = [allTracks[i], allTracks[j]];
      scenarios.push({
        key: tracks.sort().join('_'),
        tracks,
        matchups: []
      });
    }
  }
  
  // Scenario 3: Each single track
  for (const track of allTracks) {
    scenarios.push({
      key: track,
      tracks: [track],
      matchups: []
    });
  }
  
  console.log(`Generating ${scenarios.length} scenarios for ${allTracks.length} tracks`);
  
  // 3. Generate matchups for each scenario
  for (const scenario of scenarios) {
    console.log(`Generating scenario: ${scenario.key} (tracks: ${scenario.tracks.join(', ')})`);
    
    // Filter contests to only included tracks
    const relevantContests = allContests.filter(c => 
      scenario.tracks.includes(c.track)
    );
    
    // Combine all records from relevant contests
    const allRecords = relevantContests.flatMap(c => c.records);
    
    // Generate connections
    const jockeyConns = await generateConnections(allRecords, 'jockey', scenario.tracks, date);
    const trainerConns = await generateConnections(allRecords, 'trainer', scenario.tracks, date);
    const sireConns = await generateConnections(allRecords, 'sire', scenario.tracks, date);
    
    const allConnections = [...jockeyConns, ...trainerConns, ...sireConns];
    
    // Generate matchups with cross-track validation
    const horseMap = buildConnectionHorseMap(allConnections);
    const matchups = generateUnifiedMatchups(
      allConnections,
      DEFAULT_UNIFIED_SETTINGS.cross_track,
      horseMap,
      false, // not mixed
      true   // is cross-track
    );
    
    scenario.matchups = matchups;
    
    // Store in database
    await supabase
      .from('matchups')
      .insert({
        bundle_id: bundleId,
        matchup_type: 'cross_track',
        included_tracks: scenario.tracks,
        scenario_key: scenario.key,
        matchup_data: {
          matchups,
          pool_count: matchups.length,
          display_count: Math.min(40, matchups.length),
        }
      });
    
    console.log(`✅ Stored ${matchups.length} matchups for scenario ${scenario.key}`);
  }
}
```

#### Frontend Implementation

```typescript
// app/matchups/page.tsx

const [visibleTracks, setVisibleTracks] = useState<string[]>([]);
const [bundleScenarioKey, setBundleScenarioKey] = useState<string>('all');

// When user toggles track visibility
const handleTrackToggle = (track: string) => {
  setVisibleTracks(prev => {
    const newTracks = prev.includes(track)
      ? prev.filter(t => t !== track)
      : [...prev, track];
    
    // Update scenario key
    const scenarioKey = generateScenarioKey(newTracks);
    setBundleScenarioKey(scenarioKey);
    
    // Fetch matchups for this scenario
    loadMatchupsForScenario(bundleId, scenarioKey);
    
    return newTracks;
  });
};

// Load matchups for scenario
async function loadMatchupsForScenario(
  bundleId: string,
  scenarioKey: string
) {
  const { data } = await supabase
    .from('matchups')
    .select('*')
    .eq('bundle_id', bundleId)
    .eq('scenario_key', scenarioKey);
  
  if (data && data.length > 0) {
    // Use pre-generated scenario
    setMatchups(data);
  } else {
    // Fallback: filter 'all' scenario client-side
    const { data: allData } = await supabase
      .from('matchups')
      .select('*')
      .eq('bundle_id', bundleId)
      .eq('scenario_key', 'all');
    
    if (allData) {
      const filtered = filterMatchupsByTracks(allData, visibleTracks);
      setMatchups(filtered);
    }
  }
}

function generateScenarioKey(tracks: string[]): string {
  if (tracks.length === 0) return 'all';
  return tracks.sort().join('_');
}
```

---

## Admin UI Design

### Step 1: Manage Contests Page - Add Bundle Button

```typescript
// components/admin/ContestManagement.tsx

<div className="flex items-center gap-2 mb-4">
  <Button onClick={loadContests}>
    <RefreshCw className="w-4 h-4 mr-2" />
    Refresh
  </Button>
  
  {/* NEW: Create Bundle Button */}
  <Button 
    onClick={() => setIsBundleDialogOpen(true)}
    variant="outline"
    disabled={contests.length < 2}
  >
    <Calendar className="w-4 h-4 mr-2" />
    Create Cross-Track Bundle
    {contests.length < 2 && (
      <span className="ml-2 text-xs text-gray-500">
        (Need 2+ contests)
      </span>
    )}
  </Button>
</div>
```

### Step 2: Bundle Creation Dialog

```typescript
// components/admin/CreateBundleDialog.tsx

<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Create Cross-Track Bundle</DialogTitle>
      <DialogDescription>
        Combine multiple contests to create cross-track matchups
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Bundle Name */}
      <div>
        <Label>Bundle Name</Label>
        <Input
          placeholder="e.g., Weekend Warriors"
          value={bundleName}
          onChange={(e) => setBundleName(e.target.value)}
        />
      </div>
      
      {/* Date Filter */}
      <div>
        <Label>Date</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
      
      {/* Contest Selection */}
      <div>
        <Label>Select Contests (Minimum 2)</Label>
        <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
          {contestsForDate.map(contest => (
            <div key={contest.id} className="flex items-center gap-2">
              <Checkbox
                checked={selectedContests.includes(contest.id)}
                onCheckedChange={() => handleToggleContest(contest.id)}
              />
              <Label className="flex-1">
                {contest.track} - {contest.date}
                <span className="ml-2 text-sm text-gray-500">
                  ({contest.status})
                </span>
              </Label>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Selected: {selectedContests.length} contests
        </p>
      </div>
      
      {/* Preview */}
      {selectedContests.length >= 2 && (
        <Alert>
          <AlertDescription>
            This will create cross-track matchups using data from:
            {selectedContests.map(id => {
              const contest = contestsForDate.find(c => c.id === id);
              return contest ? ` ${contest.track}` : '';
            }).join(',')}
          </AlertDescription>
        </Alert>
      )}
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button 
        onClick={handleCreate}
        disabled={selectedContests.length < 2 || !bundleName}
      >
        Create Bundle
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Step 3: Bundle Management View

```typescript
// Add to ContestManagement.tsx

<Tabs defaultValue="contests">
  <TabsList>
    <TabsTrigger value="contests">Individual Contests</TabsTrigger>
    <TabsTrigger value="bundles">Cross-Track Bundles</TabsTrigger>
  </TabsList>
  
  <TabsContent value="contests">
    {/* Existing contest table */}
  </TabsContent>
  
  <TabsContent value="bundles">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bundle Name</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Tracks</TableHead>
          <TableHead>Matchups</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bundles.map(bundle => (
          <TableRow key={bundle.id}>
            <TableCell>{bundle.name}</TableCell>
            <TableCell>{bundle.date}</TableCell>
            <TableCell>
              {bundle.contest_ids.length} tracks
            </TableCell>
            <TableCell>
              {bundle.matchup_count || 0}
            </TableCell>
            <TableCell>
              <Badge>{bundle.status}</Badge>
            </TableCell>
            <TableCell>
              <Button onClick={() => handleConfigureBundle(bundle)}>
                Configure
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TabsContent>
</Tabs>
```

---

## Dynamic Track Filtering Implementation

### Backend: Scenario Generation

```typescript
// backend/src/services/bundleMatchupCalculation.ts

export async function calculateBundleMatchups(
  bundleId: string,
  matchupTypes: string[]
): Promise<void> {
  // 1. Get bundle details
  const { data: bundle } = await supabase
    .from('multi_contest_bundles')
    .select('*, contest_ids')
    .eq('id', bundleId)
    .single();
  
  if (!bundle) throw new Error('Bundle not found');
  
  // 2. Load all contest data
  const contests = await Promise.all(
    bundle.contest_ids.map(id => loadContestData(id))
  );
  
  const allTracks = contests.map(c => c.track);
  
  // 3. Generate scenarios
  const scenarios = generateScenarios(allTracks);
  console.log(`Generating ${scenarios.length} scenarios for ${allTracks.length} tracks`);
  
  // 4. For each scenario, generate matchups
  for (const scenario of scenarios) {
    await generateMatchupsForScenario(
      bundleId,
      scenario,
      contests,
      matchupTypes
    );
  }
  
  // 5. Update bundle status
  await supabase
    .from('multi_contest_bundles')
    .update({ status: 'ready' })
    .eq('id', bundleId);
}

function generateScenarios(tracks: string[]): Array<{key: string; tracks: string[]}> {
  const scenarios: Array<{key: string; tracks: string[]}> = [];
  
  // All tracks
  scenarios.push({ key: 'all', tracks: [...tracks] });
  
  // 2-track combinations
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const combo = [tracks[i], tracks[j]].sort();
      scenarios.push({ key: combo.join('_'), tracks: combo });
    }
  }
  
  // Single tracks
  for (const track of tracks) {
    scenarios.push({ key: track, tracks: [track] });
  }
  
  return scenarios;
}
```

### Frontend: Track Visibility Toggle

```typescript
// app/matchups/page.tsx

// For bundles, show track toggles
{isBundle && (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-sm font-medium">Visible Tracks:</span>
    {bundleTracks.map(track => (
      <Button
        key={track}
        size="sm"
        variant={visibleTracks.includes(track) ? "default" : "outline"}
        onClick={() => handleTrackToggle(track)}
      >
        {track}
        {!visibleTracks.includes(track) && (
          <EyeOff className="w-3 h-3 ml-1" />
        )}
      </Button>
    ))}
  </div>
)}

// Load matchups based on visible tracks
useEffect(() => {
  if (isBundle && bundleId) {
    const scenarioKey = generateScenarioKey(visibleTracks);
    loadMatchupsForScenario(bundleId, scenarioKey);
  }
}, [isBundle, bundleId, visibleTracks]);
```

### Persistence: User Preferences

```typescript
// Save user's track visibility preferences
async function saveTrackVisibility(
  bundleId: string,
  userId: string,
  visibleTracks: string[]
) {
  await supabase
    .from('bundle_track_visibility')
    .upsert({
      bundle_id: bundleId,
      user_id: userId,
      visible_tracks: visibleTracks,
      updated_at: new Date().toISOString()
    });
}

// Load on mount
async function loadTrackVisibility(
  bundleId: string,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('bundle_track_visibility')
    .select('visible_tracks')
    .eq('bundle_id', bundleId)
    .eq('user_id', userId)
    .single();
  
  return data?.visible_tracks || []; // Empty = show all
}
```

---

## Results Integration

### Auto-Fetch Results for Past Contests

```typescript
// backend/src/services/resultsIntegration.ts

export async function ensureResultsAvailable(
  contestId: string
): Promise<boolean> {
  const { data: contest } = await supabase
    .from('contests')
    .select('track, date, track_data_id')
    .eq('id', contestId)
    .single();
  
  if (!contest) return false;
  
  const contestDate = new Date(contest.date);
  const today = new Date();
  
  // Only fetch if past contest
  if (contestDate >= today) {
    console.log('Future contest, no results available yet');
    return false;
  }
  
  // Check if we already have results
  const { data: trackData } = await supabase
    .from('track_data')
    .select('data')
    .eq('id', contest.track_data_id)
    .single();
  
  if (trackData?.data?.results && trackData.data.results.length > 0) {
    console.log('Results already available');
    return true;
  }
  
  // Fetch results from API
  console.log(`Fetching results for ${contest.track} on ${contest.date}`);
  const results = await getTrackResults(contest.track, contest.date);
  
  if (results.length === 0) {
    console.warn('No results found');
    return false;
  }
  
  // Merge with entries
  const mergedEntries = mergeEntriesWithResults(
    trackData.data.entries,
    results
  );
  
  // Update track_data
  await supabase
    .from('track_data')
    .update({
      data: {
        entries: mergedEntries,
        results: results
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', contest.track_data_id);
  
  console.log(`✅ Results merged for ${contest.track}`);
  return true;
}

// Call this when loading contest matchups
export async function loadContestWithResults(contestId: string) {
  await ensureResultsAvailable(contestId);
  // Then load matchups as normal
}
```

---

## Future Races Support

### Lifecycle Management

```typescript
// backend/src/services/contestLifecycle.ts

export async function updateAllContestLifecycles() {
  const now = new Date();
  
  // Get all active contests
  const { data: contests } = await supabase
    .from('contests')
    .select('*')
    .eq('is_active', true)
    .in('lifecycle_status', ['scheduled', 'locked', 'live', 'settling']);
  
  for (const contest of contests || []) {
    await updateContestLifecycle(contest, now);
  }
}

async function updateContestLifecycle(contest: Contest, now: Date) {
  const lockTime = new Date(contest.lock_time);
  const firstPostTime = new Date(contest.first_post_time);
  const lastPostTime = new Date(contest.last_post_time);
  
  let newStatus = contest.lifecycle_status;
  
  if (now >= lastPostTime.getTime() + (2 * 60 * 60 * 1000)) {
    // 2 hours after last race - fetch results
    newStatus = 'settling';
    await ensureResultsAvailable(contest.id);
    
    // Check if results are complete
    const resultsComplete = await checkResultsComplete(contest.id);
    if (resultsComplete) {
      newStatus = 'settled';
    }
  } else if (now >= firstPostTime) {
    newStatus = 'live';
  } else if (now >= lockTime) {
    newStatus = 'locked';
  }
  
  if (newStatus !== contest.lifecycle_status) {
    await supabase
      .from('contests')
      .update({ lifecycle_status: newStatus })
      .eq('id', contest.id);
    
    console.log(`Contest ${contest.id} transitioned: ${contest.lifecycle_status} → ${newStatus}`);
  }
}

// Run every 5 minutes
setInterval(updateAllContestLifecycles, 5 * 60 * 1000);
```

---

## Implementation Plan

### Phase 1: Fix Refreshes (DONE ✅)
- [x] Remove duplicate loadContestStatuses call
- [x] Test and verify

### Phase 2: Database Schema (2 days)
- [ ] Create `multi_contest_bundles` table
- [ ] Update `matchups` table (add bundle_id, included_tracks, scenario_key)
- [ ] Create `bundle_track_visibility` table
- [ ] Add constraints and indexes
- [ ] Migration script

### Phase 3: Backend - Bundle Calculation (3 days)
- [ ] Create `bundleMatchupCalculation.ts`
- [ ] Implement scenario generation
- [ ] Implement matchup generation per scenario
- [ ] Add bundle status management
- [ ] Test with 3-track bundle

### Phase 4: Admin UI - Bundle Management (3 days)
- [ ] Create `CreateBundleDialog.tsx`
- [ ] Add bundle tab to ContestManagement
- [ ] Add bundle configuration dialog
- [ ] Add bundle list view
- [ ] Test bundle creation flow

### Phase 5: Frontend - Bundle Display (2 days)
- [ ] Update contest selector to include bundles
- [ ] Add track visibility toggles
- [ ] Implement scenario switching
- [ ] Add bundle-specific UI elements
- [ ] Test track filtering

### Phase 6: Results Integration (2 days)
- [ ] Implement `ensureResultsAvailable()`
- [ ] Add auto-fetch for past contests
- [ ] Merge results with entries
- [ ] Update UI to show results
- [ ] Test with historical data

### Phase 7: Future Races (2 days)
- [ ] Implement lifecycle management
- [ ] Add scheduled task for status updates
- [ ] Update UI for future contests
- [ ] Test full lifecycle

**Total Timeline: ~2.5 weeks**

---

## Storage Impact Analysis

### Scenario Storage Requirements

**Example: 3-track bundle**
- Scenarios: 7 (1 all + 3 two-track + 3 single)
- Matchups per scenario: ~40
- Total matchups stored: 7 × 40 = 280 matchups

**Example: 5-track bundle**
- Scenarios: 16 (1 all + 10 two-track + 5 single)
- Matchups per scenario: ~40
- Total matchups stored: 16 × 40 = 640 matchups

**Storage per matchup:** ~2KB (JSON data)
**Total storage:**
- 3 tracks: 280 × 2KB = 560KB
- 5 tracks: 640 × 2KB = 1.28MB

**Verdict:** ✅ Acceptable storage overhead

### Performance Impact

**Generation Time:**
- 3 tracks, 7 scenarios: ~5-7 seconds
- 5 tracks, 16 scenarios: ~12-15 seconds

**Switching Time:**
- Pre-generated scenario: <100ms (database query)
- Client-side filtering: <50ms (in-memory)

**Verdict:** ✅ Acceptable performance

---

## Alternative: Simplified Approach

If the full multi-contest bundle system is too complex, here's a simpler alternative:

### Simplified Cross-Track

**Concept:** Generate cross-track matchups on-the-fly, cache aggressively

```typescript
// When user selects tracks to view
async function loadCrossTrackMatchups(
  visibleTracks: string[],
  date: string
) {
  // 1. Check cache
  const cacheKey = `cross_track:${visibleTracks.sort().join('_')}:${date}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Generate on-demand
  const matchups = await generateCrossTrackMatchupsAPI(visibleTracks, date);
  
  // 3. Cache result
  sessionStorage.setItem(cacheKey, JSON.stringify(matchups));
  
  return matchups;
}
```

**Pros:**
- ✅ Simpler implementation
- ✅ No database changes
- ✅ Works for any track combination

**Cons:**
- ❌ Slower first load
- ❌ Cache doesn't persist across sessions
- ❌ More backend load

---

## Recommendation

### For Now (Quick Win)
1. ✅ **Fix refreshes** (DONE)
2. Use **simplified cross-track** with aggressive caching
3. Generate on-demand, cache in sessionStorage

### For Future (Proper Solution)
1. Implement **multi-contest bundles** (Phase 2-5)
2. Pre-generate common scenarios
3. Use hybrid approach for filtering

### Rationale
- Simplified approach gets you working cross-track in 2-3 days
- Full bundle system takes 2.5 weeks but is more scalable
- Can migrate from simplified to full later

---

## Next Steps

**Immediate:**
1. Test the refresh fix
2. Decide: Simplified vs Full bundle system
3. If simplified: Implement on-demand generation
4. If full: Start Phase 2 (database schema)

**Questions to Answer:**
1. How many tracks will you typically have? (3-5 or 10+?)
2. How important is instant track switching? (Critical or nice-to-have?)
3. What's your timeline? (Need it this week or can wait 2-3 weeks?)

---

**Last Updated:** 2025-11-13  
**Status:** Proposal - Awaiting Decision  
**Recommended:** Start with simplified approach, migrate to full system later

