# Next Improvements & Feature Requests

**Date:** 2025-11-12  
**Status:** Backlog for Phase 2+

---

## Immediate Fixes (Blocking Simulation Testing)

### ✅ Contest Locked Error for Past Dates
**Issue:** Cannot submit entries for past contests (needed for simulation)  
**Fix:** Allow entries for past contests (simulation testing)  
**File:** `backend/src/routes/entries.ts`  
**Status:** FIXED

---

## Performance & UX Improvements

### 1. Per-Track Caching for Faster Switching
**Issue:** Switching between tracks takes too long (loads from scratch each time)  
**Requested:** Use cached data for smoother track switching  

**Solution:**
- Cache matchups/connections per track in sessionStorage
- Key format: `track_matchups_{track}_{date}`
- When switching tracks, check cache first
- Load in background if cache exists
- Only show loading if no cache available

**Implementation:**
```typescript
// In contexts/AppContext.tsx
const TRACK_CACHE_KEYS = {
  matchups: (track: string, date: string) => `track_matchups_${track}_${date}`,
  connections: (track: string, date: string) => `track_connections_${track}_${date}`,
};

// Save per-track
sessionStorage.setItem(TRACK_CACHE_KEYS.matchups(track, date), JSON.stringify(matchups));

// Load per-track
const cached = sessionStorage.getItem(TRACK_CACHE_KEYS.matchups(track, date));
```

**Files to modify:**
- `contexts/AppContext.tsx`
- `app/matchups/page.tsx`

**Priority:** HIGH (improves core UX)

---

### 2. Track Color Badges for Multi-Track View
**Issue:** When multiple tracks are selected, hard to distinguish which connection is from which track  
**Requested:** Show track color badges like in first version  

**Solution:**
- Add small colored badges next to connection names
- Use consistent track colors:
  - AQU: Blue
  - GP: Green
  - LRL: Purple
  - DMR: Red
  - CD: Yellow
  - KEE: Orange
  - SA: Pink

**Example:**
```
Jose Lezcano [AQU] [GP]
        (blue) (green)
```

**Files to modify:**
- `components/cards/ConnectionCard.tsx` (already has track badges, just need to make more prominent)
- `components/windows/StartersWindow.tsx`

**Priority:** MEDIUM (nice visual enhancement)

---

### 3. Cross-Track Mixed Matchups
**Issue:** Mixed matchups currently only mix roles (jockey vs trainer), not tracks  
**Requested:** Generate matchups where connections are from different tracks  

**Solution:**
- New matchup generation mode: `cross_track_mixed`
- Admin can enable "Cross-Track Matchups" option
- Generates matchups like:
  - AQU Jockey vs GP Jockey
  - LRL Trainer vs DMR Trainer
  - Multi-track sets (AQU+GP connections in one set)

**Implementation:**
```typescript
// In backend/src/services/matchupCalculation.ts
if (typeSettings.enableCrossTrack) {
  // Mix connections from different tracks
  const trackGroups = groupConnectionsByTrack(connections);
  // Create matchups across tracks
}
```

**Files to modify:**
- `backend/src/services/matchupCalculation.ts`
- `components/admin/MatchupCalculationSettings.tsx`

**Priority:** MEDIUM (new feature)

---

### 4. Smart "Mixed" Track Button Visibility
**Issue:** "Mixed" button shows even when no cross-track matchups exist  
**Requested:** Hide Mixed button if no cross-track matchups available  

**Solution:**
```typescript
// In app/matchups/page.tsx
const hasCrossTrackMatchups = matchups.some(m => {
  const tracks = new Set([
    ...m.setA.connections.flatMap(c => c.trackSet),
    ...m.setB.connections.flatMap(c => c.trackSet)
  ]);
  return tracks.size > 1;
});

// Only show Mixed button if cross-track matchups exist
{availableTracks.length > 1 && hasCrossTrackMatchups && (
  <button value="mixed">Mixed</button>
)}
```

**Files to modify:**
- `app/matchups/page.tsx`

**Priority:** LOW (minor UX improvement)

---

## Summary

**Immediate Action:**
1. ✅ Fix "Contest is locked" error (DONE)
2. Restart backend
3. Try submitting entry again
4. Create simulation
5. Test live features

**Next Phase:**
1. Per-track caching (for performance)
2. Track color badges (for clarity)
3. Cross-track matchups (new feature)
4. Smart button visibility (polish)

---

## Current Blocker Resolution

The "Contest is locked" error was blocking you from:
- Submitting entries for past contests
- Testing simulations
- Viewing live progress

**It's now fixed!** The backend will:
- Allow entries for past contests (for simulation)
- Still enforce lock time for future/current contests (for real play)

**Next Steps:**
1. Wait for backend to restart (~10 seconds)
2. Go to matchups page
3. Select LRL 2025-11-09
4. Make picks
5. Click "Play"
6. Should work now!

---

**Let me know once you try it!**

