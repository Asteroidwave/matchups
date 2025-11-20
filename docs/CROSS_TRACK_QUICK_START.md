# Cross-Track Matchups - Quick Start Guide

## What We Built

A simple cross-track matchup system for testing with 2-4 tracks.

---

## How to Use

### Option 1: Test Page (Easiest)

1. **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Navigate to test page:**
   ```
   http://localhost:3000/cross-track-test
   ```

4. **Generate matchups:**
   - Select date (e.g., 2025-11-02)
   - Set max tracks (2-4)
   - Click "Generate Cross-Track Matchups"

5. **View results:**
   - See which tracks were included
   - View matchups
   - Verify Set A and Set B are from different tracks

### Option 2: API Direct (For Testing)

**Endpoint:**
```
GET /api/cross-track/:date?maxTracks=4
```

**Example:**
```bash
curl http://localhost:3001/api/cross-track/2025-11-02?maxTracks=4
```

**Response:**
```json
{
  "success": true,
  "matchups": [...],
  "tracks": ["AQU", "DEL", "GP", "SA"],
  "count": 40,
  "date": "2025-11-02"
}
```

### Option 3: Check Available Dates

**Endpoint:**
```
GET /api/cross-track/available-dates
```

**Example:**
```bash
curl http://localhost:3001/api/cross-track/available-dates
```

**Response:**
```json
{
  "dates": [
    {
      "date": "2025-11-02",
      "tracks": ["AQU", "DEL", "GP", "SA"],
      "trackCount": 4
    }
  ]
}
```

---

## What It Does

### Backend Process

1. **Finds contests** on the specified date (up to maxTracks)
2. **Loads track data** from each contest
3. **Combines all records** from all tracks
4. **Generates connections** for jockeys, trainers, sires
5. **Creates matchups** using cross-track validation
6. **Verifies** all matchups are truly cross-track

### Validation Rules

**Cross-Track Matchup Must:**
- ✅ Have connections from different tracks (no overlap)
- ✅ No shared horses between sets
- ✅ Meet minimum appearances (2)
- ✅ Meet salary tolerance (1000)

**Example Valid Matchup:**
```
Set A: Jockey "John Smith" from AQU
Set B: Jockey "Jane Doe" from DEL
✅ Different tracks, valid!
```

**Example Invalid Matchup:**
```
Set A: Jockey "John Smith" from AQU
Set B: Jockey "Jane Doe" from AQU
❌ Same track, invalid!
```

---

## Files Created

### Backend
1. **`backend/src/services/simpleCrossTrack.ts`**
   - Main generation logic
   - Connection building
   - AVPA loading

2. **`backend/src/routes/cross-track.ts`**
   - API endpoints
   - Date validation
   - Error handling

3. **`backend/src/index.ts`**
   - Added route registration

### Frontend
4. **`app/cross-track-test/page.tsx`**
   - Test UI
   - Date selector
   - Matchup display
   - Track verification

---

## Testing Checklist

### Test 1: Basic Generation
- [ ] Navigate to `/cross-track-test`
- [ ] Select date: 2025-11-02
- [ ] Set max tracks: 4
- [ ] Click "Generate"
- [ ] Verify matchups appear
- [ ] Check tracks are listed

### Test 2: Verify Cross-Track
- [ ] Look at first matchup
- [ ] Check "Set A Tracks" and "Set B Tracks"
- [ ] Verify they're different
- [ ] Repeat for 5-10 matchups

### Test 3: Different Track Counts
- [ ] Try maxTracks = 2
- [ ] Try maxTracks = 3
- [ ] Try maxTracks = 4
- [ ] Verify matchups generate for each

### Test 4: API Direct
- [ ] Call `/api/cross-track/2025-11-02?maxTracks=4`
- [ ] Verify JSON response
- [ ] Check matchup count
- [ ] Check tracks array

### Test 5: Available Dates
- [ ] Call `/api/cross-track/available-dates`
- [ ] Verify dates with 2+ contests are listed
- [ ] Check track counts

---

## Troubleshooting

### No Matchups Generated

**Check:**
1. Do you have 2+ contests on that date?
   ```sql
   SELECT track, date FROM contests WHERE date = '2025-11-02' AND is_active = true;
   ```

2. Do contests have track_data_id?
   ```sql
   SELECT id, track, track_data_id FROM contests WHERE date = '2025-11-02';
   ```

3. Check backend logs for errors

**Fix:**
- Ensure multiple contests exist for the date
- Verify track_data is loaded
- Check min_appearances isn't too high

### Only Getting Same-Track Matchups

**Check:**
- Look at validation logs
- Verify `isCrossTrack = true` is being passed
- Check `isValidCrossTrackMatchup()` function

**Fix:**
- Ensure cross-track validation is active
- Check connections have multiple tracks in trackSet

### Low Matchup Count

**Check:**
- How many connections from each track?
- Are they meeting min_appearances = 2?
- Is salary_tolerance too strict?

**Fix:**
- Lower min_appearances to 1
- Increase salary_tolerance to 1500
- Add more track data

---

## Next Steps

### After Testing (This Works)
1. Integrate into main matchups page
2. Add to admin panel
3. Add caching
4. Add to contest matchup types

### Future Enhancements
1. Multi-contest bundles (full system)
2. Pre-generated scenarios
3. Dynamic track filtering
4. Persistent storage

---

## Quick Reference

**Test Page:** `http://localhost:3000/cross-track-test`

**API Endpoints:**
- `GET /api/cross-track/:date?maxTracks=4`
- `GET /api/cross-track/available-dates`

**Default Settings:**
- Min Appearances: 2
- Salary Tolerance: 1000
- Patterns: [[1,1], [2,1], [1,2]]
- Target Matchups: 40

---

**Status:** ✅ Ready to Test  
**Date:** 2025-11-13  
**Next:** Test with real data

