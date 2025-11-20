# Implementation Priorities & Status

**Last Updated**: 2025-11-18  
**Current Focus**: Live Simulation & Results Flow

---

## 🎯 CRITICAL PATH (Must Work for Launch)

### Phase 1: Core Matchup System ✅ COMPLETE
- [x] Quality-based matchup generation
- [x] Per-type exclusion (no duplicate connections)
- [x] Salary tiers and quality scoring
- [x] Cross-track matchups
- [x] Configurable quality thresholds
- [x] **UUID-based matchup IDs** ✅ JUST FIXED

### Phase 2: User Flow - Matchups Page ✅ COMPLETE
- [x] Display matchups by type
- [x] User can select matchups (Set A or Set B)
- [x] Realistic multiplier system (DraftKings/Underdog style)
- [x] Flex play option
- [x] Submit round with proper validation
- [x] Success banner (no redirect)
- [x] Compact, responsive UI

### Phase 3: Live Simulation ✅ COMPLETE

#### ✅ Completed:
- [x] Pending rounds display (two-row card design)
- [x] Expandable pick details
- [x] Progress bar with race nodes
- [x] Dynamic node states (pending, in-progress, finished)
- [x] Post time display (CT format)
- [x] Hover tooltips with race details
- [x] Pick status circles (white, yellow, green, red)
- [x] Backend matchup population in simulation
- [x] **UUID-based matchup IDs** (globally unique, permanent)
- [x] **Pre-calculation system** (instant results)

#### 🎯 Ready for Testing:
1. Regenerate matchups with UUID IDs
2. Submit new rounds
3. Start simulation
4. Verify pre-calculated results appear instantly

### Phase 4: Pre-Calculated Results ✅ IMPLEMENTED

**Goal**: Calculate round outcomes immediately on submission, simulation just reveals them.

#### ✅ Implementation Complete:
1. **Database Schema**:
   - Added `precalculated_outcome` JSONB column to `entries` table
   - Migration script: `docs/MIGRATION_ADD_PRECALCULATED_OUTCOME.sql`

2. **Outcome Calculator Service**:
   - Created `backend/src/services/outcomeCalculator.ts`
   - Fetches results from `track_data`
   - Calculates points for each connection
   - Determines matchup winners (with tiebreaker)
   - Calculates final winnings (flex-aware)

3. **Entry Submission**:
   - Checks if results available
   - Calls outcome calculator automatically
   - Stores in `precalculated_outcome` column
   - Logs outcome for debugging

4. **Simulation Integration**:
   - Uses pre-calculated data when available
   - Falls back to on-the-fly calculation if not
   - Reveals results progressively for UX
   - Smooth animations

5. **Benefits Achieved**:
   - ⚡ **Instant results** - User knows outcome immediately
   - 🎬 **Smooth simulations** - Just UI animation, not calculation
   - 📊 **Accurate** - Uses real results data
   - 🔄 **Repeatable** - Can replay simulations perfectly
   - 🚀 **Scalable** - No heavy calculation during simulation

### Phase 5: Results Page ⏳ TODO
- [ ] Display completed rounds
- [ ] Show detailed breakdown
- [ ] Filter by won/lost
- [ ] Export/share results
- [ ] Leaderboard (if multi-player)

### Phase 6: Cross-Track Expansion ✅ COMPLETE
- [x] Extended from 4 tracks to 20 tracks
- [x] Updated backend service
- [x] Updated admin UI validation
- [x] Updated API documentation
- [x] Now supports 5, 7, 10+ track combinations

### Phase 7: Flex Bet Logic ⏳ TODO
- [ ] 2 red circles to lose in flex mode
- [ ] 1 red circle to lose in standard mode
- [ ] Correct payout calculation (DONE in pre-calc)
- [ ] Move lost rounds to "Lost" section

---

## 🐛 KNOWN ISSUES

### High Priority:
1. **UUID Migration** 🚧 IN PROGRESS
   - Old matchups have short IDs
   - Need to regenerate all matchups
   - Status: Code fixed, waiting for matchup regeneration

2. **Simulation Matchup Display** 🚧 BLOCKED BY #1
   - Expanded view shows "No matchup details"
   - Cause: ID mismatch (old vs new system)
   - Fix: Regenerate matchups with UUIDs

### Medium Priority:
3. **Duplicate matchup keys warning** ⚠️ MINOR
   - React warning about duplicate keys
   - Doesn't affect functionality
   - Can fix after UUID migration

### Low Priority:
4. **Per-type exclusion warnings** ℹ️ INFO
   - Console warnings about duplicate connections
   - Working as intended (filtering duplicates)
   - Can reduce logging verbosity

---

## 📋 TESTING CHECKLIST

### Before Launch:
- [ ] **End-to-End Flow**:
  1. [ ] Admin creates contest
  2. [ ] Admin fetches track data
  3. [ ] Admin calculates matchups (with UUIDs)
  4. [ ] User selects matchups
  5. [ ] User submits round (with UUID matchup IDs)
  6. [ ] Round appears on Live page with full details
  7. [ ] User starts simulation
  8. [ ] Races run and update in real-time
  9. [ ] Round settles correctly (won/lost)
  10. [ ] Bankroll updates
  11. [ ] Results appear on Results page

- [ ] **Flex Play**:
  - [ ] Can select flex option
  - [ ] Correct multiplier shown
  - [ ] Can miss 1 pick and still win (reduced payout)
  - [ ] 2 misses = loss in flex mode

- [ ] **Cross-Track**:
  - [ ] Can select matchups from multiple tracks
  - [ ] Simulation handles multiple tracks
  - [ ] Results calculated correctly

- [ ] **Edge Cases**:
  - [ ] Scratched horses handled correctly
  - [ ] Tied matchups use tiebreaker (last race finish position)
  - [ ] Insufficient bankroll prevents submission
  - [ ] Locked contests prevent submissions

---

## 🚀 PERFORMANCE OPTIMIZATIONS (Post-Launch)

1. **Caching Strategy**:
   - Redis cache for matchups (5 min TTL)
   - Session storage for user selections
   - LocalStorage for profile data

2. **Database Indexes**:
   - `entries(user_id, contest_id, created_at)`
   - `matchups(contest_id, matchup_type)`
   - `simulations(contest_id, status)`

3. **WebSocket Optimization**:
   - Only send updates for user's rounds
   - Batch race updates
   - Compress simulation state

---

## 📝 NEXT IMMEDIATE ACTIONS

1. **NOW**: Regenerate matchups with UUIDs
2. **THEN**: Test round submission with new IDs
3. **THEN**: Test simulation with new IDs
4. **THEN**: Implement pre-calculation system
5. **THEN**: Complete flex bet logic
6. **FINALLY**: Polish and launch

---

## 💡 FUTURE ENHANCEMENTS (Post-Launch)

- [ ] **Leaderboards** - Rank users by winnings
- [ ] **Contests with Entry Fees** - Real money contests
- [ ] **Live Contests** - Real-time with actual race times
- [ ] **Social Features** - Share picks, follow users
- [ ] **Mobile App** - React Native version
- [ ] **Advanced Stats** - Historical performance, trends
- [ ] **Notifications** - Push notifications for race results
- [ ] **Referral System** - Invite friends, earn bonuses

