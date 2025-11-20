# Simulation Testing Guide

**Purpose:** Step-by-step guide to test the live simulation system  
**Date:** 2025-11-12

---

## Prerequisites

✅ Database migration applied (simulations and simulation_events tables created)  
✅ Backend running with WebSocket support (`npm run dev` in backend folder)  
✅ Frontend running (`npm run dev` in root folder)  
✅ Admin access to create contests

---

## Testing Flow

### Part 1: Create Test Contest (Admin Panel)

1. **Go to Admin Panel** → http://localhost:3000/admin
   
2. **Navigate to "Contests" Tab**
   
3. **Create New Contest:**
   - Click "Create Contest"
   - Track: AQU (or LRL, GP, DMR, CD)
   - Date: **2025-11-09** (important: must be past date with data)
   - Click "Create"

4. **Fetch Track Data:**
   - Find your new contest in the list
   - Click "Fetch Track Data"
   - Wait for data to load (should show races and connections)

5. **Generate Matchups:**
   - Click "Set Matchup Types"
   - Select: Jockeys, Trainers, Sires
   - Set count: 10-20 each
   - Set min salary: 1000
   - Click "Calculate Matchups"
   - Wait for generation to complete

6. **Make Contest Visible:**
   - Click the eye icon to make contest visible (green eye)

---

### Part 2: Make Selections (Matchups Page)

1. **Go to Matchups Page** → http://localhost:3000/matchups
   
2. **Select Contest:**
   - Should auto-select AQU 11/09/2025
   - If not, select it from track dropdown

3. **Pick Matchups:**
   - Select 2-4 matchups (different types if possible)
   - Click "Select" on Set A or Set B for each
   - Watch them appear in "Your picks" panel

4. **Submit Round:**
   - Enter amount (e.g., $10)
   - Select multiplier (keep standard, or try Flex)
   - Click "Play"
   - Should route to /live page

---

### Part 3: Create & Run Simulation

#### Option A: Via Admin Panel (Recommended)

1. **Go to Admin** → **Simulation Tab**
   
2. **Create Simulation:**
   - Select your 11/09/2025 contest
   - Choose speed: 10x (6 seconds per race) for quick testing
   - Click "Create Simulation"

3. **Start Simulation:**
   - Find your simulation in the list
   - Click "Start" button
   - Watch races progress in real-time!

4. **Controls:**
   - **Pause/Resume**: Control simulation flow
   - **Speed**: Change from 1x to 60x
   - **Reset**: Start over from beginning
   - **View Live**: Opens /live page for this simulation

#### Option B: Via Live Page

1. **Go to Live Page** → http://localhost:3000/live
   
2. **Create Simulation:**
   - Click "Create Simulation"
   - Simulation will be created at 10x speed

3. **Start Simulation:**
   - Click "Start" button
   - Watch real-time updates!

---

### Part 4: Watch Live Progress

**What You Should See:**

1. **Control Panel:**
   - Current race number and status
   - Finished/Remaining race count
   - Play/Pause/Reset controls
   - Speed selector

2. **Race Timeline:**
   - All races listed
   - Color-coded status:
     - Grey = Pending
     - Yellow (pulsing) = Running
     - Green = Finished

3. **Your Rounds:**
   - Round cards with matchup progress
   - Points updating in real-time
   - Matchup status (winning/losing/tied)
   - Race nodes showing individual race progress

4. **Real-Time Updates (every race finish):**
   - Race status changes from running → finished
   - Points appear on race nodes
   - Matchup totals update
   - Round status updates (won/lost/in-progress)

---

## What to Test

### Basic Functionality
- [ ] WebSocket connects (see 🟢 Connected)
- [ ] Simulation creates successfully
- [ ] Simulation starts and races begin progressing
- [ ] Races finish at correct intervals (6s at 10x speed)
- [ ] Race status updates (pending → running → finished)

### Points Calculation
- [ ] Points appear when race finishes
- [ ] Matchup totals update correctly
- [ ] Round totals sum correctly
- [ ] Winning/losing status updates

### Controls
- [ ] Pause stops the simulation
- [ ] Resume continues from where it paused
- [ ] Speed change works (try 1x, then 60x)
- [ ] Reset clears all progress

### UI/UX
- [ ] Race nodes show correct status colors
- [ ] Tooltips show race details on hover
- [ ] Matchup cards show correct winner
- [ ] Round cards expand/collapse
- [ ] Progress bars update smoothly

---

## Expected Behavior

### At 10x Speed (6 seconds per race):

```
T+0s    → Simulation starts, Race 1 begins
T+6s    → Race 1 finishes, results appear, points calculated
T+12s   → Race 2 begins
T+18s   → Race 2 finishes
...     → Pattern continues
T+end   → All races finished, rounds settled
```

### Points Calculation:

```
Win (1st place):   10 points
Place (2nd place): 5 points
Show (3rd place):  3 points
Other:             0 points
```

### Matchup Status:

```
Pending:     No races started
In Progress: Some races finished, comparing points
Set A Won:   Set A has more points, all races finished
Set B Won:   Set B has more points, all races finished
Tied:        Equal points, all races finished
```

### Round Status:

```
Pending:     No matchups started
In Progress: Some matchups finished
Won:         All/Required matchups won (3/3 standard, 2/3 flex)
Lost:        Too many matchups lost (1 loss = round lost if not flex)
```

---

## Troubleshooting

### "Failed to connect to simulation server"
- ✅ Check backend is running: `npm run dev` in backend folder
- ✅ Check port 3001 is accessible
- ✅ Check browser console for WebSocket errors

### "No contest selected"
- ✅ Go to matchups page first
- ✅ Select a contest (should auto-select)
- ✅ Check sessionStorage has 'selectedContestId'

### "Simulation not found" or "Contest not found"
- ✅ Verify contest exists for 2025-11-09
- ✅ Check contest has track data fetched
- ✅ Verify matchups are generated

### Races not progressing
- ✅ Check simulation status is "running" (not paused)
- ✅ Check backend logs for timer errors
- ✅ Verify race data exists in track_data table

### Points not calculating
- ✅ Check race results exist (points and place fields)
- ✅ Verify matchup data has connection details
- ✅ Look for errors in backend logs

### WebSocket events not firing
- ✅ Check browser console for socket.io logs
- ✅ Verify subscription to simulation (should see in network tab)
- ✅ Check backend logs for event emission

---

## Success Criteria

✅ Simulation creates without errors  
✅ Races progress at expected speed  
✅ WebSocket updates arrive in real-time  
✅ Points calculate correctly  
✅ Matchup winners determined correctly  
✅ Round status updates (won/lost)  
✅ All controls work (pause/resume/speed/reset)  
✅ UI updates smoothly without lag  

---

## Next Steps After Successful Test

1. Fine-tune UI based on testing
2. Add race detail modal (click on race node)
3. Add matchup comparison view
4. Implement round cancellation (before start)
5. Add notifications/sound effects
6. Optimize performance for multiple simultaneous simulations
7. Prepare for transition to real-time races

---

## Notes

- Use 10x or 20x speed for quick testing
- Use 1x or 2x speed for realistic experience
- Reset simulation anytime to test again
- Multiple users can watch same simulation
- Admin panel shows all simulations, live page shows your rounds only

**Good luck testing! 🚀**

