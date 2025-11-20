# 🏇 Live Race Tracking System - Feasibility Analysis

## ✅ **YES, It's Possible!** Your current setup can handle live race tracking.

## 📊 Current Infrastructure Assessment

### ✅ **What You Already Have:**

1. **Database Schema** - Fully equipped:
   - ✅ `races` table with `post_time`, `status` fields
   - ✅ `race_cards` with `first_post_time`, `last_post_time`, `status`
   - ✅ `race_results` table for storing results
   - ✅ `race_entries` with `status` (entered, scratched, also_eligible)
   - ✅ `contests` with `lock_time`, `status`, `lifecycle_stage`
   - ✅ Indexes on `post_time` for efficient queries

2. **Backend API** - Ready:
   - ✅ Express.js backend
   - ✅ Supabase integration
   - ✅ Data ingestion pipeline
   - ✅ RESTful API endpoints

3. **Real-time Infrastructure** - Partially ready:
   - ✅ WebSocket support (socket.io) - seen in `useSimulation.ts`
   - ✅ Frontend hooks for WebSocket connections

4. **Race Status Tracking**:
   - ✅ `races.status`: 'scheduled', 'live', 'official', 'cancelled'
   - ✅ `race_cards.status`: 'scheduled', 'live', 'cancelled', 'completed'

## 🔧 **What You Need to Add:**

### 1. **Scheduled Job System** (CRITICAL)

**Options:**
- **Option A: Node-cron** (Recommended for simplicity)
  ```bash
  npm install node-cron
  ```
  - Run scheduled tasks in your Express backend
  - Good for polling intervals (every 3 minutes, etc.)

- **Option B: Supabase Edge Functions + pg_cron**
  - Use Supabase's built-in cron jobs
  - More scalable, runs in Supabase infrastructure
  - Requires Supabase Pro plan

- **Option C: External Service** (Vercel Cron, GitHub Actions, etc.)
  - If deploying on Vercel, use Vercel Cron Jobs
  - Can trigger your API endpoints on schedule

**Recommended:** Start with `node-cron` in your backend, migrate to Supabase Edge Functions later for scale.

### 2. **Equibase API Integration**

**What You Need:**
- Equibase API credentials/access
- API client service to fetch:
  - Race results (finishing positions, times, payouts)
  - Scratches and changes
  - Official results

**Implementation:**
```typescript
// backend/src/services/equibaseService.ts
class EquibaseService {
  async fetchRaceResults(trackCode: string, date: string, raceNumber: number)
  async fetchScratches(trackCode: string, date: string)
  async checkRaceStatus(trackCode: string, date: string, raceNumber: number)
}
```

### 3. **Race Polling Service** (Core Logic)

**What It Does:**
- Monitors upcoming races (5 min before post time)
- Polls Equibase for results (every 3 min after post time)
- Updates database when results arrive
- Moves to next race automatically

**Implementation Structure:**
```typescript
// backend/src/services/racePollingService.ts
class RacePollingService {
  // Find races that need polling
  async getRacesToPoll(): Promise<Race[]>
  
  // Start polling for a race
  async startPolling(raceId: string): Promise<void>
  
  // Check Equibase for results
  async checkForResults(raceId: string): Promise<RaceResult | null>
  
  // Update race status and results
  async updateRaceResults(raceId: string, results: RaceResult): Promise<void>
  
  // Move to next race
  async moveToNextRace(contestId: string): Promise<void>
}
```

### 4. **Race Status Update Service**

**What It Does:**
- Updates `races.status` (scheduled → live → official)
- Updates `race_cards.status`
- Updates `race_entries.status` (scratches)
- Triggers WebSocket broadcasts

**Database Updates:**
```sql
-- Update race status
UPDATE races 
SET status = 'live', updated_at = NOW()
WHERE post_time <= NOW() + INTERVAL '5 minutes'
  AND status = 'scheduled';

-- Update race results
INSERT INTO race_results (race_entry_id, finish_position, ...)
VALUES (...);

-- Mark race as official
UPDATE races 
SET status = 'official', updated_at = NOW()
WHERE id = ? AND results_complete = true;
```

### 5. **WebSocket Broadcasting** (Real-time Updates)

**What You Need:**
- Broadcast race status changes to connected clients
- Broadcast results as they come in
- Update frontend in real-time

**Implementation:**
```typescript
// backend/src/services/websocketService.ts
class WebSocketService {
  // Broadcast race status change
  broadcastRaceStatus(raceId: string, status: string)
  
  // Broadcast race results
  broadcastRaceResults(raceId: string, results: RaceResult[])
  
  // Broadcast contest updates
  broadcastContestUpdate(contestId: string, update: ContestUpdate)
}
```

### 6. **Multi-Track Coordination**

**What You Need:**
- Track multiple races across different tracks simultaneously
- Handle different timezones
- Coordinate post times across tracks

**Your Schema Already Supports:**
- ✅ `tracks` table with `timezone` field
- ✅ `race_cards` per track per date
- ✅ `contests` can span multiple tracks (`contest_type: 'multi_track'`)

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────┐
│              Scheduled Job (node-cron)                  │
│  Runs every 1 minute to check for races to poll        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Race Polling Service                          │
│  • Finds races 5 min before post time                   │
│  • Starts polling every 3 min after post time          │
│  • Checks Equibase API for results                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Equibase API Service                         │
│  • Fetches race results                                 │
│  • Fetches scratches/changes                           │
│  • Validates data                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Database Update Service                      │
│  • Updates race status                                  │
│  • Inserts race results                                 │
│  • Updates race entries (scratches)                     │
│  • Updates contest lifecycle                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           WebSocket Broadcast                          │
│  • Notifies connected clients                           │
│  • Updates frontend in real-time                        │
└─────────────────────────────────────────────────────────┘
```

## 📋 **Implementation Checklist**

### Phase 1: Foundation
- [ ] Install `node-cron` or set up Supabase Edge Functions
- [ ] Create Equibase API service
- [ ] Create race polling service
- [ ] Add database indexes for efficient queries

### Phase 2: Core Functionality
- [ ] Implement race status monitoring (5 min before post time)
- [ ] Implement result polling (every 3 min after post time)
- [ ] Implement database update logic
- [ ] Add error handling and retry logic

### Phase 3: Real-time Updates
- [ ] Enhance WebSocket service for race updates
- [ ] Add frontend hooks for live race data
- [ ] Implement automatic UI updates

### Phase 4: Multi-Track Support
- [ ] Test with multiple tracks simultaneously
- [ ] Handle timezone differences
- [ ] Coordinate cross-track contests

## 🔍 **Database Queries You'll Need**

### Find Races to Start Polling (5 min before post time):
```sql
SELECT r.*, rc.track_id, t.code as track_code
FROM races r
JOIN race_cards rc ON rc.id = r.race_card_id
JOIN tracks t ON t.id = rc.track_id
WHERE r.post_time BETWEEN NOW() AND NOW() + INTERVAL '5 minutes'
  AND r.status = 'scheduled'
  AND rc.status = 'scheduled'
ORDER BY r.post_time ASC;
```

### Find Races Currently Running (need result polling):
```sql
SELECT r.*, rc.track_id, t.code as track_code
FROM races r
JOIN race_cards rc ON rc.id = r.race_card_id
JOIN tracks t ON t.id = rc.track_id
WHERE r.post_time <= NOW()
  AND r.status IN ('scheduled', 'live')
  AND NOT EXISTS (
    SELECT 1 FROM race_results rr 
    WHERE rr.race_entry_id IN (
      SELECT id FROM race_entries WHERE race_id = r.id
    )
  )
ORDER BY r.post_time ASC;
```

### Update Race Status:
```sql
-- Mark race as live
UPDATE races 
SET status = 'live', updated_at = NOW()
WHERE id = ? AND status = 'scheduled';

-- Mark race as official (when results complete)
UPDATE races 
SET status = 'official', updated_at = NOW()
WHERE id = ? 
  AND EXISTS (
    SELECT 1 FROM race_results rr
    JOIN race_entries re ON re.id = rr.race_entry_id
    WHERE re.race_id = races.id
  );
```

## ⚠️ **Important Considerations**

1. **Equibase API Access:**
   - You'll need API credentials/access
   - May require subscription or partnership
   - Check rate limits and usage policies

2. **Error Handling:**
   - Network failures
   - API rate limits
   - Missing/incomplete data
   - Race delays or cancellations

3. **Performance:**
   - Database indexes on `post_time`, `status`
   - Efficient polling (don't poll completed races)
   - WebSocket connection management

4. **Scalability:**
   - Multiple tracks = multiple concurrent polls
   - Consider queue system (Bull, BullMQ) for high volume
   - Database connection pooling

5. **Data Validation:**
   - Verify results match race entries
   - Handle scratches and changes
   - Validate finishing positions

## ✅ **Summary**

**Your current setup is 80% ready!** You have:
- ✅ Database schema (perfect for this)
- ✅ Backend infrastructure
- ✅ WebSocket foundation
- ✅ Race status tracking

**You need to add:**
- ⚠️ Scheduled job system (node-cron or Supabase Edge Functions)
- ⚠️ Equibase API integration
- ⚠️ Race polling service
- ⚠️ WebSocket broadcasting enhancements

**Estimated Implementation Time:**
- Phase 1 (Foundation): 2-3 days
- Phase 2 (Core): 3-5 days
- Phase 3 (Real-time): 2-3 days
- Phase 4 (Multi-track): 2-3 days

**Total: ~2-3 weeks for full implementation**

## 🚀 **Recommended Next Steps**

1. **Start with node-cron** - Easiest to implement
2. **Create Equibase API service** - Core dependency
3. **Build race polling service** - Core logic
4. **Test with single track** - Validate approach
5. **Scale to multi-track** - Add complexity gradually

Your architecture is solid - this is definitely achievable! 🎯
