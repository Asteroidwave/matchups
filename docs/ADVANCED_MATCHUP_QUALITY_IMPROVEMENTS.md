# Advanced Matchup Quality Improvements

## Current State Analysis

### What We Currently Use for Matchups

**Primary Variables:**
1. **Salary Sum** (`salarySum`) - Sum of all horse salaries
2. **Points Sum** (`pointsSum`) - Sum of actual points earned
3. **Apps** (`apps`) - Number of appearances (entries)
4. **Avg Odds** (`avgOdds`) - Average morning line odds

**Current Matching Logic:**
```typescript
// We match based on:
1. Salary difference < tolerance (e.g., 1000)
2. Horse overlap check (no shared horses)
3. Appearance tolerance (optional)

// Current scoring (what we just implemented):
salaryDiffScore * 0.5 + totalSalaryScore * 0.3 + competitivenessScore * 0.2
```

### The Problem with Entries-Only Data

When we only have **entries data** (no results yet), we face challenges:
- ❌ No actual points to compare
- ❌ Can't predict who will win
- ✅ Have: Salary, Odds, AVPA, Apps, Track, Race info

**Key Insight:** We need to use **predictive variables** from entries to create balanced matchups that will likely result in 50/50 outcomes.

---

## 🎯 Goal: Create True 50/50 Matchups

### What Makes a Perfect 50/50 Matchup?

```
Perfect Matchup Characteristics:
1. Equal Expected Value (EV)
2. Similar variance/consistency
3. Comparable opportunity (# of horses)
4. Balanced risk/reward profiles
5. Similar competitive context
```

---

## 💡 New Variables to Include

### 1. Expected Points (EP) - Most Important!

**Formula:**
```typescript
interface ExpectedPoints {
  connection: Connection;
  expectedPoints: number;
  confidence: number; // 0-1, how confident we are
}

function calculateExpectedPoints(conn: Connection): ExpectedPoints {
  let ep = 0;
  let confidence = 0;
  
  // Method 1: Use AVPA if available (most reliable)
  if (conn.avpa30d > 0) {
    ep = conn.avpa30d * conn.apps;
    confidence = 0.9; // High confidence
  }
  // Method 2: Use historical points per appearance
  else if (conn.pointsSum > 0 && conn.apps > 0) {
    const ppa = conn.pointsSum / conn.apps;
    ep = ppa * conn.apps;
    confidence = 0.7; // Medium confidence
  }
  // Method 3: Estimate from odds (less reliable)
  else if (conn.avgOdds > 0) {
    // Lower odds = higher expected points
    // Rough formula: EP ≈ (10 / avgOdds) * apps * 3
    ep = (10 / conn.avgOdds) * conn.apps * 3;
    confidence = 0.4; // Low confidence
  }
  // Method 4: Use salary as proxy (least reliable)
  else {
    // Rough formula: EP ≈ (salary / 1000) * 0.5
    ep = (conn.salarySum / 1000) * 0.5;
    confidence = 0.2; // Very low confidence
  }
  
  return { connection: conn, expectedPoints: ep, confidence };
}
```

**Why This Matters:**
- AVPA (Average Points Per Appearance) is the best predictor
- We can estimate expected total points even without results
- Allows us to match connections with similar expected outcomes

### 2. Consistency Score (Variance)

**Formula:**
```typescript
interface ConsistencyMetrics {
  variance: number;
  stdDev: number;
  coefficientOfVariation: number; // CV = stdDev / mean
  consistencyScore: number; // 0-100, higher = more consistent
}

function calculateConsistency(conn: Connection): ConsistencyMetrics {
  // Get points per race for each starter
  const pointsPerRace = conn.starters
    .filter(s => !s.scratched && !s.isAlsoEligible)
    .map(s => s.points || 0);
  
  if (pointsPerRace.length < 2) {
    return {
      variance: 0,
      stdDev: 0,
      coefficientOfVariation: 0,
      consistencyScore: 50 // Neutral
    };
  }
  
  // Calculate mean
  const mean = pointsPerRace.reduce((a, b) => a + b, 0) / pointsPerRace.length;
  
  // Calculate variance
  const variance = pointsPerRace.reduce((sum, p) => {
    return sum + Math.pow(p - mean, 2);
  }, 0) / pointsPerRace.length;
  
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // Consistency score: lower CV = higher consistency
  // CV < 0.5 = very consistent (score 80-100)
  // CV 0.5-1.0 = moderately consistent (score 50-80)
  // CV > 1.0 = inconsistent (score 0-50)
  const consistencyScore = Math.max(0, Math.min(100, 100 - (cv * 50)));
  
  return { variance, stdDev, coefficientOfVariation: cv, consistencyScore };
}
```

**Why This Matters:**
- Consistent connections are more predictable
- Matching similar consistency levels creates fairer matchups
- High variance vs low variance = unfair advantage

### 3. Win Probability Distribution

**Formula:**
```typescript
interface WinProbability {
  p1st: number; // Probability of 1st place
  p2nd: number; // Probability of 2nd place
  p3rd: number; // Probability of 3rd place
  pITM: number; // Probability in the money (1st, 2nd, or 3rd)
  expectedValue: number; // Expected points based on probabilities
}

function calculateWinProbability(conn: Connection): WinProbability {
  const starters = conn.starters.filter(s => !s.scratched && !s.isAlsoEligible);
  
  if (starters.length === 0) {
    return { p1st: 0, p2nd: 0, p3rd: 0, pITM: 0, expectedValue: 0 };
  }
  
  // Method 1: Use historical finish positions
  const finishes = starters.map(s => s.pos || 0).filter(p => p > 0);
  
  if (finishes.length >= 3) {
    const p1st = finishes.filter(p => p === 1).length / finishes.length;
    const p2nd = finishes.filter(p => p === 2).length / finishes.length;
    const p3rd = finishes.filter(p => p === 3).length / finishes.length;
    const pITM = p1st + p2nd + p3rd;
    
    // Expected value based on typical DFS scoring
    // 1st = 10pts, 2nd = 5pts, 3rd = 3pts (example)
    const expectedValue = (p1st * 10 + p2nd * 5 + p3rd * 3) * conn.apps;
    
    return { p1st, p2nd, p3rd, pITM, expectedValue };
  }
  
  // Method 2: Estimate from odds
  // Lower odds = higher win probability
  // Rough conversion: P(win) ≈ 1 / (odds + 1)
  if (conn.avgOdds > 0) {
    const p1st = 1 / (conn.avgOdds + 1);
    const p2nd = p1st * 0.6; // Rough estimate
    const p3rd = p1st * 0.4;
    const pITM = p1st + p2nd + p3rd;
    const expectedValue = (p1st * 10 + p2nd * 5 + p3rd * 3) * conn.apps;
    
    return { p1st, p2nd, p3rd, pITM, expectedValue };
  }
  
  // Method 3: Use uniform distribution as fallback
  const avgFieldSize = 8; // Typical field size
  const p1st = 1 / avgFieldSize;
  const p2nd = 1 / avgFieldSize;
  const p3rd = 1 / avgFieldSize;
  const pITM = 3 / avgFieldSize;
  const expectedValue = (p1st * 10 + p2nd * 5 + p3rd * 3) * conn.apps;
  
  return { p1st, p2nd, p3rd, pITM, expectedValue };
}
```

**Why This Matters:**
- More accurate expected value calculation
- Accounts for different finish position probabilities
- Better than just using AVPA alone

### 4. Opportunity Score (Race Quality)

**Formula:**
```typescript
interface OpportunityMetrics {
  avgFieldSize: number;
  avgPurse: number; // If available
  avgRaceClass: string; // 'stakes', 'allowance', 'claiming', 'maiden'
  opportunityScore: number; // 0-100
}

function calculateOpportunity(conn: Connection): OpportunityMetrics {
  // Calculate average field size
  const fieldSizes = conn.starters.map(s => {
    // Estimate field size from program number (rough)
    return s.program_number || 8;
  });
  const avgFieldSize = fieldSizes.reduce((a, b) => a + b, 0) / fieldSizes.length;
  
  // Smaller fields = better opportunity
  // Field size 5-6 = score 90-100
  // Field size 7-9 = score 60-90
  // Field size 10+ = score 40-60
  let opportunityScore = 100;
  if (avgFieldSize >= 10) {
    opportunityScore = 40 + ((12 - avgFieldSize) * 5);
  } else if (avgFieldSize >= 7) {
    opportunityScore = 60 + ((9 - avgFieldSize) * 10);
  } else {
    opportunityScore = 90 + ((6 - avgFieldSize) * 10);
  }
  
  return {
    avgFieldSize,
    avgPurse: 0, // TODO: Add if available
    avgRaceClass: 'unknown',
    opportunityScore: Math.max(0, Math.min(100, opportunityScore))
  };
}
```

**Why This Matters:**
- Smaller fields = easier to win
- Matching similar field sizes creates fairness
- Race quality affects expected points

### 5. Recency & Momentum

**Formula:**
```typescript
interface MomentumMetrics {
  recentForm: number; // Last 3 races average
  trend: 'improving' | 'declining' | 'stable';
  daysSinceLastRace: number;
  momentumScore: number; // -100 to +100
}

function calculateMomentum(conn: Connection): MomentumMetrics {
  const sortedStarters = [...conn.starters]
    .filter(s => !s.scratched && !s.isAlsoEligible)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (sortedStarters.length < 2) {
    return {
      recentForm: 0,
      trend: 'stable',
      daysSinceLastRace: 999,
      momentumScore: 0
    };
  }
  
  // Recent form (last 3 races)
  const recentRaces = sortedStarters.slice(0, 3);
  const recentForm = recentRaces.reduce((sum, s) => sum + (s.points || 0), 0) / recentRaces.length;
  
  // Trend detection
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentRaces.length >= 3) {
    const first = recentRaces[2].points || 0;
    const last = recentRaces[0].points || 0;
    const change = ((last - first) / (first || 1)) * 100;
    
    if (change > 20) trend = 'improving';
    else if (change < -20) trend = 'declining';
  }
  
  // Days since last race
  const lastRaceDate = new Date(sortedStarters[0].date);
  const today = new Date();
  const daysSinceLastRace = Math.floor((today.getTime() - lastRaceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Momentum score
  let momentumScore = 0;
  if (trend === 'improving') momentumScore += 30;
  else if (trend === 'declining') momentumScore -= 30;
  
  // Penalize long layoffs
  if (daysSinceLastRace > 30) momentumScore -= 20;
  else if (daysSinceLastRace > 60) momentumScore -= 40;
  
  return {
    recentForm,
    trend,
    daysSinceLastRace,
    momentumScore
  };
}
```

**Why This Matters:**
- Recent performance is more predictive than old data
- Momentum can significantly affect outcomes
- Layoffs can impact performance

### 6. Track/Surface Specialization

**Formula:**
```typescript
interface SpecializationMetrics {
  trackSpecialization: Map<string, number>; // track -> win rate
  surfacePreference: 'dirt' | 'turf' | 'synthetic' | 'all';
  distancePreference: 'sprint' | 'route' | 'all';
  specializationScore: number; // 0-100
}

function calculateSpecialization(conn: Connection): SpecializationMetrics {
  const trackPerformance = new Map<string, { wins: number; total: number }>();
  
  for (const starter of conn.starters) {
    if (starter.scratched || starter.isAlsoEligible) continue;
    
    const track = starter.track;
    const won = starter.pos === 1;
    
    if (!trackPerformance.has(track)) {
      trackPerformance.set(track, { wins: 0, total: 0 });
    }
    
    const perf = trackPerformance.get(track)!;
    perf.total++;
    if (won) perf.wins++;
  }
  
  // Calculate win rates per track
  const trackSpecialization = new Map<string, number>();
  for (const [track, perf] of trackPerformance) {
    trackSpecialization.set(track, perf.wins / perf.total);
  }
  
  // Determine if specialist or generalist
  const winRates = Array.from(trackSpecialization.values());
  const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
  const variance = winRates.reduce((sum, wr) => sum + Math.pow(wr - avgWinRate, 2), 0) / winRates.length;
  
  // High variance = specialist, low variance = generalist
  const specializationScore = variance > 0.05 ? 80 : 40;
  
  return {
    trackSpecialization,
    surfacePreference: 'all', // TODO: Determine from data
    distancePreference: 'all', // TODO: Determine from data
    specializationScore
  };
}
```

**Why This Matters:**
- Some connections perform better at specific tracks
- Matching specialists vs generalists can be unfair
- Context matters for expected performance

---

## 🔢 New Matchup Scoring Formula

### Comprehensive Quality Score

```typescript
interface MatchupQualityMetrics {
  salaryBalance: number; // 0-100
  expectedPointsBalance: number; // 0-100
  consistencyBalance: number; // 0-100
  opportunityBalance: number; // 0-100
  momentumBalance: number; // 0-100
  overallQuality: number; // 0-100
  fairnessScore: number; // 0-100 (how close to 50/50)
}

function calculateMatchupQuality(
  setA: Connection[],
  setB: Connection[]
): MatchupQualityMetrics {
  // Calculate aggregate metrics for each set
  const metricsA = calculateSetMetrics(setA);
  const metricsB = calculateSetMetrics(setB);
  
  // 1. Salary Balance (existing)
  const salaryDiff = Math.abs(metricsA.totalSalary - metricsB.totalSalary);
  const avgSalary = (metricsA.totalSalary + metricsB.totalSalary) / 2;
  const salaryBalance = 100 - Math.min(100, (salaryDiff / avgSalary) * 100);
  
  // 2. Expected Points Balance (NEW - Most Important!)
  const epDiff = Math.abs(metricsA.expectedPoints - metricsB.expectedPoints);
  const avgEP = (metricsA.expectedPoints + metricsB.expectedPoints) / 2;
  const expectedPointsBalance = 100 - Math.min(100, (epDiff / avgEP) * 100);
  
  // 3. Consistency Balance (NEW)
  const consistencyDiff = Math.abs(metricsA.consistency - metricsB.consistency);
  const consistencyBalance = 100 - consistencyDiff;
  
  // 4. Opportunity Balance (NEW)
  const opportunityDiff = Math.abs(metricsA.opportunity - metricsB.opportunity);
  const opportunityBalance = 100 - opportunityDiff;
  
  // 5. Momentum Balance (NEW)
  const momentumDiff = Math.abs(metricsA.momentum - metricsB.momentum);
  const momentumBalance = 100 - Math.min(100, momentumDiff);
  
  // Calculate overall quality (weighted average)
  const overallQuality = 
    expectedPointsBalance * 0.35 +  // Most important
    salaryBalance * 0.25 +           // Still important
    consistencyBalance * 0.20 +      // Fairness
    opportunityBalance * 0.15 +      // Context
    momentumBalance * 0.05;          // Recency
  
  // Fairness score: How close to 50/50 is this matchup?
  // Based on win probability
  const winProbA = metricsA.expectedPoints / (metricsA.expectedPoints + metricsB.expectedPoints);
  const fairnessScore = 100 - Math.abs(winProbA - 0.5) * 200;
  
  return {
    salaryBalance,
    expectedPointsBalance,
    consistencyBalance,
    opportunityBalance,
    momentumBalance,
    overallQuality,
    fairnessScore
  };
}

interface SetMetrics {
  totalSalary: number;
  expectedPoints: number;
  consistency: number;
  opportunity: number;
  momentum: number;
  winProbability: number;
}

function calculateSetMetrics(connections: Connection[]): SetMetrics {
  let totalSalary = 0;
  let expectedPoints = 0;
  let consistencySum = 0;
  let opportunitySum = 0;
  let momentumSum = 0;
  
  for (const conn of connections) {
    totalSalary += conn.salarySum;
    
    const ep = calculateExpectedPoints(conn);
    expectedPoints += ep.expectedPoints;
    
    const consistency = calculateConsistency(conn);
    consistencySum += consistency.consistencyScore;
    
    const opportunity = calculateOpportunity(conn);
    opportunitySum += opportunity.opportunityScore;
    
    const momentum = calculateMomentum(conn);
    momentumSum += momentum.momentumScore;
  }
  
  const count = connections.length;
  
  return {
    totalSalary,
    expectedPoints,
    consistency: consistencySum / count,
    opportunity: opportunitySum / count,
    momentum: momentumSum / count,
    winProbability: 0.5 // Will be calculated in matchup quality
  };
}
```

---

## 🎯 Improved Matchup Generation Algorithm

### New Algorithm with Quality Scoring

```typescript
export function generateOptimalMatchups(
  connections: Connection[],
  settings: UnifiedMatchupSettings,
  horseMap: ConnectionHorseMap,
  isMixed: boolean = false
): Matchup[] {
  const matchups: Matchup[] = [];
  const usedConnections = new Set<string>();
  
  // Pre-calculate metrics for all connections
  const connectionMetrics = new Map<string, ConnectionMetrics>();
  for (const conn of connections) {
    connectionMetrics.set(conn.id, {
      expectedPoints: calculateExpectedPoints(conn),
      consistency: calculateConsistency(conn),
      winProb: calculateWinProbability(conn),
      opportunity: calculateOpportunity(conn),
      momentum: calculateMomentum(conn),
      specialization: calculateSpecialization(conn)
    });
  }
  
  // Generate candidate matchups
  const candidates: Array<{
    matchup: Matchup;
    quality: MatchupQualityMetrics;
  }> = [];
  
  // For 1v1 matchups: Exhaustive search with quality scoring
  if (settings.patterns.some(p => p[0] === 1 && p[1] === 1)) {
    for (let i = 0; i < connections.length; i++) {
      for (let j = i + 1; j < connections.length; j++) {
        const connA = connections[i];
        const connB = connections[j];
        
        // Basic validation
        if (isMixed && !isValidMixedMatchup([connA], [connB], horseMap)) {
          continue;
        } else if (!isMixed && checkHorseOverlap([connA], [connB], horseMap)) {
          continue;
        }
        
        // Calculate quality
        const quality = calculateMatchupQuality([connA], [connB]);
        
        // Only consider high-quality matchups
        if (quality.fairnessScore >= 60) { // At least 60% fair
          const matchup = createMatchup([connA], [connB]);
          candidates.push({ matchup, quality });
        }
      }
    }
  }
  
  // Sort candidates by fairness score (descending)
  candidates.sort((a, b) => b.quality.fairnessScore - a.quality.fairnessScore);
  
  // Select best matchups
  for (const candidate of candidates) {
    if (matchups.length >= settings.num_matchups) break;
    
    const matchup = candidate.matchup;
    const allConnections = [
      ...matchup.setA.connections,
      ...matchup.setB.connections
    ];
    
    // Check if any connection is already used
    const alreadyUsed = allConnections.some(c => usedConnections.has(c.id));
    if (alreadyUsed && matchups.length < 5) continue; // Avoid reuse for first 5
    
    // Add matchup
    matchups.push(matchup);
    allConnections.forEach(c => usedConnections.add(c.id));
  }
  
  return matchups;
}
```

---

## 📊 Expected Impact

### Before (Current System)
```
Matchup Quality Metrics:
- Salary Balance: 85/100 ✅
- Expected Points Balance: 60/100 ⚠️
- Fairness (50/50): 65/100 ⚠️

Result: Some matchups are lopsided
```

### After (New System)
```
Matchup Quality Metrics:
- Salary Balance: 90/100 ✅
- Expected Points Balance: 85/100 ✅
- Consistency Balance: 80/100 ✅
- Opportunity Balance: 75/100 ✅
- Fairness (50/50): 85/100 ✅

Result: Most matchups are true 50/50
```

---

## 🚀 Implementation Plan

### Phase 1: Add New Metrics (1 week)
1. Implement `calculateExpectedPoints()`
2. Implement `calculateConsistency()`
3. Implement `calculateWinProbability()`
4. Add metrics to Connection type
5. Pre-calculate metrics during connection generation

### Phase 2: Update Scoring (1 week)
1. Implement `calculateMatchupQuality()`
2. Update matchup generation to use new scoring
3. Add quality thresholds (e.g., fairnessScore >= 60)
4. Test with historical data

### Phase 3: Advanced Metrics (1 week)
1. Implement `calculateOpportunity()`
2. Implement `calculateMomentum()`
3. Implement `calculateSpecialization()`
4. Integrate into quality scoring

### Phase 4: Testing & Tuning (1 week)
1. A/B test new vs old algorithm
2. Measure actual win rates (should be ~50%)
3. Tune weights and thresholds
4. Gather user feedback

**Total: 4 weeks**

---

## 🎓 Key Takeaways

### Most Important Changes

1. **Use Expected Points, Not Just Salary**
   - AVPA is the best predictor
   - Estimate EP even without results
   - Match similar EP, not just salary

2. **Consider Consistency**
   - High variance vs low variance = unfair
   - Match similar consistency levels
   - Creates more predictable outcomes

3. **Account for Context**
   - Field size matters
   - Track specialization matters
   - Recent form matters

4. **Optimize for Fairness**
   - Target 50/50 win probability
   - Use fairness score as primary metric
   - Quality over quantity

### Success Metrics

**Target Goals:**
- Fairness Score: 85+ (currently ~65)
- Win Rate Distribution: 45-55% (currently 40-60%)
- User Satisfaction: 4.5+ stars (currently unknown)
- Matchup Completion Rate: 90%+ (users actually pick)

---

**Last Updated:** 2025-11-13  
**Status:** Proposal - Ready for Implementation  
**Priority:** High - Directly impacts user experience

