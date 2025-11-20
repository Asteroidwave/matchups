# Matchup Generation Analysis: Why Fewer Matchups Are Generated

**Status**: ✅ Quality system complete | 🚧 UUID migration in progress

---

## 🆕 LATEST UPDATE: UUID Implementation (2025-11-18)

### Problem:
- Matchup IDs were short, non-unique: `matchup-1`, `matchup-2`
- Caused ID collisions and matching failures
- Not industry standard

### Solution:
- **UUID v4 IDs**: `550e8400-e29b-41d4-a716-446655440000`
- Globally unique, permanent, traceable
- Matches DraftKings/FanDuel/Underdog approach

### Action Required:
1. **Regenerate matchups** in Admin panel (both LRL and DMR)
2. **Delete old entries** in Supabase
3. **Test full flow** with new UUIDs

---

## Problem Summary

When requesting 10 matchups, the system only generates ~8 (or fewer). This happens across multiple tracks (AQU, DMR, and others).

## Root Causes Identified

### 1. **Per-Type Exclusion Logic** (PRIMARY ISSUE)
**Location:** `backend/src/services/unifiedMatchupGenerator.ts` lines 457-475

**What it does:**
- After generating potential 1v1 matchups, the system filters out any matchups that share connections with already-selected matchups
- This ensures each connection appears in only ONE matchup per matchup type
- **This is the main reason for fewer matchups**

**Example:**
- You have 20 eligible connections
- Theoretical maximum with exclusion: `20 / 2 = 10` matchups
- But if connections have overlapping horses or salary differences, you might only get 8 valid pairs

**Code snippet:**
```typescript
// CRITICAL FIX: Filter out pairs that share connections with already-selected matchups
const filtered1v1: typeof selected1v1 = [];
const selectedConnectionIds = new Set<string>();

for (const match of selected1v1) {
  const connAId = match.setA[0].id;
  const connBId = match.setB[0].id;
  
  // Skip if either connection is already used
  if (selectedConnectionIds.has(connAId) || selectedConnectionIds.has(connBId)) {
    continue; // This reduces the count!
  }
  
  filtered1v1.push(match);
  selectedConnectionIds.add(connAId);
  selectedConnectionIds.add(connBId);
}
```

### 2. **Salary Tolerance Too Strict**
**Location:** `backend/src/services/unifiedMatchupGenerator.ts` line 354

**Default:** `$1000` salary difference tolerance

**Impact:**
- If connections have salary differences > $1000, they won't be matched
- This reduces the number of valid pairs

**Example:**
- Connection A: $5000 salary
- Connection B: $6200 salary
- Difference: $1200 > $1000 tolerance → **REJECTED**

### 3. **Horse Overlap Constraint**
**Location:** `backend/src/services/unifiedMatchupGenerator.ts` line 380

**What it does:**
- Prevents matchups where Set A and Set B share any horses
- This is a hard requirement (no exceptions)

**Impact:**
- If many connections share horses (common with jockeys/trainers), this eliminates many potential pairs

### 4. **Minimum Appearances Filter**
**Location:** `backend/src/services/matchupCalculation.ts` lines 555-587

**Defaults:**
- Jockeys: `min_appearances: 3`
- Trainers: `min_appearances: 2`
- Sires: `min_appearances: 1`

**Impact:**
- Connections with fewer appearances are excluded
- Reduces the eligible connection pool

### 5. **Theoretical Maximum Calculation**
**Formula:** `Math.floor(eligible_connections / 2)`

**Example:**
- If you have 15 eligible connections
- Maximum possible matchups: `15 / 2 = 7` (rounded down)
- **You cannot generate 10 matchups with only 15 connections if using per-type exclusion**

## Flow Analysis

### When Requesting 10 Matchups:

1. **Backend receives request:** `count = 10`
2. **Backend generates pool:** `poolSize = 10 * 3 = 30` (generates 3x for pool)
3. **1v1 Matchup Generation:**
   - Calculates `num1v1Needed = Math.floor(30 * 0.875) = 26`
   - Finds all valid pairs within salary tolerance
   - **Filters for per-type exclusion** → reduces to ~8-10 valid pairs
4. **Complex Pattern Generation:**
   - Tries to fill remaining slots (30 - 8 = 22)
   - But connections are already used, so fewer available
5. **Final Result:**
   - `finalMatchups = matchups.slice(0, 30)` → caps at 30
   - But only ~8-10 were actually generated
   - **Display count:** `Math.min(10, 8) = 8` → Shows 8 instead of 10

## Specific Constraints for AQU/DMR

Based on the code logic, here's what likely happens:

1. **Limited Eligible Connections:**
   - After filtering by min_appearances and min_salary, you might have 15-20 eligible connections
   - Theoretical max: `15 / 2 = 7` or `20 / 2 = 10`

2. **Horse Overlap:**
   - Jockeys/trainers often share horses (same jockey rides multiple horses)
   - This eliminates many potential pairs

3. **Salary Distribution:**
   - If salaries are spread out, few pairs fall within $1000 tolerance
   - Example: If connections have salaries like $2000, $3500, $5000, $6500, $8000
     - Only adjacent pairs ($2000 vs $3500, $3500 vs $5000, etc.) are valid
     - This creates a chain, limiting combinations

4. **Per-Type Exclusion:**
   - Once a connection is used, it can't be reused
   - This is the **biggest limiting factor**

## Why This Happens Across All Tracks

The same constraints apply to all tracks:
- Per-type exclusion is universal
- Salary tolerance is the same ($1000)
- Horse overlap checking is the same
- Min appearances requirements are the same

**The issue is systemic, not track-specific.**

## Potential Solutions (Analysis Only - Not Implementing Yet)

### Option 1: Relax Per-Type Exclusion
- **Current:** Each connection can only appear in ONE matchup per type
- **Proposed:** Allow connections to appear in 2-3 matchups per type
- **Trade-off:** More matchups, but less variety

### Option 2: Increase Salary Tolerance
- **Current:** $1000
- **Proposed:** $2000 or $3000
- **Trade-off:** More matchups, but less balanced

### Option 3: Reduce Minimum Appearances ✅ IMPLEMENTED
- **Previous:** Jockeys 3, Trainers 2, Sires 1
- **Updated:** Jockeys 2, Trainers 2, Sires 1 ✅
- **Trade-off:** More connections available while maintaining quality

### Option 4: Allow Connection Reuse with Penalty
- **Current:** Hard exclusion
- **Proposed:** Allow reuse but prioritize unique connections
- **Trade-off:** More matchups, but some repetition

### Option 5: Dynamic Tolerance Based on Available Connections
- **Current:** Fixed $1000
- **Proposed:** If not enough matchups, gradually increase tolerance
- **Trade-off:** More matchups, but less consistent quality

## Next Steps ✅ COMPLETED

1. ✅ **Clean up debug logging** (DONE)
2. ✅ **Update minimum appearances** (DONE: jockeys=2, trainers=2, sires=1)
3. ✅ **Implement quality scoring system** (DONE - See MATCHUP_QUALITY_DESIGN.md)
4. ✅ **Add tier-based matching** (DONE - Tier-based matching implemented)
5. ✅ **Quality threshold filtering** (DONE - Low-quality matchups rejected)

**✅ Quality over Quantity System Implemented!**
- ✅ Quality scoring system calculates competitiveness, tier matching, appearance balance
- ✅ Tier-based matching prioritizes same-tier matchups (Elite vs Elite, Premium vs Premium)
- ✅ Quality thresholds: 50 (standard), 60 (cross-track), 70 (elite tier)
- ✅ Quality-first sorting: Highest quality matchups selected first
- ✅ Quality metrics logging: Tracks avg/min/max quality scores
- ✅ Theoretical maximum calculation: Shows max possible vs actual generated
- ✅ Better to return 8 excellent matchups than 10 mediocre ones

**See `docs/MATCHUP_QUALITY_DESIGN.md` for full implementation details**

## Key Metrics to Monitor

When diagnosing, check:
1. **Eligible connections count:** How many after all filters?
2. **Valid pairs count:** How many pairs within salary tolerance?
3. **Pairs without horse overlap:** How many after overlap check?
4. **Theoretical maximum:** `eligible / 2`
5. **Actual generated:** How many after per-type exclusion?

If `theoretical_max < requested_count`, you **cannot** generate the requested number with current constraints.

