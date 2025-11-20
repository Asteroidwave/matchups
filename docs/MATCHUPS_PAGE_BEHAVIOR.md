# Matchups Page - Button & Filter Behavior Documentation

**Last Updated:** 2025-01-XX  
**Purpose:** Comprehensive guide to all button clicks, filter interactions, and state changes on the matchups page.

---

## Table of Contents
1. [View Mode Buttons (Starters Panel)](#view-mode-buttons)
2. [Connection Name Clicks](#connection-name-clicks)
3. [Filter Interactions](#filter-interactions)
4. [Matchup Type Tabs](#matchup-type-tabs)
5. [Selection State](#selection-state)
6. [Color System](#color-system)

---

## View Mode Buttons (Starters Panel)

### "Horses" Button
**Location:** Starters panel, top tabs  
**Default State:** Active (selected)

**Behavior:**
- Shows all horses from all races
- No filtering by connections
- Connection names are clickable (if they appear in matchups)
- Clicking a connection name scrolls to that connection in Players panel

**When Clicked:**
- Switches view from "Connected Horses" to "Horses"
- Clears all connection filters
- Shows all horses (no filtering)

---

### "Connected Horses" Button
**Location:** Starters panel, top tabs  
**Default State:** Inactive

**Behavior:**
- Shows only horses where the jockey/trainer/sire appears in at least one matchup
- Highlights connection names that are in matchups (blue background: `bg-[var(--blue-50)]`, `border-[var(--brand)]`)
- Connection names are ONLY clickable when:
  1. Connected Horses view is active (`viewMode === "connected"`)
  2. The connection is highlighted (appears in matchups)
  3. No filters are active from Players panel
- Clicking a highlighted connection name scrolls to that connection in Players panel (does NOT filter starters)

**When Clicked:**
- Switches view from "Horses" to "Connected Horses"
- Clears all connection filters
- Shows only horses with connections that appear in matchups
- Highlights connection names in blue

**When Clicked Again (Toggle Off):**
- Switches back to "Horses" view
- Clears all filters
- Shows all horses

---

## Connection Name Clicks

### Clicking Connection Name in Players Panel
**Location:** Players panel, within a matchup card

**Behavior:**
- **If NOT in Connected Horses view:**
  - Filters starters panel to show only horses for that connection
  - Highlights the connection name in starters panel (blue)
  - Scrolls to the matchup containing that connection
  - "Horses" button remains active
  - Connection name becomes a filter (shown in "FILTERING BY" section)

- **If in Connected Horses view:**
  - Filters starters panel to show only horses for that connection
  - Highlights the connection name in starters panel (with assigned color)
  - Scrolls to the matchup containing that connection
  - **"Connected Horses" button stays active**
  - Connection name becomes a filter (shown in "FILTERING BY" section)

**Toggle Behavior:**
- Clicking the same connection name again removes the filter
- If in Connected Horses view and removing the last filter, returns to Connected Horses view (shows all connected horses)
- If not in Connected Horses view and removing the last filter, returns to Horses view (shows all horses)

---

### Clicking Connection Name in Starters Panel
**Location:** Starters panel, within a horse entry

**Behavior:**
- **If in "Horses" view:**
  - Connection names are NOT clickable
  - Connection names are only visible but not interactive

- **If in "Connected Horses" view:**
  - Connection names are ONLY clickable if:
    1. They are highlighted (appear in matchups)
    2. No filters are active from Players panel
  - Clicking a highlighted connection name scrolls to that connection in Players panel
  - **Does NOT filter starters panel**
  - Only highlights and scrolls

**Important:** 
- Connection names in starters panel are ONLY clickable when Connected Horses is active AND the name is highlighted
- Clicking connection names in starters panel should NEVER filter the starters panel. It only scrolls/highlights in the Players panel.

---

## Filter Interactions

### "FILTERING BY" Section
**Location:** Starters panel, below view mode buttons

**When Filters Are Active:**
- Shows active filter chips (connection names)
- Each chip has an 'X' button to remove that filter
- "Clear all" button removes all filters

**Filter Removal:**
- Clicking 'X' on a filter chip:
  - Removes that specific filter
  - If last filter removed:
    - If in Connected Horses view → returns to Connected Horses view (shows all connected horses)
    - If not in Connected Horses view → returns to Horses view (shows all horses)

- Clicking "Clear all":
  - Removes all filters
  - Returns to appropriate view (Connected Horses or Horses)

---

### Multi-Select Filtering
**Behavior:**
- Can select multiple connections in Players panel
- Each selected connection gets a unique color:
  1. Blue
  2. Emerald
  3. Purple
  4. Orange
  5. Pink
  6. Cyan
  7. Amber
  8. Indigo
- Colors are assigned in sorted order (stable assignment)
- Selected connections are highlighted in starters panel with their assigned colors
- Connection names in starters panel are NOT clickable when filters are active

**Color Assignment:**
- Colors are assigned based on sorted connection IDs
- Ensures same connections always get same colors
- Prevents color conflicts

---

## Matchup Type Tabs

### Tabs: "All", "Jockeys", "Trainers", "Sires", "Mixed"
**Location:** Players panel, below track selector

**Behavior:**
- Filters matchups by type
- Selection state is scoped by matchup type
- Selecting a matchup in "Jockeys" tab does NOT show as selected in "Trainers" tab

**Selection Scoping:**
- Selections are stored with type prefix: `jockey_vs_jockey-matchup-1`, `trainer_vs_trainer-matchup-1`
- In "All" tab, selections use the matchup's actual type for scoping (e.g., `jockey_vs_jockey-matchup-1`)
- Prevents cross-tab selection persistence
- Each tab maintains its own selection state

**Mixed Tab Filtering:**
- Mixed tab ONLY shows truly mixed matchups (cross-role)
- Excludes: `jockey_vs_jockey`, `trainer_vs_trainer`, `sire_vs_sire`
- Only shows matchups where `matchupType === 'mixed'`

---

## Selection State

### Selecting a Matchup Set
**Location:** Players panel, "Select" button on a matchup card

**Behavior:**
- Clicking "Select" on Set A or Set B:
  - Highlights the selected set (green flash animation)
  - Adds to "Your picks" panel
  - Selection is scoped by matchup type

- Clicking "Select" again:
  - Deselects the set
  - Removes from "Your picks" panel

**Selection Persistence:**
- Selections persist when switching between matchup type tabs
- Each tab shows its own selections
- Selecting same matchup in different tabs creates separate selections

---

## Color System

### Connection Highlight Colors

**In Starters Panel:**
- **Selected connections (from Players panel):**
  - Multi-color system (blue, emerald, purple, orange, pink, cyan, amber, indigo)
  - Each selected connection gets a unique color
  - Colors assigned in sorted order for stability

- **Connected Horses highlight:**
  - Blue background (`bg-[var(--blue-50)]`)
  - Blue border (`border-[var(--brand)]`)
  - Blue text (`text-[var(--brand)]`)
  - NOT emerald/green

**In Players Panel:**
- **Highlighted connection:**
  - Default blue (same as old version)
  - `bg-[var(--blue-50)]` and `border-[var(--brand)]`

---

## State Flow Diagrams

### Scenario 1: Click "Connected Horses" Button
```
[Horses View] 
  ↓ Click "Connected Horses"
[Connected Horses View]
  - Shows only horses with connections in matchups
  - Highlights connection names in blue
  - Connection names are clickable
  ↓ Click connection name in starters
[Scrolls to Players panel]
  - Does NOT filter starters
  - Only highlights/scrolls
```

### Scenario 2: Click Connection Name in Players Panel (Normal View)
```
[Horses View, No Filters]
  ↓ Click "Jose Lezcano" in Players panel
[Horses View, Filtered by "Jose Lezcano"]
  - Starters panel shows only Jose Lezcano's horses
  - "FILTERING BY: Jose Lezcano" appears
  - "Horses" button stays active
  ↓ Click "Jose Lezcano" again
[Horses View, No Filters]
  - Returns to showing all horses
```

### Scenario 3: Click Connection Name in Players Panel (Connected Horses View)
```
[Connected Horses View, No Filters]
  - Shows all horses with connections in matchups
  ↓ Click "Jose Lezcano" in Players panel
[Connected Horses View, Filtered by "Jose Lezcano"]
  - Starters panel shows only Jose Lezcano's horses
  - "FILTERING BY: Jose Lezcano" appears
  - "Connected Horses" button stays active
  ↓ Click "Jose Lezcano" again
[Connected Horses View, No Filters]
  - Returns to showing all connected horses
  - "Connected Horses" button still active
```

### Scenario 4: Multi-Select Connections
```
[Horses View, No Filters]
  ↓ Click "Jose Lezcano" in Players panel
[Horses View, Filtered by "Jose Lezcano" (Blue)]
  ↓ Click "Sahin Civaci" in Players panel
[Horses View, Filtered by "Jose Lezcano" (Blue) + "Sahin Civaci" (Emerald)]
  - Both connections highlighted with different colors
  - Starters panel shows horses for both connections
  - Connection names in starters are NOT clickable
```

---

## Common Issues & Fixes

### Issue: "Connected Horses" button not working
**Symptoms:** Clicking button doesn't change view or show connected horses

**Fix:**
- Ensure `handleViewModeChange` properly toggles view mode
- Check that `viewMode` state is being updated
- Verify `shouldHighlightConnected` function is working

### Issue: Clicking connection in starters panel filters when it shouldn't
**Symptoms:** Clicking connection name in starters filters the starters panel

**Fix:**
- Ensure `fromConnectedHorsesView` parameter is passed correctly
- Check that `scrollToMatchupForConnection` doesn't filter when `fromConnectedHorsesView === true`
- Verify `handleConnectionNameClickInStarters` only scrolls, doesn't filter

### Issue: Colors not working for multiple connections
**Symptoms:** Two different connections get same color

**Fix:**
- Ensure `connectionColorMap` sorts connection IDs before assigning colors
- Check that `getConnectionColor` correctly looks up colors by connection ID
- Verify connection IDs are unique and stable

### Issue: Selection persists across tabs
**Symptoms:** Selecting matchup in "Jockeys" shows as selected in "Trainers"

**Fix:**
- Ensure selections are scoped by matchup type: `${matchupType}-${matchupId}`
- Check that `handleSelect` creates scoped keys
- Verify `selectedPicks` handles both scoped and unscoped keys

---

## Testing Checklist

- [ ] "Horses" button shows all horses
- [ ] "Connected Horses" button shows only connected horses
- [ ] Clicking connection in starters panel scrolls but doesn't filter
- [ ] Clicking connection in players panel filters starters
- [ ] Multiple connections get different colors
- [ ] Selections don't persist across matchup type tabs
- [ ] Connected Horses + connection name click keeps Connected Horses active
- [ ] Toggling connection filter removes it correctly
- [ ] Clear all filters returns to appropriate view

---

## Notes

- All connection name clicks in starters panel should ONLY scroll/highlight, never filter
- Filtering should only happen when clicking connection names in Players panel
- Colors are assigned in sorted order for stability
- Selections are scoped by matchup type to prevent cross-tab persistence
- Connected Horses view state is tracked separately from filter state

---

**This is a living document. Update as behavior changes!**

