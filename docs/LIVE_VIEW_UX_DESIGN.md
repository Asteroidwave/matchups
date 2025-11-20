# Live View UX Design - Multi-Round Support

**Date:** 2025-11-15  
**Goal:** Efficiently display and manage 10+ rounds with 2-10 picks each

---

## Problem Statement

Users can have:
- **10+ rounds** active simultaneously
- **2-10 picks** per round
- Each pick has **multiple races** (connections with different race schedules)
- Need to track progress across **100+ individual races**
- Users need **quick overview** AND **detailed drill-down**

---

## Solution: Three-Tier Information Architecture

### Tier 1: Dashboard Overview (Always Visible)
**Purpose:** At-a-glance status of all rounds

```
┌─────────────────────────────────────────────────────┐
│ Live Races - 3 Active Rounds               Sort by: Status ▼ │
├─────────────────────────────────────────────────────┤
│ Summary Cards (Grid)                                │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│ │ 🟢 2 Won  │ │ 🔴 1 Lost │ │ 🟡 7 Live │          │
│ │ +$160     │ │ -$20      │ │ $1,400    │          │
│ └───────────┘ └───────────┘ └───────────┘          │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Quick stats: Won/Lost/Live counts
- Net P&L at top
- Color-coded status
- Click any card to filter

### Tier 2: Round List (Compact Cards)
**Purpose:** Scannable list showing key info per round

**Default View - Collapsed:**
```
┌─────────────────────────────────────────────────────┐
│ 4 Picks  $20  ●●○○  Brittany, Hard, Munnings +1    │
│ $100.00        [2/4 Complete]        Potential $320 │
└─────────────────────────────────────────────────────┘
  ▲                ▲        ▲                ▲
  |                |        |                |
Picks/Amount  Status Dots  Names         Winnings
```

**Visual Elements:**
- **Status Dots**: ● = Won, ○ = Pending, ◐ = Live, ✗ = Lost
- **Progress**: "2/4 Complete" (matchups decided)
- **Color coding**: Green border if winning, red if losing, yellow if live
- **Compact**: Only 2 lines per round

**Sorting Options:**
- Status (Live → Pending → Won → Lost)
- Amount (High → Low)
- Potential Winnings
- Created Time

**Filtering:**
- All / Won / Lost / Live / Pending
- By entry amount range
- By number of picks

### Tier 3: Detailed Round View (Expanded)
**Purpose:** Deep dive into specific round

**When Expanded:**
```
┌─────────────────────────────────────────────────────┐
│ 4 Picks $20  ●●○○  Brittany, Hard, Munnings +1  ▲ │
│ $100.00        [2/4 Complete]        Potential $320 │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ○ Pick 1: Brittany Russell vs Hard Spun            │
│   ┌─────────────────────────────────────────────┐  │
│   │ ✓ Brittany Russell  (Your Pick)     40 pts │  │
│   │ ●──●──●──●──●  [40]                        │  │
│   │   R1 R3 R5 R7 R9                            │  │
│   │                                             │  │
│   │   Hard Spun                          15 pts │  │
│   │ ●──●──●  [15]                               │  │
│   │   R2 R4 R7                                   │  │
│   └─────────────────────────────────────────────┘  │
│                                                     │
│ ○ Pick 2: Munnings vs Twirling Candy               │
│   [Race progress view...]                          │
│                                                     │
│ ◐ Pick 3: Jose Lezcano vs Marcos Meneses (LIVE)   │
│   [Race progress view with pulse animation...]     │
│                                                     │
│ ○ Pick 4: Into Mischief vs Tapit                   │
│   [Race progress view...]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Enhanced Features

### 1. Smart Grouping & Tabs

**Tab Navigation:**
```
[ All (10) ] [ Live (7) ] [ Won (2) ] [ Lost (1) ] [ Pending (0) ]
```

**Auto-Focus:**
- Default to "Live" tab if any rounds are live
- Show "Won" rounds at top when round finishes
- Celebrate wins with confetti animation 🎉

### 2. Race Timeline Visualization

**Timeline Bar (For each round):**
```
Now: 2:45 PM
├─────────┬─────────┬─────────┬─────────┬─────────┤
R1        R3        R5        R7        R9
2:30✓    2:45◐    3:00○    3:15○    3:30○
```

**Features:**
- Shows current time marker
- Race post times
- Status: ✓ (done), ◐ (live), ○ (pending)
- Helps user see when their races run

### 3. Quick Actions

**Per Round:**
- **Cancel** (before first race) - Refund entry
- **Details** - Full drill-down
- **Share** - Share round progress
- **Pin** - Keep at top

**Bulk Actions:**
- **Cancel All Pending** - Quick cleanup
- **Export Results** - Download CSV

### 4. Real-Time Notifications

**Toast Notifications:**
- Race starts: "R5 starting now - Brittany Russell"
- Race ends: "R5 finished - +25 pts!"
- Matchup won: "Pick 1 WON! +40 pts"
- Matchup lost: "Pick 2 lost"
- Round won: "🎉 Round won! +$320"

**Sound Effects:** (Optional)
- Bell when race finishes
- Celebration sound when round wins
- Warning sound when round loses

### 5. Advanced Filtering & Search

**Search Bar:**
```
🔍 Search by connection name, track, or race...
```

**Filters:**
- Track: [All] [AQU] [GP] [LRL] ...
- Status: [All] [Won] [Lost] [Live]
- Amount: [$0-10] [$10-50] [$50-100] [$100+]
- Time: [Last Hour] [Today] [This Week]

### 6. Performance Metrics Dashboard

**Stats Panel (Collapsible):**
```
┌─────────────────────────────────────┐
│ Today's Performance                 │
├─────────────────────────────────────┤
│ Rounds Played:     10               │
│ Win Rate:          70%  (7/10)      │
│ Average Entry:     $15.50           │
│ Net P&L:           +$245.00         │
│ ROI:               158%             │
│ Best Pick:         Munnings (3/3)   │
│ Total Races:       47               │
└─────────────────────────────────────┘
```

### 7. Race Detail Modal (Click on Race Node)

**When clicking a race node:**
```
╔═══════════════════════════════════════╗
║ LRL Race 5 - Results                  ║
╠═══════════════════════════════════════╣
║ 1st: Brittany Russell (Genecho) 25pts║
║ 2nd: Hard Spun (Night Time Nap)  15pts║
║ 3rd: Munnings (Sports Hero)       5pts║
║                                       ║
║ Your Connection: Brittany Russell ✓   ║
║ Opponent: Hard Spun                   ║
║                                       ║
║ [ View Full Results ]                 ║
╚═══════════════════════════════════════╝
```

### 8. Comparison View (Side-by-Side)

**Toggle between:**
- **List View** (default) - Scrollable list of rounds
- **Grid View** - 2x2 or 3x3 grid of round cards
- **Timeline View** - Chronological by race post times

---

## Recommended Layout

### Primary View (Desktop)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                      │
│ Live Races | Sort: Status ▼ | Filter: All ▼ | 🔍 Search   │
├─────────────────────────────────────────────────────────────┤
│ STATS BAR                                                   │
│ 🟢 2 Won (+$160) | 🔴 1 Lost (-$20) | 🟡 7 Live ($1,400)  │
├─────────────────────────────────────────────────────────────┤
│ ROUNDS LIST (Scrollable)                                    │
│                                                             │
│ [Round Card 1 - Expanded]                                   │
│   └─ Full matchup details with race nodes                   │
│                                                             │
│ [Round Card 2 - Collapsed]                                  │
│                                                             │
│ [Round Card 3 - Collapsed]                                  │
│                                                             │
│ ...                                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ FOOTER                                                      │
│ Auto-refresh: ON | Last updated: 2s ago                     │
└─────────────────────────────────────────────────────────────┘
```

### Mobile View

**Stack vertically with:**
- Sticky header with filters
- Collapsible rounds (tap to expand)
- Swipe gestures (swipe left to cancel, swipe right for details)
- Bottom navigation

---

## Smart Features

### 1. Auto-Expand Behavior
- **Auto-expand live rounds** (races currently running)
- **Auto-collapse finished rounds** after 10 seconds
- **Keep user-expanded rounds** open (remember preference)

### 2. Progressive Disclosure
- Show 3 most important rounds initially
- "Load more" button for older rounds
- Infinite scroll option

### 3. Priority Indicators
```
High Value:  💰 (Entry > $50)
Big Winner:  🔥 (Winning > $500)
Close Race:  ⚡ (Point difference < 10)
Live Now:    🔴 (Race running)
```

### 4. Intelligent Grouping

**Auto-group by:**
- **Time slot**: "2:00-3:00 PM Races" (5 rounds)
- **Track**: "AQU Rounds" (3 rounds)
- **Status**: "Live Rounds" (7 rounds)

**User can toggle grouping off**

---

## Information Density Levels

### Level 1: Minimal (Quick Scan)
```
4 Picks $20 ●●○○ Brittany, Hard +2    $320
```
- One line per round
- Essential info only
- Perfect for 10+ rounds

### Level 2: Compact (Current Default)
```
4 Picks $20        ●●○○         $320.00
Brittany, Hard, Munnings +1
```
- Two lines per round
- Shows more context
- Good for 5-10 rounds

### Level 3: Detailed (Expanded)
```
[Full matchup breakdown with race nodes]
```
- All information
- Takes full screen
- For 1-2 rounds at a time

**User can toggle density level in settings**

---

## Additional Recommendations

### 1. Virtual Scrolling
For 10+ rounds with heavy data:
- Only render visible rounds
- Virtualize off-screen rounds
- Improves performance significantly

### 2. Keyboard Shortcuts
```
↑/↓     Navigate rounds
Space   Expand/Collapse
Enter   View details
C       Cancel round
F       Filter
S       Search
```

### 3. Bulk Operations Panel
```
┌─────────────────────────────────┐
│ ☑ Select All (10)               │
│ [ Cancel Selected ] [ Export ]  │
└─────────────────────────────────┘
```

### 4. Race Schedule Overview
**Sidebar (Optional):**
```
┌────────────────┐
│ Upcoming Races │
├────────────────┤
│ 2:45 PM - R5   │
│ ● AQU (3)      │
│ ● GP (2)       │
│                │
│ 3:00 PM - R6   │
│ ● LRL (1)      │
│                │
│ 3:15 PM - R7   │
│ ● AQU (4)      │
└────────────────┘
```

Shows which of your races are coming up

### 5. Live Commentary Feed
**Activity Timeline:**
```
Just now    R5 finished - Brittany Russell 1st! +25pts
1 min ago   R4 started - Hard Spun racing...
2 min ago   Pick 3 WON! Munnings beats Twirling Candy
5 min ago   Round #4 LOST (2/4 matchups)
```

### 6. Smart Alerts
**Configurable notifications:**
- ⚠️ Round at risk (losing 2+ matchups)
- 🔥 Hot streak (3+ rounds won in a row)
- 💰 Big win (>$100)
- 🏁 Next race in 1 minute

---

## Mobile-Specific Features

### Swipe Gestures
- **Swipe left** → Quick cancel
- **Swipe right** → View details
- **Pull down** → Refresh
- **Pull up** → Load more

### Bottom Sheet
```
┌─────────────────────────────────┐
│ Round Details                   │
│ [Swipe down to close]           │
│                                 │
│ [Full matchup details...]       │
│                                 │
└─────────────────────────────────┘
```

### Compact Mode
- Show only active (live) rounds by default
- "Show All" button to see full history
- Floating action button for quick new round

---

## Implementation Priority

### Phase 1 (Now - Essential)
1. ✅ Collapsible round cards
2. ✅ Status indicators (circles)
3. ✅ Potential winnings display
4. ✅ Race nodes in expanded view
5. ✅ Filter/Sort controls (wired to new pick-tracking metadata so selections stay accurate across tabs)
6. ⏳ Search functionality (needs wiring to new data model)

### Phase 2 (Next - High Value)
1. Summary stats cards
2. Auto-expand live rounds
3. Race detail modal
4. Bulk actions
5. Virtual scrolling (if needed)

### Phase 3 (Later - Nice to Have)
1. Keyboard shortcuts
2. Activity feed
3. Smart alerts
4. Race schedule sidebar
5. Export functionality

---

## Recommended UI Changes

### 1. Add Filter Bar
```tsx
<div className="flex items-center gap-4 mb-4">
  <Select value={filter} onValueChange={setFilter}>
    <SelectItem value="all">All Rounds</SelectItem>
    <SelectItem value="live">Live Only</SelectItem>
    <SelectItem value="won">Won</SelectItem>
    <SelectItem value="lost">Lost</SelectItem>
    <SelectItem value="pending">Pending</SelectItem>
  </Select>
  
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectItem value="status">Sort by Status</SelectItem>
    <SelectItem value="amount">Sort by Amount</SelectItem>
    <SelectItem value="time">Sort by Time</SelectItem>
  </Select>
  
  <Input 
    placeholder="Search connections..." 
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />
</div>
```

### 2. Add Summary Stats
```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <Card className="p-4 bg-green-50 border-green-500">
    <div className="text-3xl font-bold text-green-600">{wonRounds}</div>
    <div className="text-sm text-green-700">Won (+${totalWinnings})</div>
  </Card>
  
  <Card className="p-4 bg-red-50 border-red-500">
    <div className="text-3xl font-bold text-red-600">{lostRounds}</div>
    <div className="text-sm text-red-700">Lost (-${totalLosses})</div>
  </Card>
  
  <Card className="p-4 bg-yellow-50 border-yellow-500">
    <div className="text-3xl font-bold text-yellow-600">{liveRounds}</div>
    <div className="text-sm text-yellow-700">Live (${livePotential})</div>
  </Card>
</div>
```

### 3. Improve Race Node Detail
**Hover tooltip should show:**
- Horse name
- Jockey/Trainer/Sire
- Odds
- Post time
- Current position (if live)
- Points scored (if finished)

**Click should open modal with:**
- Full race results
- Your connection vs opponent
- Replay option (future)

### 4. Add Progress Ring Animation
```tsx
<CircularProgress 
  value={matchupsCompleted / totalMatchups * 100}
  size="lg"
  color={isWinning ? 'green' : 'red'}
>
  {matchupsCompleted}/{totalMatchups}
</CircularProgress>
```

### 5. Implement "Focus Mode"
**Button to:**
- Hide all finished rounds
- Show only live + pending
- Full-screen the live action
- Minimal distractions

---

## Data Optimization

### For 10 rounds x 10 picks x 5 races = 500 race updates

**Strategy:**
1. **Lazy load** round details (only load when expanded)
2. **Memoize** computed values (won/lost counts, totals)
3. **Debounce** WebSocket updates (batch every 500ms)
4. **Virtual list** if >20 rounds
5. **Pagination** for history (load 10 at a time)

---

## User Flow Examples

### Scenario 1: Power User (10 active rounds)
1. **Lands on Live page** → Sees summary stats
2. **Scans round list** → 7 live, 2 won, 1 lost
3. **Filters to "Live"** → Shows only 7 active
4. **Sorts by "Potential Winnings"** → Highest stakes first
5. **Expands top round** → Sees detailed race progress
6. **Watches specific matchup** → Sees real-time updates
7. **Round finishes** → Toast notification, auto-collapses, moves to Won tab

### Scenario 2: Casual User (2-3 rounds)
1. **Lands on Live page** → Sees all rounds expanded by default
2. **Watches progress** → All info visible
3. **Clicks race node** → Sees race detail modal
4. **Round finishes** → Celebration animation

### Scenario 3: Analysis/Review
1. **Goes to "Won" tab** → Reviews past wins
2. **Clicks "Export"** → Downloads CSV
3. **Reviews patterns** → Which connections perform best
4. **Plans next round** → Makes informed picks

---

## Implementation Files

### New Components to Create:
1. `LiveDashboardStats.tsx` - Summary cards
2. `RoundFilters.tsx` - Filter/sort/search bar
3. `RaceDetailModal.tsx` - Race result popup
4. `RaceScheduleSidebar.tsx` - Upcoming races
5. `ActivityFeed.tsx` - Live commentary
6. `ProgressRing.tsx` - Circular progress indicator

### Components to Enhance:
1. `RoundProgressCard.tsx` - Add more compact mode
2. `RaceNode.tsx` - Better tooltips, click handlers
3. `MatchupProgressLine.tsx` - Smoother animations

---

## Next Steps

**Immediate (This Session):**
1. ✅ Update collapsed view to match results page
2. ✅ Add filter/sort controls
3. ✅ Improve expanded view with race nodes
4. Add summary stats cards
5. Implement search functionality

**Short Term (Next Session):**
1. Race detail modal
2. Auto-expand live rounds
3. Notifications/toasts
4. Better animations

**Long Term:**
1. Performance optimizations
2. Mobile responsiveness
3. Keyboard shortcuts
4. Export functionality

---

**What do you think? Should I implement these features now, or do you have other priorities?**

