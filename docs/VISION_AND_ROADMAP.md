# Vision & Roadmap Document
**Last Updated:** 2025-01-XX  
**Status:** Planning Phase

## Executive Summary

Transform the matchups platform from a contest-based lobby system into a direct, multi-track experience similar to Underdog's sports selection model. Key focus: remove lobby, enable cross-track matchups, implement live progress tracking, and create a polished user experience.

---

## Current State Assessment

### Tech Stack
- **Frontend:** Next.js 13 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Databases:** 
  - MongoDB (race entries/results from Equibase)
  - Supabase PostgreSQL (contests, matchups, users, entries)
- **Cache:** Upstash Redis
- **Deployment:** Vercel (frontend), Railway (backend)
- **UI Components:** Radix UI, Shadcn

### GitHub Status
- **Remote:** `origin https://github.com/Asteroidwave/project.git`
- **Current Branch:** `develop`
- **Other Branches:** `main`, `testing`
- **Connection:** HTTPS (may need PAT for pushes)
- **Status:** Many uncommitted changes on `develop`

### Project Structure
```
project/
├── app/              # Next.js pages
│   ├── matchups/     # Main matchups page
│   ├── lobby/        # TO BE REMOVED
│   ├── live/         # Live progress (needs work)
│   ├── results/      # Results page
│   └── admin/        # Admin panel
├── backend/          # Express API
├── components/       # React components
├── contexts/         # React contexts (AppContext, AuthContext)
├── lib/              # Utilities
├── docs/             # Documentation
└── legacy/           # Reference from GitHub repo
```

---

## Vision: Feature Requirements

### Phase 1: Core UX Transformation

#### 1.1 Remove Lobby → Direct Matchups Landing
**Goal:** Users land directly on matchups page, no lobby step.

**Changes:**
- Remove `/lobby` route
- Make `/matchups` the default landing page (or `/`)
- Remove lobby-related navigation
- Update routing logic in `AppContext` to load matchups directly

**Admin Impact:**
- Track visibility controls move to admin panel
- When track is "hidden", it doesn't appear in track selector
- Admin can still manage contests, but users don't see lobby

---

#### 1.2 Multi-Track Selection UI (Underdog-Style)
**Goal:** Track selector at top of Players panel, similar to Underdog's sports tabs.

**UI Design:**
```
[Players Panel Header]
┌─────────────────────────────────────────┐
│ Players    [Reload]                     │
├─────────────────────────────────────────┤
│ [BAQ] [GP] [KEE] [SA] [CD] [Mixed]    │ ← Track tabs
│ [All] [Jockeys] [Trainers] [Sires] [Mixed] │ ← Matchup type tabs
│ [Sort: Salary ↑]                        │
└─────────────────────────────────────────┘
```

**Behavior:**
- Click track → filter matchups to that track
- Click "Mixed" → show cross-track matchups (connections from different tracks)
- Track tabs show only visible tracks (admin-controlled)
- Matchup type tabs filter by type within selected track(s)

**Implementation:**
- Move track selection from lobby to matchups page
- Store selected track(s) in `sessionStorage` or URL params
- Update `AppContext.loadData()` to handle track selection
- Update `StartersWindow` to show selected track(s)

---

#### 1.3 Enhanced Filtering System
**Goal:** Replicate and improve legacy filtering behavior.

**Features:**
1. **Connected Horses Button**
   - Toggle shows only horses with connections in matchups
   - Highlights connection names in starters panel (emerald background)
   - Click highlighted name → scroll to matchup in players panel

2. **Connection Name Click (Players Panel)**
   - Click connection name → filter starters panel to that connection's horses
   - Multi-select: Click multiple connections → different colors per connection
   - If connections are in same matchup (opposing sets), use distinct colors
   - Clear filter: Click again, or "Clear All", or "x" on filter chip

3. **Multi-Color Highlighting**
   - Connection 1: Emerald (`bg-emerald-100`, `border-emerald-400`)
   - Connection 2: Blue (`bg-blue-100`, `border-blue-400`)
   - Connection 3: Amber (`bg-amber-100`, `border-amber-400`)
   - Connection 4+: Cycle through palette

**Implementation:**
- Already partially implemented in `StartersWindow.tsx`
- Need to ensure color differentiation works correctly
- Update `app/matchups/page.tsx` to handle multi-select state

---

#### 1.4 Search Functionality
**Goal:** Search connections by name in Players panel.

**UI:**
- Search bar at top of Players panel (below header, above track/matchup type tabs)
- Real-time filtering as user types
- Search across all connection types (jockey, trainer, sire)
- Highlight matching text in results

**Implementation:**
- Add search input to `app/matchups/page.tsx`
- Filter `matchups` array based on connection names
- Use `useMemo` for performance

---

### Phase 2: Multi-Track Matchup Generation

#### 2.1 Cross-Track Matchup Types
**Goal:** Generate matchups where connections come from different tracks.

**Example:**
- Jockey from BAQ vs Jockey from GP
- Trainer from KEE vs Trainer from SA
- Mixed: Jockey (BAQ) vs Trainer (GP) vs Sire (SA)

**Admin Configuration:**
- New setting: "Allow Cross-Track Matchups"
- When enabled, matchup generation considers all visible tracks
- When disabled, only single-track matchups (current behavior)

**Backend Changes:**
- Update `matchupCalculation.ts` to accept `allowCrossTrack: boolean`
- Modify `generateConnections()` to merge connections from multiple tracks
- Ensure salary/appearance calculations work across tracks

**Frontend Changes:**
- "Mixed" track button triggers cross-track matchup loading
- Update `AppContext.loadData()` to handle cross-track requests

---

#### 2.2 Track Visibility Controls (Admin)
**Goal:** Admin can hide/show tracks without deleting contests.

**Admin UI:**
- Track management panel shows visibility toggle
- Hidden tracks don't appear in track selector
- Hidden tracks' contests still exist but aren't accessible to users

**Implementation:**
- Add `is_visible` column to `tracks` table (or use contest visibility)
- Filter tracks in frontend based on visibility
- Update admin panel to toggle visibility

---

### Phase 3: Multiplier & Flex System

#### 3.1 50/50 Bet Logic
**Goal:** Each matchup is a 50/50 bet. Calculate multipliers accordingly.

**Current Issue:**
- Multiplier schedule may not reflect true 50/50 odds
- Flex mechanism unclear

**Proposed Logic:**
- **Standard:** All picks must win
  - 2 picks: 3.0x (50% × 50% = 25% chance, so 4x true odds, but with house edge → 3x)
  - 3 picks: 6.0x (12.5% chance → 8x true, 6x with edge)
  - 4 picks: 10.0x
  - 5 picks: 20.0x
  - etc.

- **Flex (All Win):** Slightly lower payout (all picks win)
  - 2 picks: 1.8x
  - 3 picks: 2.25x
  - etc.

- **Flex (One Miss):** Reduced payout (one pick can lose)
  - 2 picks: 1.25x
  - 3 picks: 1.25x
  - etc.

**Implementation:**
- Update multiplier schedule in `app/matchups/page.tsx`
- Ensure backend tracks multiplier type (standard/flex_all_win/flex_one_miss)
- Update results calculation to handle flex outcomes

---

#### 3.2 Flex Outcome Tracking
**Goal:** Track which picks won/lost for flex bets.

**Database:**
- `entries` table already has `picks` (JSONB)
- Add `multiplier_type` field: `standard | flex_all_win | flex_one_miss`
- Calculate winnings based on multiplier type and outcomes

**Results Page:**
- Show which picks won/lost
- For flex_one_miss: Show which pick was the "miss" (if any)
- Calculate final payout correctly

---

### Phase 4: Post Time & Race Scheduling

#### 4.1 Post Time Display
**Goal:** Show race post times in connection modal and comparison modal.

**UI:**
- Connection Modal: Show post time for each starter
- Comparison Modal: Show post times for both sets
- Sort by post time option

**Implementation:**
- `Starter` interface already has `postTime?: string | null`
- Display in modals
- Add sorting by post time in `StartersWindow`

---

#### 4.2 Race Time Filtering (Optional)
**Goal:** Filter matchups by race times (early/mid/late races).

**Consideration:**
- May be too complex for initial release
- Could be added later if users request it

**If Implemented:**
- Add filter dropdown: "All Races", "Early (Races 1-3)", "Mid (Races 4-6)", "Late (Races 7-9)"
- Filter matchups based on when connections' races occur

---

### Phase 5: Live Progress & Round Management

#### 5.1 Routing After Submission
**Goal:** After clicking "Play", route to Live page (not Results).

**Current:** Routes to `/results`  
**Desired:** Route to `/live`

**Implementation:**
- Update `handleSubmit` in `app/matchups/page.tsx`
- Change `router.push("/results")` to `router.push("/live")`

---

#### 5.2 "My Picks" / "Upcoming Rounds" Page
**Goal:** Users can see all their active rounds, edit, or cancel.

**Features:**
- List of rounds (upcoming, live, completed)
- For upcoming: Edit picks, cancel round (refund bankroll)
- For live: View progress
- For completed: View results

**UI:**
- New page: `/my-picks` or `/rounds`
- Card-based layout showing each round
- Actions: Edit, Cancel, View Details

**Implementation:**
- New API endpoint: `GET /api/entries?userId=...`
- Filter by status: `pending | live | completed`
- Update bankroll on cancel (before contest locks)

---

#### 5.3 Live Page Redesign
**Goal:** Show real-time progress of user's rounds.

**Main View:**
```
┌─────────────────────────────────────┐
│ My Rounds                            │
├─────────────────────────────────────┤
│ Round 1: $10 entry, 4 picks         │
│ [✓] [✓] [🟡] [ ]                    │ ← Status indicators
│                                     │
│ Round 2: $25 entry, 3 picks        │
│ [✓] [✓] [✓]                         │
└─────────────────────────────────────┘
```

**Round Detail View (Dropdown/Modal):**
```
┌─────────────────────────────────────┐
│ Round 1 - $10 entry                 │
├─────────────────────────────────────┤
│ Matchup 1: Jockey A vs Jockey B    │
│ [Progress Bar with Nodes]           │
│ ●──●──●──🟡──○──○                   │
│ Points: 45                          │
│                                     │
│ [Your Set] vs [Opponent Set]        │
│                                     │
│ Race 1: ✅ Won (15 pts)             │
│ Race 2: ✅ Won (12 pts)             │
│ Race 3: 🟡 In Progress              │
│ Race 4: ⏳ Upcoming (2:30 PM)      │
└─────────────────────────────────────┘
```

**Node Hover:**
- Show race details: Horse name, post time, current status
- Show points earned (if completed)

**Color Coding:**
- **Green (✓):** Won matchup (or won individual race)
- **Yellow (🟡):** In progress (race happening now)
- **Red (✗):** Lost matchup (or lost individual race)
- **Gray (○):** Upcoming (race hasn't started)

**Flex Logic:**
- Standard: One red = entire round lost → move to results
- Flex (one miss): One red = continue, two reds = round lost

**Implementation:**
- Update `app/live/page.tsx` with new design
- Poll backend for race results (or use WebSockets if available)
- Calculate progress in real-time
- Show/hide detail view on round click

---

#### 5.4 Comparison View in Live Page
**Goal:** Detailed view of matchup progress with race-by-race breakdown.

**Features:**
- Side-by-side comparison: Your Set vs Opponent Set
- Past races: Show results, points, winners
- Current race: Live updates
- Upcoming races: Post times, horses, connections
- Toggle between matchups in same round (carousel with arrows)

**UI:**
- Modal or expandable section
- Tabs or carousel for multiple matchups
- Race cards showing details

**Implementation:**
- New component: `LiveMatchupDetail.tsx`
- Fetch race results from backend
- Calculate points in real-time
- Update UI as races complete

---

### Phase 6: Simulation & Testing

#### 6.1 Past Race Simulation
**Goal:** Test live page with historical data before going live.

**Approach:**
- Use past contest dates (e.g., 2025-11-02)
- Simulate "live" updates by replaying race results with delays
- Allow admin to control simulation speed

**Implementation:**
- New admin page: `/admin/simulate`
- Select past contest date
- Start simulation → races "complete" at intervals
- Users can watch live page update in real-time

---

#### 6.2 Testing Strategy
**Goal:** Ensure all features work before production.

**Test Cases:**
1. Multi-track selection and filtering
2. Cross-track matchup generation
3. Multi-select connection highlighting
4. Search functionality
5. Multiplier calculations (standard and flex)
6. Live page progress tracking
7. Round cancellation and editing
8. Post time display and sorting

---

## Implementation Priority

### Must Have (MVP)
1. ✅ Remove lobby, direct matchups landing
2. ✅ Multi-track selection UI (Underdog-style)
3. ✅ Enhanced filtering (connected horses, multi-select)
4. ✅ Search functionality
5. ✅ Fix multiplier/flex system
6. ✅ Route to live page after submission
7. ✅ Basic live page with progress indicators

### Should Have (Phase 1)
8. Cross-track matchup generation
9. Post time display in modals
10. "My Picks" page for round management
11. Live page detail view with nodes

### Nice to Have (Phase 2)
12. Race time filtering
13. Comparison view in live page
14. Simulation mode for testing
15. Advanced admin controls

---

## GitHub Strategy

### Branching Plan
```
main          → Production-ready code
├── develop   → Current development (where we are now)
├── feature/* → Feature branches (e.g., feature/multi-track-ui)
└── testing   → Testing branch for QA
```

### Recommended Workflow
1. **Create feature branch from develop:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/multi-track-ui
   ```

2. **Work on feature, commit regularly:**
   ```bash
   git add .
   git commit -m "feat: add multi-track selection UI"
   ```

3. **Push to remote:**
   ```bash
   git push origin feature/multi-track-ui
   ```

4. **Merge to develop when ready:**
   - Create PR on GitHub
   - Review and merge
   - Delete feature branch

5. **Merge develop to main when stable:**
   - After thorough testing
   - Tag release

### Current Status
- **Branch:** `develop`
- **Uncommitted changes:** Many files modified
- **Action needed:** Commit current work or stash it

**Recommendation:**
```bash
# Save current work
git add .
git commit -m "feat: port legacy filtering features and multi-track support"

# Or create a feature branch
git checkout -b feature/legacy-features-port
git add .
git commit -m "feat: port legacy filtering and multi-track"
```

---

## Project Cleanup

### Files to Remove/Archive
- `ARCHITECTURE_PLAN.md` (already deleted, good)
- `DEPLOY.md` (already deleted)
- `PROJECT_STRUCTURE.md` (already deleted)
- `legacy/github-main/` → Keep for reference, but document it
- `other codes/` → Archive Python scripts (reference only)
- Multiple `.md` files in root → Move to `docs/archive/` or consolidate

### Code to Refactor
- **Complex functions:** Break down high cognitive complexity
- **Redundant code:** Remove duplicate logic
- **Unused components:** Delete or archive
- **Type safety:** Ensure all `any` types are properly typed

### Recommended Structure
```
project/
├── app/                    # Next.js pages
├── backend/                # Express API
├── components/             # React components
│   ├── admin/             # Admin components
│   ├── auth/              # Auth components
│   ├── cards/             # Card components
│   ├── modals/            # Modal components
│   ├── ui/                # Shadcn UI components
│   └── windows/           # Window components
├── contexts/              # React contexts
├── lib/                   # Utilities
│   ├── api/              # API clients
│   ├── auth/             # Auth utilities
│   └── utils/            # General utilities
├── docs/                  # Documentation
│   ├── archive/          # Old docs
│   └── migrations/       # SQL migrations
├── types/                 # TypeScript types
└── public/                # Static assets
```

---

## Next Steps

### Immediate (This Week)
1. **Commit current work:**
   ```bash
   git add .
   git commit -m "feat: port legacy features and multi-track support"
   git push origin develop
   ```

2. **Create feature branch for Phase 1:**
   ```bash
   git checkout -b feature/remove-lobby-multi-track-ui
   ```

3. **Start implementation:**
   - Remove lobby page
   - Add track selector to matchups page
   - Implement multi-track filtering

### Short Term (Next 2 Weeks)
4. Complete Phase 1 features (filtering, search, multipliers)
5. Test thoroughly
6. Merge to develop

### Medium Term (Next Month)
7. Implement Phase 2 (cross-track matchups)
8. Build Phase 3 (live page)
9. Add simulation mode

---

## Questions & Decisions Needed

1. **GitHub Authentication:** Do you have a PAT set up? If not, we should set one up for secure pushes.

2. **Branching Strategy:** Do you want to keep `main` as production, or merge `develop` directly?

3. **Live Updates:** WebSockets or polling? (Polling is simpler, WebSockets are more real-time)

4. **Simulation:** Should it be admin-only or available to all users for testing?

5. **Multi-Track Matchups:** Should they be a separate matchup type, or automatically included when "Mixed" track is selected?

---

## Notes

- Reference implementation in `legacy/github-main/` for UI patterns
- Keep documentation in `docs/` organized and up-to-date
- Test each feature thoroughly before moving to next phase
- Consider user feedback as we build

---

**This is a living document. Update as we progress.**

