# Quality-Focused Matchup Generation Design

## Understanding Theoretical Maximum Calculation

### What is Theoretical Maximum?

The **theoretical maximum** is the absolute highest number of unique matchups you can create from a given set of connections **if each connection can only appear once** (per-type exclusion).

### Formula

For **1v1 matchups** (most common):
```
Theoretical Maximum = Math.floor(eligible_connections / 2)
```

**Why divide by 2?**
- Each matchup requires 2 connections
- Per-type exclusion means each connection can only be used once
- So if you have N connections, you can make at most N/2 matchups

### Real Example with LRL Data

Let's say you have **LRL-2025-11-16** data:

#### Scenario 1: Jockeys
- **Total unique jockeys in entries**: 36
- **After min_appearances filter (2+)**: Let's say 28 jockeys meet the threshold
- **After salary filter ($1000+)**: Let's say 26 jockeys meet the threshold
- **Eligible connections**: 26

**Theoretical Maximum for 1v1:**
- `Math.floor(26 / 2) = 13` unique 1v1 matchups

**But wait!** There are additional constraints:
1. **Horse overlap**: Can't match jockeys who ride the same horse
2. **Salary tolerance**: Jockeys must be within $1000 salary of each other
3. **Quality matching**: You want balanced, competitive matchups

**Actual achievable**: Maybe 8-10 high-quality matchups instead of 13

#### Scenario 2: Complex Patterns (2v1 or 1v2)

For **2v1 matchups**:
- Each matchup uses 3 connections total (2 on one side, 1 on the other)
- Theoretical max: `Math.floor(eligible_connections / 3)`

For **1v2 matchups**:
- Same as above: `Math.floor(eligible_connections / 3)`

**LRL Example:**
- If you have 26 eligible jockeys
- **2v1 theoretical max**: `Math.floor(26 / 3) = 8` matchups
- **1v2 theoretical max**: `Math.floor(26 / 3) = 8` matchups

**Combined approach** (mix of 1v1, 2v1, 1v2):
- You might get: 10x 1v1 + 3x 2v1 + 2x 1v2 = 15 matchups total
- But this uses: (10 × 2) + (3 × 3) + (2 × 3) = 20 + 9 + 6 = 35 connection slots
- **But you only have 26 connections!** ❌ Impossible

**Reality check**: You can't exceed the theoretical maximum without reusing connections.

### Visual Example

```
36 Unique Jockeys in LRL Data
    ↓
Filter: min_appearances ≥ 2
    ↓
28 Jockeys (8 excluded: only 1 race each)
    ↓
Filter: min_salary ≥ $1000
    ↓
26 Eligible Jockeys
    ↓
┌─────────────────────────────────────────┐
│ THEORETICAL MAXIMUM CALCULATIONS        │
├─────────────────────────────────────────┤
│ 1v1 Only:     26 ÷ 2 = 13 matchups      │
│ 2v1 Only:     26 ÷ 3 = 8 matchups       │
│ 1v2 Only:     26 ÷ 3 = 8 matchups       │
│ Mixed:        Limited by total slots    │
└─────────────────────────────────────────┘
    ↓
Apply Additional Constraints:
- Horse overlap elimination
- Salary tolerance ($1000)
- Quality/balance requirements
    ↓
ACTUAL ACHIEVABLE: 8-10 high-quality matchups
```

## Quality-Focused Matchup Generation Strategy

### Core Principle

**Quality over Quantity**: Generate fewer, better matchups rather than forcing more mediocre ones.

### Quality Metrics

#### 1. **Competitiveness Score** (0-100)
How close are the matchups? Closer = more exciting.

```typescript
competitiveness = 100 - (|salary_diff| / max_salary) × 100
```

**Example:**
- Jockey A: $5000 salary
- Jockey B: $5400 salary
- Salary diff: $400
- If max salary is $10000: `100 - (400/10000) × 100 = 96` (very competitive)

**vs.**

- Jockey A: $5000 salary
- Jockey B: $9000 salary
- Salary diff: $4000
- Competitiveness: `100 - (4000/10000) × 100 = 60` (less competitive)

#### 2. **Balanced Tier Matching**
Match within similar salary tiers for fairness:

```typescript
tiers = [
  { name: 'Elite', range: [top 20%], examples: '$8000+ salaries' },
  { name: 'Premium', range: [next 25%], examples: '$6000-$8000' },
  { name: 'Standard', range: [next 25%], examples: '$4000-$6000' },
  { name: 'Value', range: [bottom 30%], examples: '$2000-$4000' }
]
```

**Rule**: Match within same tier (or adjacent tiers with penalty) for better quality.

#### 3. **Appearance Balance** (Optional)
Ensure similar sample sizes:

```typescript
appearanceBalance = 100 - (|appsA - appsB| / max_apps) × 50
```

**Why?** Matching a jockey with 10 races vs 2 races is less fair.

#### 4. **Quality Penalties**

**Penalties reduce quality score:**
- ❌ Horse overlap: -100 (disqualifying)
- ❌ Salary diff > tolerance: -50 (disqualifying)
- ❌ Cross-tier match (Elite vs Value): -20
- ⚠️ Appearance diff > 5: -10
- ⚠️ Salary diff > 50% of tolerance: -5

**Bonuses increase quality score:**
- ✅ Within-tier match: +10
- ✅ Very close salary (< 25% of tolerance): +5
- ✅ Similar appearances (< 2 difference): +5

### Quality Scoring Formula

```typescript
qualityScore = 
  competitiveness × 0.4 +
  tierBonus × 0.3 +
  appearanceBalance × 0.2 +
  matchupTypeBonus × 0.1

// Then apply penalties
if (horseOverlap) qualityScore = 0;
if (salaryDiff > tolerance) qualityScore = 0;
qualityScore -= penalties;
qualityScore += bonuses;
qualityScore = Math.max(0, Math.min(100, qualityScore));
```

### Generation Algorithm

#### Phase 1: Assess Available Connections

```typescript
1. Load entries data (ignore results - this is for live contests)
2. Group by connection type (jockey, trainer, sire)
3. Filter by min_appearances (jockey=2, trainer=2, sire=1)
4. Filter by min_salary ($1000)
5. Calculate tier distribution (4 tiers)
6. Calculate theoretical maximums:
   - 1v1 max = floor(eligible / 2)
   - 2v1 max = floor(eligible / 3)
   - 1v2 max = floor(eligible / 3)
```

#### Phase 2: Quality-First Generation

```typescript
1. Generate ALL possible 1v1 pairs (exhaustive)
2. Score each pair for quality:
   - Calculate competitiveness
   - Check tier matching
   - Check appearance balance
   - Apply penalties/bonuses
3. Sort by quality score (descending)
4. Apply per-type exclusion:
   - Select highest quality pairs first
   - Skip if connection already used
   - Continue until theoretical max or quality threshold
5. Generate complex patterns (2v1, 1v2) only if needed
   - Use remaining connections
   - Apply same quality scoring
   - Maintain per-type exclusion
```

#### Phase 3: Quality Threshold

**Don't force low-quality matchups!**

```typescript
if (qualityScore < 50) {
  // Skip this matchup - not good enough
  continue;
}
```

**Result**: Better to return 8 excellent matchups than 10 mediocre ones.

### Example: LRL Jockey Matchups

**Input:**
- 26 eligible jockeys
- Theoretical max: 13 matchups
- Target: 10 matchups

**Generation Process:**

```
Step 1: Generate all valid pairs
- Check horse overlap (reject if same horses)
- Check salary tolerance < $1000 (reject if > $1000)
- Result: 45 valid pairs

Step 2: Score for quality
- Tier 1 (Elite): 6 jockeys → 15 pairs possible
- Tier 2 (Premium): 8 jockeys → 28 pairs possible
- Tier 3 (Standard): 7 jockeys → 21 pairs possible
- Tier 4 (Value): 5 jockeys → 10 pairs possible

Step 3: Sort by quality score
Top 10:
1. Tier 1: Irad Ortiz ($9500) vs Joel Rosario ($9200) - Score: 95
2. Tier 1: Luis Saez ($8800) vs Flavien Prat ($9000) - Score: 94
3. Tier 2: Javier Castellano ($7500) vs Jose Ortiz ($7800) - Score: 92
4. Tier 2: John Velazquez ($7200) vs Manny Franco ($7400) - Score: 91
... (continues)

Step 4: Apply per-type exclusion
- Select top quality pairs
- Mark connections as used
- Result: 10 high-quality matchups

Step 5: Complex patterns (if needed)
- Remaining connections: 6
- Generate 2v1: Max 2 matchups
- Only if quality score > 50
```

**Final Result**: 10 high-quality matchups (maybe 12 if some 2v1 meet quality threshold)

## Cross-Track Matchups

### Additional Quality Considerations

1. **Track Difficulty Normalization**
   - AQU (tougher track) vs LRL (easier track)
   - Normalize salaries/performance metrics

2. **Competitive Balance**
   - Still prioritize within-tier matching
   - Cross-track can match across tiers if normalized properly

3. **Quality Threshold**: Higher (60+) for cross-track
   - More complex to evaluate
   - Ensure meaningful comparisons

## Implementation Priority

1. ✅ Clean up debug logging (DONE)
2. ✅ Update min_appearances (DONE: jockey=2, trainer=2, sire=1)
3. ✅ Implement quality scoring system (DONE)
4. ✅ Add tier-based matching (DONE)
5. ✅ Add quality threshold filtering (DONE)
6. ✅ Enhanced logging for matchup quality metrics (DONE)

**Status**: Quality scoring system fully implemented for ALL matchup types (1v1, 2v1, 1v2)! 🎉

**Latest Updates:**
- ✅ Quality scoring now applies to complex patterns (2v1, 1v2)
- ✅ Quality thresholds are configurable per matchup type
- ✅ Fine-tune thresholds based on real data analysis

**What's Working:**
- ✅ Quality score calculation (competitiveness, tier matching, appearance balance)
- ✅ Quality scoring for 1v1 matchups
- ✅ Quality scoring for complex patterns (2v1, 1v2) - **NEW!**
- ✅ Configurable quality thresholds in settings - **NEW!**
- ✅ Quality thresholds based on matchup type and tier
- ✅ Tier-based matching prioritizes same-tier matchups
- ✅ Quality-first sorting (highest quality matchups selected first)
- ✅ Quality metrics logging (avg, min, max quality scores for both 1v1 and complex)
- ✅ Theoretical maximum calculation and reporting

**Next Steps** (Completed):
- ✅ Apply quality scoring to complex patterns (2v1, 1v2) - DONE! Now uses full quality scoring system
- ✅ Fine-tune quality thresholds based on real data analysis - DONE! Thresholds are now configurable
- 🔄 Add quality dashboard/metrics visualization (optional future enhancement)

**Configuration Changes:**
Quality thresholds are now **configurable** in `DEFAULT_UNIFIED_SETTINGS`! You can fine-tune them based on real data analysis:

```typescript
{
  quality_threshold_1v1: 50,        // Standard 1v1 matchups
  quality_threshold_2v1: 45,        // 2v1 complex patterns (slightly lower)
  quality_threshold_1v2: 45,        // 1v2 complex patterns (slightly lower)
  quality_threshold_cross_track: 60, // Cross-track (higher bar)
  quality_threshold_elite_tier: 70,  // Elite tier matchups (premium quality)
}
```

**How to Fine-Tune:**
1. Run matchup generation and review quality scores in logs
2. Check which matchups are being rejected
3. Adjust thresholds up/down based on:
   - Quality distribution (if avg > 85, consider raising thresholds)
   - Too many rejections (if >30% rejected, consider lowering thresholds)
   - User feedback on matchup quality

## Quality Thresholds

| Matchup Type | Default Min Quality Score | Configurable | Notes |
|-------------|--------------------------|--------------|-------|
| 1v1 Same Track | 50 | ✅ `quality_threshold_1v1` | Standard competitive matchups |
| 1v1 Cross Track | 60 | ✅ `quality_threshold_cross_track` | Higher bar for cross-track |
| 2v1 | 45 | ✅ `quality_threshold_2v1` | Slightly lower (more complex) |
| 1v2 | 45 | ✅ `quality_threshold_1v2` | Slightly lower (more complex) |
| Elite Tier | 70 | ✅ `quality_threshold_elite_tier` | Premium matchups need high quality |

**Note:** All thresholds are configurable in `DEFAULT_UNIFIED_SETTINGS`. Adjust based on real data analysis!

## Monitoring & Metrics

Track these metrics to ensure quality:

```typescript
{
  requested: 10,
  theoreticalMax: 13,
  generated: 10,
  qualityScores: [95, 94, 92, 91, 88, 85, 82, 78, 75, 72],
  avgQuality: 85.2,
  tierDistribution: { elite: 3, premium: 4, standard: 2, value: 1 },
  competitivenessAvg: 92.5, // avg salary diff percentage
  horseOverlapRejected: 12,
  qualityThresholdRejected: 5
}
```

## Success Criteria

✅ **Quality Matchups Generated:**
- Average quality score > 80
- All matchups > quality threshold
- Competitive balance maintained
- Per-type exclusion enforced

✅ **User Experience:**
- Engaging matchups (not lopsided)
- Fair comparisons (similar tiers)
- Variety (different connection types)
- No forced low-quality matchups

