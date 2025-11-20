# Matchup Quality Implementation Guide

## Quick Start: Immediate Improvements (1-2 Days)

These changes can be implemented quickly and will have immediate impact on matchup quality.

---

## Step 1: Add Expected Points Calculation

### Update Connection Type

```typescript
// backend/src/types/backend.ts
export interface Connection {
  // ... existing fields
  
  // NEW: Add these fields
  expectedPoints?: number;      // Predicted total points
  expectedPointsConfidence?: number; // 0-1, confidence in prediction
  pointsPerApp?: number;        // Average points per appearance
  winRate?: number;             // Historical win rate (0-1)
}
```

### Implement Expected Points Function

```typescript
// backend/src/services/matchupCalculation.ts

/**
 * Calculate expected points for a connection
 * Uses AVPA if available, falls back to historical data or odds
 */
function calculateExpectedPoints(conn: Connection): {
  expectedPoints: number;
  confidence: number;
} {
  // Method 1: Use AVPA (best)
  if (conn.avpa30d && conn.avpa30d > 0) {
    return {
      expectedPoints: conn.avpa30d * conn.apps,
      confidence: 0.9
    };
  }
  
  // Method 2: Use historical points per appearance
  if (conn.pointsSum > 0 && conn.apps > 0) {
    const ppa = conn.pointsSum / conn.apps;
    return {
      expectedPoints: ppa * conn.apps,
      confidence: 0.7
    };
  }
  
  // Method 3: Estimate from odds
  if (conn.avgOdds > 0) {
    // Formula: Lower odds = higher expected points
    // EP ≈ (base_points / odds) * apps
    // base_points = 10 (typical for a win)
    const ep = (10 / conn.avgOdds) * conn.apps * 0.3;
    return {
      expectedPoints: ep,
      confidence: 0.4
    };
  }
  
  // Method 4: Use salary as proxy (worst)
  return {
    expectedPoints: (conn.salarySum / 1000) * 0.5,
    confidence: 0.2
  };
}

// Add this to generateConnections() function
// After loading AVPA:
const ep = calculateExpectedPoints(conn);
conn.expectedPoints = ep.expectedPoints;
conn.expectedPointsConfidence = ep.confidence;
conn.pointsPerApp = conn.apps > 0 ? conn.pointsSum / conn.apps : 0;
```

---

## Step 2: Update Matchup Quality Scoring

### Replace Current Scoring

```typescript
// backend/src/services/unifiedMatchupGenerator.ts

// OLD (current):
const salaryDiffScore = 1000 - Math.min(salaryDiff, 1000);
const totalSalaryScore = Math.min(totalSalary / 100, 1000);
const competitivenessScore = 1000 - Math.min(pointsDiff * 10, 1000);
const score = salaryDiffScore * 0.5 + totalSalaryScore * 0.3 + competitivenessScore * 0.2;

// NEW (improved):
function calculateMatchupScore(setA: Connection[], setB: Connection[]): number {
  // 1. Calculate expected points for each set
  const epA = setA.reduce((sum, c) => sum + (c.expectedPoints || 0), 0);
  const epB = setB.reduce((sum, c) => sum + (c.expectedPoints || 0), 0);
  
  // 2. Calculate salary totals
  const salaryA = setA.reduce((sum, c) => sum + c.salarySum, 0);
  const salaryB = setB.reduce((sum, c) => sum + c.salarySum, 0);
  
  // 3. Expected Points Balance (0-100) - MOST IMPORTANT
  const epDiff = Math.abs(epA - epB);
  const avgEP = (epA + epB) / 2;
  const epBalance = avgEP > 0 ? 100 - Math.min(100, (epDiff / avgEP) * 100) : 50;
  
  // 4. Salary Balance (0-100)
  const salaryDiff = Math.abs(salaryA - salaryB);
  const avgSalary = (salaryA + salaryB) / 2;
  const salaryBalance = avgSalary > 0 ? 100 - Math.min(100, (salaryDiff / avgSalary) * 100) : 50;
  
  // 5. Total Value (prefer higher total EP - more interesting)
  const totalEP = epA + epB;
  const totalValue = Math.min(100, (totalEP / 50) * 100); // Normalize to 0-100
  
  // 6. Confidence Score (higher confidence = better)
  const avgConfidence = setA.concat(setB).reduce((sum, c) => 
    sum + (c.expectedPointsConfidence || 0.5), 0
  ) / (setA.length + setB.length);
  const confidenceScore = avgConfidence * 100;
  
  // Weighted score
  const score = 
    epBalance * 0.45 +        // Expected points balance (most important)
    salaryBalance * 0.25 +    // Salary balance
    totalValue * 0.20 +       // Total value (interest level)
    confidenceScore * 0.10;   // Confidence in prediction
  
  return score;
}
```

### Update Matchup Generation

```typescript
// In generateUnifiedMatchups(), replace the scoring section:

// For 1v1 matchups:
matchingSets.sort((a, b) => {
  const scoreA = calculateMatchupScore(a.setA, a.setB);
  const scoreB = calculateMatchupScore(b.setA, b.setB);
  return scoreB - scoreA; // Higher score = better matchup
});

// For complex patterns:
const score = calculateMatchupScore(setA, setB);
candidateMatchups.push({ matchup, score, salaryDiff });

// Later, sort by score:
candidateMatchups.sort((a, b) => b.score - a.score);
```

---

## Step 3: Add Minimum Quality Threshold

### Filter Low-Quality Matchups

```typescript
// backend/src/services/unifiedMatchupGenerator.ts

// Add to settings:
export interface UnifiedMatchupSettings {
  // ... existing fields
  min_quality_score?: number; // NEW: Minimum quality score (0-100)
}

// Update defaults:
export const DEFAULT_UNIFIED_SETTINGS: Record<string, UnifiedMatchupSettings> = {
  jockey_vs_jockey: {
    // ... existing settings
    min_quality_score: 70, // Only accept matchups with score >= 70
  },
  // ... other types
};

// In matchup generation:
const score = calculateMatchupScore(setA, setB);

// Only add if meets minimum quality
if (score >= (settings.min_quality_score || 0)) {
  candidateMatchups.push({ matchup, score, salaryDiff });
}
```

---

## Step 4: Add Consistency Scoring (Optional, +1 Day)

### Calculate Variance

```typescript
// backend/src/services/matchupCalculation.ts

/**
 * Calculate consistency score for a connection
 * Lower variance = more consistent = higher score
 */
function calculateConsistency(conn: Connection): number {
  const points = conn.starters
    .filter(s => !s.scratched && !s.isAlsoEligible && s.points !== undefined)
    .map(s => s.points || 0);
  
  if (points.length < 2) {
    return 50; // Neutral score for insufficient data
  }
  
  // Calculate mean
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  
  // Calculate standard deviation
  const variance = points.reduce((sum, p) => 
    sum + Math.pow(p - mean, 2), 0
  ) / points.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (CV)
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // Convert to score: lower CV = higher score
  // CV < 0.5 = very consistent (score 80-100)
  // CV 0.5-1.0 = moderately consistent (score 50-80)
  // CV > 1.0 = inconsistent (score 0-50)
  const consistencyScore = Math.max(0, Math.min(100, 100 - (cv * 50)));
  
  return consistencyScore;
}

// Add to generateConnections():
conn.consistencyScore = calculateConsistency(conn);
```

### Add to Connection Type

```typescript
export interface Connection {
  // ... existing fields
  consistencyScore?: number; // 0-100, higher = more consistent
}
```

### Include in Matchup Scoring

```typescript
function calculateMatchupScore(setA: Connection[], setB: Connection[]): number {
  // ... existing calculations
  
  // 7. Consistency Balance (prefer similar consistency)
  const consistencyA = setA.reduce((sum, c) => sum + (c.consistencyScore || 50), 0) / setA.length;
  const consistencyB = setB.reduce((sum, c) => sum + (c.consistencyScore || 50), 0) / setB.length;
  const consistencyDiff = Math.abs(consistencyA - consistencyB);
  const consistencyBalance = 100 - consistencyDiff;
  
  // Updated weighted score:
  const score = 
    epBalance * 0.40 +           // Expected points balance
    salaryBalance * 0.20 +       // Salary balance
    totalValue * 0.20 +          // Total value
    consistencyBalance * 0.10 +  // Consistency balance (NEW)
    confidenceScore * 0.10;      // Confidence
  
  return score;
}
```

---

## Step 5: Testing & Validation

### Add Logging

```typescript
// backend/src/services/unifiedMatchupGenerator.ts

console.log(`[MatchupQuality] Generated matchup:`, {
  setA: setA.map(c => ({
    name: c.name,
    salary: c.salarySum,
    expectedPoints: c.expectedPoints,
    confidence: c.expectedPointsConfidence
  })),
  setB: setB.map(c => ({
    name: c.name,
    salary: c.salarySum,
    expectedPoints: c.expectedPoints,
    confidence: c.expectedPointsConfidence
  })),
  score: calculateMatchupScore(setA, setB),
  epDiff: Math.abs(
    setA.reduce((s, c) => s + (c.expectedPoints || 0), 0) -
    setB.reduce((s, c) => s + (c.expectedPoints || 0), 0)
  )
});
```

### Validation Queries

```sql
-- After generating matchups, validate quality:

-- 1. Check expected points distribution
SELECT 
  matchup_type,
  AVG(ABS(
    (matchup_data->'setA'->>'totalPoints')::float - 
    (matchup_data->'setB'->>'totalPoints')::float
  )) as avg_points_diff,
  STDDEV(ABS(
    (matchup_data->'setA'->>'totalPoints')::float - 
    (matchup_data->'setB'->>'totalPoints')::float
  )) as stddev_points_diff
FROM matchups
GROUP BY matchup_type;

-- 2. Check salary distribution
SELECT 
  matchup_type,
  AVG(ABS(
    (matchup_data->'setA'->>'totalSalary')::float - 
    (matchup_data->'setB'->>'totalSalary')::float
  )) as avg_salary_diff
FROM matchups
GROUP BY matchup_type;
```

---

## Step 6: Admin UI Updates

### Add Quality Metrics Display

```typescript
// components/admin/MatchupCalculationSettings.tsx

interface MatchupQualityStats {
  avgScore: number;
  avgEPDiff: number;
  avgSalaryDiff: number;
  fairnessScore: number;
}

// Display in admin panel:
<div className="space-y-2">
  <h4 className="font-semibold">Matchup Quality Metrics</h4>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="text-sm text-gray-600">Avg Quality Score</label>
      <div className="text-2xl font-bold">{stats.avgScore.toFixed(1)}/100</div>
    </div>
    <div>
      <label className="text-sm text-gray-600">Avg EP Difference</label>
      <div className="text-2xl font-bold">{stats.avgEPDiff.toFixed(1)}</div>
    </div>
    <div>
      <label className="text-sm text-gray-600">Avg Salary Difference</label>
      <div className="text-2xl font-bold">${stats.avgSalaryDiff.toFixed(0)}</div>
    </div>
    <div>
      <label className="text-sm text-gray-600">Fairness Score</label>
      <div className="text-2xl font-bold">{stats.fairnessScore.toFixed(1)}%</div>
    </div>
  </div>
</div>
```

### Add Quality Threshold Setting

```typescript
<div className="space-y-2">
  <label className="block text-sm font-medium">
    Minimum Quality Score
    <span className="text-gray-500 ml-2">(0-100, higher = stricter)</span>
  </label>
  <input
    type="number"
    min="0"
    max="100"
    value={settings.min_quality_score || 70}
    onChange={(e) => updateSettings({
      ...settings,
      min_quality_score: parseInt(e.target.value)
    })}
    className="w-full px-3 py-2 border rounded"
  />
  <p className="text-sm text-gray-600">
    Recommended: 70 for balanced matchups, 80+ for very fair matchups
  </p>
</div>
```

---

## Expected Results

### Before Implementation

```
Sample Matchup:
Set A: John Smith (Jockey)
  - Salary: $5,000
  - Points: 15.0 (historical)
  - Expected: ??? (not calculated)

Set B: Jane Doe (Jockey)
  - Salary: $5,200
  - Points: 8.0 (historical)
  - Expected: ??? (not calculated)

Quality: Unknown
Fairness: ~35% (Set A heavily favored)
```

### After Implementation

```
Sample Matchup:
Set A: John Smith (Jockey)
  - Salary: $5,000
  - Expected Points: 18.5 (AVPA: 6.2 × 3 apps)
  - Confidence: 90%

Set B: Jane Doe (Jockey)
  - Salary: $5,100
  - Expected Points: 17.8 (AVPA: 5.9 × 3 apps)
  - Confidence: 90%

Quality Score: 87/100
EP Difference: 0.7 (3.8%)
Fairness: ~51% (True 50/50!)
```

---

## Performance Impact

### Computation Time

```
Before: ~500ms for 30 matchups
After: ~650ms for 30 matchups (+30%)

Reason: Additional calculations for EP, consistency
Mitigation: Pre-calculate metrics, cache results
```

### Memory Usage

```
Before: ~2MB per 1000 connections
After: ~2.5MB per 1000 connections (+25%)

Reason: Additional fields in Connection objects
Mitigation: Acceptable for modern systems
```

---

## Rollout Strategy

### Phase 1: Silent Launch (Week 1)
- Implement new scoring
- Run in parallel with old system
- Log quality metrics
- Compare results

### Phase 2: A/B Test (Week 2)
- 50% of contests use new system
- 50% use old system
- Measure user engagement
- Measure win rate distribution

### Phase 3: Full Rollout (Week 3)
- Switch all contests to new system
- Monitor quality metrics
- Gather user feedback
- Tune thresholds if needed

---

## Monitoring & Alerts

### Key Metrics to Track

```typescript
interface QualityMetrics {
  avgQualityScore: number;      // Target: 80+
  avgEPDifference: number;       // Target: < 10% of avg EP
  winRateDistribution: {         // Target: 45-55%
    below40: number;
    between40and60: number;
    above60: number;
  };
  userSatisfaction: number;      // Target: 4.5+ stars
  matchupCompletionRate: number; // Target: 90%+
}
```

### Alerts

```typescript
// Set up alerts for quality degradation
if (metrics.avgQualityScore < 70) {
  alert('Quality score below threshold!');
}

if (metrics.winRateDistribution.between40and60 < 0.7) {
  alert('Win rate distribution too wide!');
}
```

---

## Troubleshooting

### Issue: Quality Scores Too Low

**Cause:** Not enough high-quality connections in pool

**Solution:**
1. Lower `min_quality_score` threshold
2. Increase `salary_tolerance`
3. Allow more connection reuse
4. Generate more matchups initially

### Issue: EP Predictions Inaccurate

**Cause:** AVPA data missing or outdated

**Solution:**
1. Check MongoDB performance collections
2. Verify AVPA calculation logic
3. Fall back to historical points per app
4. Use longer time windows (90d instead of 30d)

### Issue: Too Many Similar Matchups

**Cause:** Pool diversity too low

**Solution:**
1. Mix different connection types
2. Use cross-track matchups
3. Include different performance tiers
4. Add randomization factor

---

## Next Steps

1. **Implement Step 1-3** (Expected Points & Scoring) - 2 days
2. **Test with historical data** - 1 day
3. **Deploy to staging** - 1 day
4. **A/B test** - 1 week
5. **Full rollout** - After validation

**Total Timeline: ~2 weeks**

---

**Last Updated:** 2025-11-13  
**Status:** Ready for Implementation  
**Estimated Effort:** 2-3 days for core changes

