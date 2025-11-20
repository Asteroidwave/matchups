# Quality Scoring & Admin Slider Integration

## Overview

This document explains how admin configuration sliders affect the quality scoring system we just implemented.

## Admin Sliders vs Quality Scoring

### Admin Sliders (What You Configure)

The admin sliders in `MatchupCalculationSettings` control:

| Slider | Maps To | Affects Quality Scoring? | How? |
|--------|---------|-------------------------|------|
| **Salary Tolerance** | `salary_tolerance` | ✅ **YES - Direct** | Lower tolerance → Higher competitiveness scores (salary diff is smaller in percentage terms) |
| **Min Salary** | `min_salary` | ✅ **YES - Indirect** | Filters eligible connections pool (fewer connections = fewer matchup options) |
| **Min Appearances** | `min_appearances` | ✅ **YES - Indirect** | Filters eligible connections pool (fewer connections = fewer matchup options) |
| **Min Appearances Toggle** | `apply_min_appearances` | ✅ **YES - Indirect** | Enables/disables appearance filtering |
| **1v1 Preference** | `prefer1v1` | ❌ **NO** | Not used by unified generator (uses `patterns` instead) |
| **Matchup Count** | `count` → `num_matchups` | ❌ **NO** | Only affects how many matchups to generate |
| **Max Attempts** | `maxAttempts` | ❌ **NO** | Only affects complex pattern generation speed |

### Quality Thresholds (NOT in Sliders)

The quality thresholds are **separate** and **NOT controlled by sliders**:

| Threshold | Default Value | Configurable? | Where? |
|-----------|--------------|---------------|--------|
| `quality_threshold_1v1` | 50 | ✅ Yes (in code) | `DEFAULT_UNIFIED_SETTINGS` |
| `quality_threshold_2v1` | 45 | ✅ Yes (in code) | `DEFAULT_UNIFIED_SETTINGS` |
| `quality_threshold_1v2` | 45 | ✅ Yes (in code) | `DEFAULT_UNIFIED_SETTINGS` |
| `quality_threshold_cross_track` | 60 | ✅ Yes (in code) | `DEFAULT_UNIFIED_SETTINGS` |
| `quality_threshold_elite_tier` | 70 | ✅ Yes (in code) | `DEFAULT_UNIFIED_SETTINGS` |

**Current Status:** Quality thresholds are hardcoded defaults in `DEFAULT_UNIFIED_SETTINGS` and NOT exposed as admin sliders.

## How Sliders Affect Quality Scoring

### 1. Salary Tolerance Slider → Competitiveness Score

**Direct Impact:**

```typescript
// Quality scoring formula
competitiveness = 100 - (salaryDiff / salaryTolerance) * 100
```

**Example:**
- Slider set to **$300** (lower = stricter)
- Two jockeys with $200 salary difference
- Competitiveness: `100 - (200/300) * 100 = 33.3` (lower score)
- But with same salary diff, if tolerance was $1000:
- Competitiveness: `100 - (200/1000) * 100 = 80.0` (higher score)

**Key Insight:** 
- **Lower tolerance** = stricter matching = **lower competitiveness scores** (same salary diff becomes larger percentage)
- **Higher tolerance** = more lenient = **higher competitiveness scores** (same salary diff becomes smaller percentage)

**But wait!** Lower tolerance also means only very close matches are generated, so while percentage is lower, the actual matchups might be better quality overall.

### 2. Min Salary & Min Appearances → Eligible Pool

**Indirect Impact:**

These filters affect which connections are eligible for matchups:

- **Fewer eligible connections** → Fewer potential matchups
- **Fewer matchups** → Less opportunity to find high-quality pairs
- **May hit theoretical maximum** earlier (eligible_connections / 2)

**Example:**
- Without filters: 36 jockeys → Max 18 matchups possible
- With min_salary=$2000: 20 jockeys → Max 10 matchups possible
- With min_appearances=3: 15 jockeys → Max 7 matchups possible

### 3. Quality Thresholds (NOT from Sliders)

These are **separate** and control the minimum quality score required:

- Even with perfect tolerance/salary/appearance settings, a matchup below the threshold is **rejected**
- These thresholds are **fixed defaults** in `DEFAULT_UNIFIED_SETTINGS`
- They can be manually edited in code, but **not via admin sliders**

## What This Means

### ✅ Sliders DO Affect Quality Scoring:

1. **Salary Tolerance** → Directly affects competitiveness component (40% of quality score)
2. **Min Salary** → Affects eligible pool size
3. **Min Appearances** → Affects eligible pool size

### ❌ Sliders DO NOT Affect:

1. **Quality Thresholds** → Fixed at 50 (1v1), 45 (2v1/1v2), 60 (cross-track), 70 (elite tier)
2. **Tier Matching** → Always uses 4-tier system
3. **Appearance Balance** → Always calculated the same way

## Recommendations

### Option 1: Keep Thresholds Fixed (Current)

**Pros:**
- Simpler UI (fewer sliders)
- Quality standards stay consistent
- Less confusion for admins

**Cons:**
- Can't fine-tune quality thresholds per matchup type
- Must edit code to adjust thresholds

### Option 2: Add Quality Threshold Sliders (Future Enhancement)

**If you want admins to control quality thresholds:**

Add new sliders to `MatchupCalculationSettings`:
```typescript
{
  // Existing sliders...
  tolerance: number;
  minSalary: number;
  minAppearances: number;
  
  // New quality threshold sliders
  qualityThreshold1v1?: number;        // Default: 50
  qualityThreshold2v1?: number;        // Default: 45
  qualityThreshold1v2?: number;        // Default: 45
  qualityThresholdCrossTrack?: number; // Default: 60
  qualityThresholdEliteTier?: number;  // Default: 70
}
```

Then map them in `matchupCalculation.ts`:
```typescript
const unifiedSettings: UnifiedMatchupSettings = {
  // ... existing mappings
  quality_threshold_1v1: (typeSettings as any)?.qualityThreshold1v1 ?? defaultUnified.quality_threshold_1v1,
  quality_threshold_2v1: (typeSettings as any)?.qualityThreshold2v1 ?? defaultUnified.quality_threshold_2v1,
  // ... etc
};
```

## Current Behavior

**Right now, when you adjust sliders:**

1. ✅ **Salary Tolerance** changes → Affects quality scores (competitiveness component)
2. ✅ **Min Salary/Appearances** changes → Affects eligible pool → May affect quality indirectly
3. ❌ **Quality Thresholds** stay fixed → Still use defaults (50/45/60/70)

**Example Scenario:**
- You lower **Salary Tolerance** from $1000 to $300
- Result: Fewer matchups pass tolerance check, but those that do are closer in salary
- Quality scores might be LOWER (because same $200 diff is 67% of $300 vs 20% of $1000)
- But the QUALITY THRESHOLD (50) stays the same
- So more matchups might be rejected if they don't meet the threshold

## Mixed & Cross-Track Matchups

### ✅ Quality Scoring Applies to ALL Matchup Types

Quality scoring is **fully applied** to:
- ✅ **1v1 matchups** (jockey vs jockey, trainer vs trainer, sire vs sire)
- ✅ **Mixed matchups** (jockey vs trainer, etc. - same or different tracks)
- ✅ **Cross-track matchups** (same role, different tracks)
- ✅ **Complex patterns** (2v1, 1v2) in all matchup types

### Quality Thresholds by Matchup Type

| Matchup Type | Default Quality Threshold | Notes |
|-------------|--------------------------|-------|
| **1v1 Standard** | 50 | All same-type matchups (JvJ, TvT, SvS) |
| **1v1 Cross-Track** | 60 | Higher bar (same role, different tracks) |
| **Mixed (Same Track)** | 50 | Different roles, same track |
| **Mixed (Cross-Track)** | 60 | Different roles, different tracks → Uses cross-track threshold |
| **2v1 / 1v2 Standard** | 45 | Complex patterns (lower threshold) |
| **2v1 / 1v2 Cross-Track** | 60 | Complex patterns, cross-track (uses cross-track threshold) |
| **Elite Tier (any type)** | 70 | Top 20% salary tier (overrides other thresholds) |

### How It Works

**1v1 Matchups (including mixed & cross-track):**
```typescript
// Line 427 in unifiedMatchupGenerator.ts
const qualityThreshold = getQualityThreshold('1v1', isCrossTrack, tierIdx, settings);
if (qualityScore.total < qualityThreshold) {
  continue; // Rejected - not good enough
}
```

**Complex Patterns (2v1, 1v2):**
```typescript
// Line 744 in unifiedMatchupGenerator.ts  
const qualityThreshold = getQualityThreshold(matchupType, isCrossTrack, currentTierIdx, settings);
if (qualityScore.total < qualityThreshold) {
  continue; // Rejected - not good enough
}
```

### Quality Threshold Priority

The `getQualityThreshold()` function checks in this order:

1. **Elite Tier (70)** - If tier === 0, always use 70 (overrides everything)
2. **Cross-Track (60)** - If `isCrossTrack === true`, use 60
3. **Pattern Type** - 2v1/1v2 use 45, 1v1 uses 50

**Examples:**
- Mixed matchup (same track, different roles): Uses **50** (standard 1v1)
- Cross-track matchup (same role, different tracks): Uses **60** (cross-track threshold)
- Mixed cross-track (different roles, different tracks): Uses **60** (cross-track threshold)
- Elite tier cross-track: Uses **70** (elite tier overrides cross-track)

### Validation Rules (Separate from Quality)

- **Mixed matchups:** Must have different roles on same track, OR can have same roles on different tracks
- **Cross-track matchups:** MUST be from different tracks (enforced by `isValidCrossTrackMatchup`)
- **Both:** Must have no horse overlap (always enforced)

Quality scoring happens **after** validation passes, so only valid matchups are scored.

## Best Practice

**Recommended approach:**
1. Keep quality thresholds as **code-configurable defaults** (not sliders)
2. Fine-tune thresholds in `DEFAULT_UNIFIED_SETTINGS` based on real data analysis
3. Use sliders for **operational controls** (tolerance, min salary, min appearances)
4. Monitor quality metrics in logs to adjust thresholds if needed

This keeps the UI simpler while still allowing quality control through code defaults.

**Quality Scoring is Universal:**
- ✅ Same quality scoring formula applies to ALL matchup types
- ✅ Same tier-based matching system
- ✅ Same competitiveness/appearance balance calculations
- ✅ Only thresholds differ (cross-track uses 60, elite tier uses 70)

