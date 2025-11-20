# Simulation Setup Guide

## Step 1: Run Database Migration

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the contents of `docs/MIGRATION_SIMULATION.sql`
4. Verify tables created: `simulations`, `simulation_events`

## Step 2: Create Test Contest

1. Go to Admin panel
2. Create a contest for **2025-11-09** with one of these tracks:
   - LRL (Laurel)
   - GP (Gulfstream Park)
   - DMR (Del Mar)
   - CD (Churchill Downs)
   - AQU (Aqueduct)

3. Fetch track data
4. Generate matchups (any settings you want to test)
5. Make contest visible

## Step 3: Make Selections

1. Go to matchups page
2. Select the 11/09/2025 contest
3. Pick 2-4 matchups
4. Submit your round

## Step 4: Start Simulation

### Option A: Via API (Postman/curl)
```bash
# Create simulation
curl -X POST http://localhost:3001/api/simulation/create \
  -H "Content-Type: application/json" \
  -d '{
    "contestId": "YOUR_CONTEST_ID",
    "date": "2025-11-09",
    "speedMultiplier": 10,
    "autoStart": false
  }'

# Start simulation (use ID from response)
curl -X POST http://localhost:3001/api/simulation/SIMULATION_ID/start
```

### Option B: Via Admin Panel (Coming Soon)
- Go to Admin > Simulations
- Select contest
- Click "Create Simulation"
- Adjust speed (1x, 2x, 5x, 10x)
- Click "Start"

### Option C: Via Live Page
- Go to /live
- Click "Create Simulation"
- Controls will appear

## Step 5: Watch Live Updates

1. Go to /live page
2. You should see:
   - Simulation controls (Play/Pause/Reset/Speed)
   - Race timeline with status
   - Your round progress
   - Real-time updates as races finish

## Speed Settings

- **1x**: 1 minute per race (2 min total with break) - realistic
- **2x**: 30 seconds per race - faster testing
- **5x**: 12 seconds per race - quick testing
- **10x**: 6 seconds per race - very fast
- **20x**: 3 seconds per race - instant

## Simulation Flow

```
Time    Event
------- --------------------------------------------------------
T+0     Simulation starts, Race 1 scheduled
T+0     Race 1 starts (status: running)
T+1min  Race 1 finishes, results revealed, points calculated
T+2min  Race 2 starts
T+3min  Race 2 finishes
...     Pattern continues for all races
T+end   Simulation finished, all rounds settled
```

## WebSocket Events You'll See

```javascript
// In browser console
simulation_started  → Simulation begins
race_started       → Race goes live (e.g., "AQU R1")
race_finished      → Results revealed
round_updated      → Your round progress updates
simulation_finished → All races complete
```

## Troubleshooting

### WebSocket Not Connecting
- Check backend is running: `npm run dev` in backend folder
- Check port 3001 is accessible
- Check browser console for connection errors
- Verify CORS_ORIGIN is set correctly

### No Races Showing
- Verify track data exists for 2025-11-09
- Check contest has matchups generated
- Look at backend logs for errors

### Races Not Progressing
- Check simulation status (should be "running", not "paused")
- Verify timers are being set (backend logs)
- Check for backend errors

### Points Not Calculating
- Verify race results exist in track data
- Check that horses have points field
- Look for errors in round_updated events

## Next Steps After Testing

1. Fine-tune UI based on simulation testing
2. Add matchup detail modals
3. Add race detail modals
4. Implement comparison view
5. Add round cancellation (before start)
6. Transition to real-time with actual upcoming races

