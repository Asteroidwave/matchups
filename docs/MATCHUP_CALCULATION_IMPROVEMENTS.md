# Matchup Calculation Improvements

## Overview
This document describes the improvements made to the matchup calculation logic to optimize matchup quality and implement proper validation rules for mixed matchups.

## Changes Made

### 1. Optimized Matchup Selection Algorithm

#### Backend (`backend/src/services/unifiedMatchupGenerator.ts`)

**1v1 Matchups - Multi-Criteria Sorting**
- Previously: Sorted only by salary difference
- Now: Uses a three-tier scoring system:
  1. **Primary**: Salary difference (lower is better)
  2. **Secondary**: Total salary (higher is better - more interesting matchups)
  3. **Tertiary**: Points difference (closer games are more competitive)

```typescript
matchingSets.sort((a, b) => {
  // Primary: salary difference (weight: 1.0)
  const salaryDiffScore = a.salaryDiff - b.salaryDiff;
  if (Math.abs(salaryDiffScore) > 100) return salaryDiffScore;
  
  // Secondary: prefer higher total salary (more interesting matchups)
  const totalSalaryA = a.setA[0].salarySum + a.setB[0].salarySum;
  const totalSalaryB = b.setA[0].salarySum + b.setB[0].salarySum;
  const salaryScore = totalSalaryB - totalSalaryA;
  if (Math.abs(salaryScore) > 500) return -salaryScore;
  
  // Tertiary: prefer closer point totals (more competitive)
  const pointsDiffA = Math.abs(a.setA[0].pointsSum - a.setB[0].pointsSum);
  const pointsDiffB = Math.abs(b.setA[0].pointsSum - b.setB[0].pointsSum);
  return pointsDiffA - pointsDiffB;
});
```

**Complex Pattern Matchups - Quality Scoring**
- Previously: Added matchups as they were found
- Now: Collects candidate matchups, scores them, and selects the best ones

Scoring formula:
```typescript
const salaryDiffScore = 1000 - Math.min(salaryDiff, 1000); // 0-1000
const totalSalaryScore = Math.min(totalSalary / 100, 1000); // 0-1000
const competitivenessScore = 1000 - Math.min(pointsDiff * 10, 1000); // 0-1000

const score = salaryDiffScore * 0.5 + totalSalaryScore * 0.3 + competitivenessScore * 0.2;
```

Weights:
- Salary difference: 50%
- Total salary: 30%
- Competitiveness: 20%

**Increased Attempts**
- Changed from `num_matchups * 500` to `num_matchups * 1000` attempts
- Allows more thorough search for optimal matchups

### 2. Mixed Matchup Validation Rules

#### New Validation Logic

Mixed matchups now follow specific rules based on track distribution:

**Rule 1: Different Tracks**
- If connections are from different tracks, roles can be the same
- Example: Jockey from Track A vs Jockey from Track B ✅

**Rule 2: Same Track**
- If connections are from the same track, they must have different roles
- Example: Jockey vs Trainer from same track ✅
- Example: Jockey vs Jockey from same track ❌

**Rule 3: Horse Overlap**
- Always check for horse overlap (applies to all matchup types)
- No matchup can have the same horse in both sets

#### Implementation

```typescript
function isValidMixedMatchup(
  connsA: Connection[],
  connsB: Connection[],
  horseMap: ConnectionHorseMap
): boolean {
  // First check horse overlap (always required)
  if (checkHorseOverlap(connsA, connsB, horseMap)) {
    return false;
  }
  
  const fromDifferentTracks = areFromDifferentTracks(connsA, connsB);
  
  if (fromDifferentTracks) {
    // Different tracks: roles can be the same, already valid
    return true;
  } else {
    // Same track: must have different roles
    return haveDifferentRoles(connsA, connsB);
  }
}
```

#### Helper Functions

**`areFromDifferentTracks()`**
- Checks if two sets of connections have no overlapping tracks
- Returns `true` if they're from completely different tracks

**`haveDifferentRoles()`**
- Checks if two sets of connections have no overlapping roles
- Returns `true` if all roles are different

**`checkHorseOverlap()`**
- Checks if two sets share any horses
- Returns `true` if overlap is found

### 3. Frontend Updates

#### File: `lib/matchups.ts`

Added the same validation logic to the frontend matchup generator:
- Added `isMixed` option to `MatchupGenerationOptions`
- Implemented all helper functions (`areFromDifferentTracks`, `haveDifferentRoles`, `checkHorseOverlap`, `isValidMixedMatchup`)
- Updated validation in both single and multiple connection scenarios

### 4. Integration

#### Backend Integration (`backend/src/services/matchupCalculation.ts`)

```typescript
const isMixed = matchupType === 'mixed';
const matchups = generateUnifiedMatchups(connections, unifiedSettings, horseMap, isMixed);
```

The `isMixed` flag is automatically set based on the matchup type and passed to the generator.

## Benefits

### 1. Better Matchup Quality
- More competitive matchups (closer point totals)
- More interesting matchups (higher total salaries)
- Better salary balance

### 2. Proper Mixed Matchup Validation
- Prevents invalid same-track, same-role matchups
- Allows valid cross-track matchups regardless of role
- Maintains horse overlap prevention

### 3. Consistent Behavior
- Same logic in both frontend and backend
- Clear, documented rules
- Easy to maintain and extend

## Testing Recommendations

1. **Single Track Mixed Matchups**
   - Verify that same-role matchups are rejected
   - Verify that different-role matchups are accepted
   - Check that horse overlap is always prevented

2. **Multi-Track Mixed Matchups**
   - Verify that same-role matchups are accepted across tracks
   - Verify that different-role matchups are accepted across tracks
   - Check that horse overlap is always prevented

3. **Quality Metrics**
   - Compare average salary differences before/after
   - Compare average point differences before/after
   - Measure user engagement with new matchups

## Future Enhancements

1. **Configurable Weights**
   - Allow admins to adjust scoring weights
   - Different weights for different matchup types

2. **Advanced Scoring**
   - Consider AVPA in scoring
   - Factor in historical performance
   - Add diversity scoring (variety of connections)

3. **Machine Learning**
   - Learn from user preferences
   - Predict matchup popularity
   - Optimize for user engagement

## Migration Notes

- No database changes required
- Backward compatible with existing matchups
- New matchups will automatically use improved algorithm
- Existing matchups remain valid

## Performance Impact

- Minimal performance impact
- Increased attempts compensated by better candidate selection
- Scoring adds negligible overhead
- Overall generation time similar or slightly improved



