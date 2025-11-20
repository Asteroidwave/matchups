# Matchup Enhancements Roadmap

## Overview

This document outlines potential improvements and new features for the matchup system, focusing on multi-track, multi-day contests and advanced matchup generation strategies.

---

## 1. Multi-Track, Multi-Day Contests 🌟

### Concept
Allow contests that span multiple tracks and multiple days, creating more diverse and interesting matchup opportunities.

### Use Cases

#### A. Weekend Tournament
```
Contest: "Weekend Warrior"
- Tracks: DEL, SA, GP, CD
- Days: Saturday + Sunday
- Duration: 2 days
- Total Races: ~40-60 races across all tracks/days
```

#### B. Track Rivalry
```
Contest: "East vs West"
- Tracks: BEL, SA (rivalry between coasts)
- Days: Friday, Saturday, Sunday
- Duration: 3 days
- Focus: Compare performance across regions
```

#### C. Monthly Challenge
```
Contest: "Monthly Masters"
- Tracks: All major tracks
- Days: Entire month
- Duration: 30 days
- Leaderboard: Cumulative scoring
```

### Implementation Strategy

#### Phase 1: Data Model Updates

**Database Schema Changes:**
```sql
-- Update contests table
ALTER TABLE contests ADD COLUMN contest_format VARCHAR(50) DEFAULT 'single_day';
-- Options: 'single_day', 'multi_day', 'multi_track', 'multi_track_multi_day'

ALTER TABLE contests ADD COLUMN tracks TEXT[]; -- Array of track codes
ALTER TABLE contests ADD COLUMN dates TEXT[]; -- Array of dates
ALTER TABLE contests ADD COLUMN start_date DATE;
ALTER TABLE contests ADD COLUMN end_date DATE;

-- Add contest_tracks junction table for more flexibility
CREATE TABLE contest_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE,
  track_code VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  track_data_id UUID REFERENCES track_data(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contest_tracks_contest ON contest_tracks(contest_id);
CREATE INDEX idx_contest_tracks_track_date ON contest_tracks(track_code, date);
```

**Connection Type Updates:**
```typescript
interface Connection {
  id: string;
  name: string;
  role: ConnectionRole;
  trackSet: string[]; // Already supports multiple tracks ✅
  dateSet?: string[]; // NEW: Track which dates connection appears
  apps: number;
  salarySum: number;
  pointsSum: number;
  // ... existing fields
  
  // NEW: Per-track/date breakdown
  trackDateBreakdown?: {
    [trackDate: string]: { // e.g., "DEL-2025-11-15"
      apps: number;
      salary: number;
      points: number;
      races: number[];
    };
  };
}
```

#### Phase 2: Matchup Generation Enhancements

**New Matchup Types:**

1. **Cross-Day Matchups**
   ```typescript
   // Example: Saturday jockey vs Sunday jockey
   Set A: Jockey "John Smith" (Saturday races only)
   Set B: Jockey "Jane Doe" (Sunday races only)
   
   Validation:
   - Different days = same role allowed
   - Same track OK if different days
   ```

2. **Track Rivalry Matchups**
   ```typescript
   // Example: East Coast vs West Coast
   Set A: Connections from BEL, GP (East Coast)
   Set B: Connections from SA, GG (West Coast)
   
   Validation:
   - Must be from different geographic regions
   - Can mix roles
   ```

3. **Time-Based Matchups**
   ```typescript
   // Example: Morning races vs Evening races
   Set A: Connections from races 1-5 (morning)
   Set B: Connections from races 6-10 (evening)
   
   Validation:
   - Based on post times
   - Same track, different time slots
   ```

**Enhanced Validation Logic:**
```typescript
interface MatchupValidationContext {
  isMixed: boolean;
  isMultiDay: boolean;
  isMultiTrack: boolean;
  allowCrossDay: boolean;
  allowCrossTrack: boolean;
  requireDifferentRoles: boolean;
}

function isValidMultiDayMatchup(
  setA: Connection[],
  setB: Connection[],
  context: MatchupValidationContext
): boolean {
  // Horse overlap check (always)
  if (checkHorseOverlap(setA, setB)) return false;
  
  // Check date overlap
  const datesA = new Set(setA.flatMap(c => c.dateSet || []));
  const datesB = new Set(setB.flatMap(c => c.dateSet || []));
  const dateOverlap = [...datesA].some(d => datesB.has(d));
  
  if (context.allowCrossDay && !dateOverlap) {
    // Different days: roles can be same
    return true;
  }
  
  // Same day: apply existing mixed matchup rules
  return isValidMixedMatchup(setA, setB, horseMap);
}
```

#### Phase 3: UI/UX Updates

**Contest Creation (Admin):**
```
┌─────────────────────────────────────────┐
│ Create New Contest                      │
├─────────────────────────────────────────┤
│ Contest Format:                         │
│ ○ Single Day, Single Track             │
│ ○ Single Day, Multiple Tracks          │
│ ○ Multiple Days, Single Track          │
│ ● Multiple Days, Multiple Tracks       │
├─────────────────────────────────────────┤
│ Tracks: [Select Multiple]               │
│ ☑ DEL  ☑ SA  ☑ GP  ☐ CD  ☐ BEL        │
├─────────────────────────────────────────┤
│ Date Range:                             │
│ Start: [Nov 15, 2025]                   │
│ End:   [Nov 17, 2025]                   │
├─────────────────────────────────────────┤
│ Matchup Types:                          │
│ ☑ Jockey vs Jockey                     │
│ ☑ Trainer vs Trainer                   │
│ ☑ Sire vs Sire                         │
│ ☑ Mixed (Cross-Track)                  │
│ ☑ Cross-Day Matchups                   │
└─────────────────────────────────────────┘
```

**Matchups Page Updates:**
```
┌─────────────────────────────────────────┐
│ Players Panel Header                    │
├─────────────────────────────────────────┤
│ [🔄 Reload]  Track: [All ▼]            │
│                                         │
│ Date Filter:                            │
│ [All Days] [Nov 15] [Nov 16] [Nov 17]  │
│                                         │
│ Track-Date Combinations:                │
│ [DEL-Nov15] [SA-Nov15] [GP-Nov15]      │
│ [DEL-Nov16] [SA-Nov16] [GP-Nov16]      │
└─────────────────────────────────────────┘
```

**Connection Card Enhancements:**
```
┌─────────────────────────────────────────┐
│ John Smith                    $8,500    │
│ [Jockey] [Multi-Track]                  │
│                                         │
│ Tracks: DEL (3), SA (2), GP (1)        │
│ Days: Nov 15 (4), Nov 16 (2)           │
│                                         │
│ Total Apps: 6  Avg Odds: 3.2           │
│                                         │
│ [View Breakdown ▼]                      │
└─────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────┐
│ Breakdown by Track-Date:                │
│                                         │
│ DEL - Nov 15:                           │
│   Races: 2, 5, 8                        │
│   Salary: $3,200  Points: 12.5          │
│                                         │
│ SA - Nov 15:                            │
│   Races: 3, 7                           │
│   Salary: $2,800  Points: 8.0           │
│                                         │
│ [View All Horses →]                     │
└─────────────────────────────────────────┘
```

---

## 2. Advanced Matchup Generation Strategies

### A. Performance-Based Tiers

**Concept:** Group connections by performance level and create matchups within tiers.

```typescript
interface PerformanceTier {
  name: string;
  minAVPA: number;
  maxAVPA: number;
  minApps: number;
}

const TIERS: PerformanceTier[] = [
  { name: 'Elite', minAVPA: 15, maxAVPA: Infinity, minApps: 5 },
  { name: 'Competitive', minAVPA: 10, maxAVPA: 15, minApps: 3 },
  { name: 'Developing', minAVPA: 5, maxAVPA: 10, minApps: 2 },
  { name: 'Emerging', minAVPA: 0, maxAVPA: 5, minApps: 1 },
];

function generateTieredMatchups(
  connections: Connection[],
  settings: UnifiedMatchupSettings
): Matchup[] {
  const matchups: Matchup[] = [];
  
  // Group connections by tier
  const tiers = TIERS.map(tier => ({
    ...tier,
    connections: connections.filter(c => 
      c.avpa30d >= tier.minAVPA && 
      c.avpa30d < tier.maxAVPA &&
      c.apps >= tier.minApps
    )
  }));
  
  // Generate matchups within each tier
  for (const tier of tiers) {
    if (tier.connections.length >= 2) {
      const tierMatchups = generateUnifiedMatchups(
        tier.connections,
        settings,
        buildConnectionHorseMap(tier.connections)
      );
      matchups.push(...tierMatchups);
    }
  }
  
  return matchups;
}
```

**Benefits:**
- More balanced matchups
- Better for beginners (can compete in lower tiers)
- Clearer skill progression

### B. Storyline Matchups

**Concept:** Create matchups based on interesting narratives.

```typescript
interface StorylineMatchup {
  type: 'rivalry' | 'mentor_student' | 'comeback' | 'hot_streak' | 'underdog';
  description: string;
  connections: Connection[];
}

// Example: Rivalry Detection
function detectRivalries(connections: Connection[]): StorylineMatchup[] {
  const rivalries: StorylineMatchup[] = [];
  
  // Find connections that frequently compete in same races
  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      const connA = connections[i];
      const connB = connections[j];
      
      const sharedRaces = countSharedRaces(connA, connB);
      
      if (sharedRaces >= 3) {
        rivalries.push({
          type: 'rivalry',
          description: `${connA.name} vs ${connB.name}: Faced off ${sharedRaces} times`,
          connections: [connA, connB]
        });
      }
    }
  }
  
  return rivalries;
}

// Example: Hot Streak Detection
function detectHotStreaks(connections: Connection[]): StorylineMatchup[] {
  return connections
    .filter(c => {
      // Check last 3 races for wins
      const recentRaces = c.starters.slice(-3);
      const wins = recentRaces.filter(s => s.pos === 1).length;
      return wins >= 2;
    })
    .map(c => ({
      type: 'hot_streak',
      description: `${c.name} is on fire! 🔥 (${c.pointsSum} points recently)`,
      connections: [c]
    }));
}
```

**UI Display:**
```
┌─────────────────────────────────────────┐
│ 🔥 Featured Matchup: Hot Streak        │
├─────────────────────────────────────────┤
│ John Smith is on fire! Won 3 of last   │
│ 4 races. Can he keep it going?         │
│                                         │
│ Set A: John Smith (Hot Streak)         │
│ Set B: Jane Doe (Steady Performer)     │
│                                         │
│ [Select A] [Select B]                   │
└─────────────────────────────────────────┘
```

### C. Dynamic Difficulty Adjustment

**Concept:** Adjust matchup difficulty based on user performance.

```typescript
interface UserPerformance {
  userId: string;
  winRate: number;
  avgROI: number;
  recentStreak: number;
}

function adjustMatchupDifficulty(
  baseMatchups: Matchup[],
  userPerf: UserPerformance
): Matchup[] {
  // Calculate difficulty score for each matchup
  const scoredMatchups = baseMatchups.map(m => ({
    matchup: m,
    difficulty: calculateMatchupDifficulty(m)
  }));
  
  // Sort by difficulty
  scoredMatchups.sort((a, b) => a.difficulty - b.difficulty);
  
  // Select matchups based on user performance
  let targetDifficulty: number;
  if (userPerf.winRate > 0.6) {
    // High performer: show harder matchups
    targetDifficulty = 0.7;
  } else if (userPerf.winRate < 0.4) {
    // Struggling: show easier matchups
    targetDifficulty = 0.3;
  } else {
    // Average: balanced mix
    targetDifficulty = 0.5;
  }
  
  // Select matchups near target difficulty
  return scoredMatchups
    .filter(sm => Math.abs(sm.difficulty - targetDifficulty) < 0.2)
    .map(sm => sm.matchup);
}

function calculateMatchupDifficulty(matchup: Matchup): number {
  const salaryDiff = Math.abs(
    matchup.setA.totalSalary - matchup.setB.totalSalary
  );
  const pointsDiff = Math.abs(
    matchup.setA.totalPoints - matchup.setB.totalPoints
  );
  
  // Closer matchups are harder (require more skill)
  const salaryScore = 1 - (salaryDiff / 2000); // Normalize to 0-1
  const pointsScore = 1 - (pointsDiff / 20);
  
  return (salaryScore + pointsScore) / 2;
}
```

---

## 3. Specialized Matchup Types

### A. Handicapping Challenges

**Concept:** Matchups designed to test specific handicapping skills.

```typescript
type ChallengeType = 
  | 'longshot_special'    // Find value in high-odds horses
  | 'favorite_faceoff'    // Pick between favorites
  | 'maiden_madness'      // Maiden races only
  | 'turf_tactics'        // Turf races only
  | 'sprint_showdown'     // Sprint races (< 7f)
  | 'route_royale';       // Route races (>= 1 mile)

interface ChallengeMatchup extends Matchup {
  challengeType: ChallengeType;
  challengeDescription: string;
  bonusMultiplier?: number; // Extra reward for harder challenges
}

function generateChallengeMatchup(
  type: ChallengeType,
  connections: Connection[]
): ChallengeMatchup | null {
  switch (type) {
    case 'longshot_special':
      // Filter to connections with avg odds > 10
      const longshots = connections.filter(c => c.avgOdds > 10);
      if (longshots.length < 2) return null;
      
      const matchup = generateUnifiedMatchups(
        longshots,
        DEFAULT_UNIFIED_SETTINGS.mixed,
        buildConnectionHorseMap(longshots)
      )[0];
      
      return {
        ...matchup,
        challengeType: 'longshot_special',
        challengeDescription: 'Find value in the longshots! (Avg odds > 10)',
        bonusMultiplier: 1.5
      };
      
    case 'favorite_faceoff':
      // Filter to connections with avg odds < 3
      const favorites = connections.filter(c => c.avgOdds < 3);
      // ... similar logic
      
    // ... other challenge types
  }
}
```

**UI Display:**
```
┌─────────────────────────────────────────┐
│ 🎯 Challenge: Longshot Special         │
│ Bonus: 1.5x multiplier                  │
├─────────────────────────────────────────┤
│ Find value in the longshots!            │
│ Both connections have avg odds > 10     │
│                                         │
│ Set A: Dark Horse (Odds: 15.2)         │
│ Set B: Underdog (Odds: 12.8)           │
│                                         │
│ [Accept Challenge]                      │
└─────────────────────────────────────────┘
```

### B. Head-to-Head History

**Concept:** Show connections that have competed against each other before.

```typescript
interface HeadToHeadStats {
  connectionA: Connection;
  connectionB: Connection;
  meetings: number;
  aWins: number;
  bWins: number;
  lastMeeting: {
    date: string;
    track: string;
    race: number;
    aPoints: number;
    bPoints: number;
  };
}

function findHeadToHeadMatchups(
  connections: Connection[]
): HeadToHeadStats[] {
  const h2h: HeadToHeadStats[] = [];
  
  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      const connA = connections[i];
      const connB = connections[j];
      
      // Find races where both competed
      const meetings = findSharedRaces(connA, connB);
      
      if (meetings.length >= 2) {
        h2h.push(calculateH2HStats(connA, connB, meetings));
      }
    }
  }
  
  return h2h;
}
```

---

## 4. Social & Competitive Features

### A. Matchup Pools

**Concept:** Users can create/join pools with custom matchup selections.

```typescript
interface MatchupPool {
  id: string;
  name: string;
  creatorId: string;
  contestId: string;
  matchupIds: string[];
  entryFee: number;
  prizePool: number;
  participants: string[];
  maxParticipants: number;
  status: 'open' | 'locked' | 'live' | 'settled';
}

// Example: "Elite Jockeys Only" pool
const pool: MatchupPool = {
  id: 'pool-1',
  name: 'Elite Jockeys Only',
  creatorId: 'user-123',
  contestId: 'contest-456',
  matchupIds: ['matchup-1', 'matchup-2', 'matchup-3'], // Only jockey matchups
  entryFee: 50,
  prizePool: 0, // Calculated based on participants
  participants: [],
  maxParticipants: 20,
  status: 'open'
};
```

### B. Matchup Ratings & Comments

**Concept:** Users can rate matchups and leave comments.

```typescript
interface MatchupRating {
  matchupId: string;
  userId: string;
  rating: number; // 1-5 stars
  difficulty: 'easy' | 'medium' | 'hard';
  comment?: string;
  createdAt: string;
}

interface MatchupStats {
  matchupId: string;
  avgRating: number;
  totalRatings: number;
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  popularityScore: number; // Based on selection frequency
}
```

---

## 5. Implementation Priority

### Phase 1: Foundation (1-2 weeks)
- [ ] Multi-track contest support
- [ ] Enhanced connection data model
- [ ] Cross-day matchup validation
- [ ] UI updates for multi-track selection

### Phase 2: Advanced Generation (2-3 weeks)
- [ ] Performance-based tiers
- [ ] Storyline matchup detection
- [ ] Challenge matchup types
- [ ] Head-to-head history tracking

### Phase 3: Social Features (3-4 weeks)
- [ ] Matchup pools
- [ ] Ratings & comments
- [ ] Dynamic difficulty adjustment
- [ ] Leaderboards by matchup type

### Phase 4: Polish & Optimization (1-2 weeks)
- [ ] Performance optimization
- [ ] A/B testing different matchup strategies
- [ ] User feedback integration
- [ ] Analytics dashboard

---

## 6. Technical Considerations

### Database Performance
- Index `contest_tracks` table properly
- Consider materialized views for complex queries
- Cache frequently accessed matchup data
- Use Redis for real-time matchup availability

### Scalability
- Generate matchups asynchronously
- Use worker queues for multi-day contests
- Implement pagination for large matchup lists
- Consider sharding by date/track

### User Experience
- Progressive loading (show available matchups first)
- Smart defaults (auto-select popular tracks/dates)
- Clear visual indicators for multi-track/day matchups
- Tooltips explaining new matchup types

---

## 7. Success Metrics

### Engagement
- Average matchups per user
- Time spent on matchups page
- Return rate for multi-day contests

### Quality
- Average salary difference in matchups
- User satisfaction ratings
- Win rate distribution (should be ~50%)

### Revenue
- Entry fee revenue by matchup type
- Premium feature adoption (pools, challenges)
- User retention rate

---

## Conclusion

These enhancements would significantly expand the matchup system's capabilities, making it more engaging, competitive, and accessible to users of all skill levels. The multi-track, multi-day contest feature is particularly exciting as it opens up entirely new contest formats and matchup possibilities.

**Recommended Next Steps:**
1. Validate concepts with user research
2. Build Phase 1 (multi-track support)
3. Test with beta users
4. Iterate based on feedback
5. Roll out advanced features gradually

---

**Last Updated:** 2025-11-13  
**Status:** Proposal - Awaiting Review

