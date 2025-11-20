# 🏇 Cross-Track Matchup Tracking Explanation

## How Cross-Track Matchups Work in the New Schema

### Overview
The new relational schema **fully supports cross-track matchups**! Here's how it works:

## 📊 Schema Design for Cross-Track Matchups

### 1. **Contest Type**
The `contests` table has a `contest_type` field:
```sql
contest_type VARCHAR(50) CHECK (contest_type IN ('single_track', 'multi_track', 'cross_track'))
```

### 2. **Matchup Type**
The `matchups` table has a `matchup_type` field:
```sql
matchup_type VARCHAR(30) CHECK (matchup_type IN (
  'jockey_vs_jockey', 
  'trainer_vs_trainer', 
  'sire_vs_sire', 
  'mixed', 
  'cross_track'
))
```

### 3. **Tracking Track Information**

Cross-track matchups are tracked through the relationship chain:

```
matchup_entries
  ↓ (race_entry_id)
race_entries
  ↓ (race_id)
races
  ↓ (race_card_id)
race_cards
  ↓ (track_id)
tracks
```

**This means:**
- Each `matchup_entry` links to a `race_entry`
- Each `race_entry` belongs to a `race`
- Each `race` belongs to a `race_card`
- Each `race_card` belongs to a `track`

**So you can always determine which track each connection comes from!**

## 🔍 Example: Cross-Track Jockey Matchup

### Scenario
- **Set A**: Jockey "John Smith" from AQU (race 3)
- **Set B**: Jockey "Jane Doe" from DMR (race 5)

### How It's Stored

1. **Matchup Record** (`matchups` table):
   ```sql
   id: uuid-123
   contest_id: contest-uuid
   matchup_type: 'jockey_vs_jockey'  -- or 'cross_track'
   set_a_connections: [jockey-john-smith-uuid]
   set_b_connections: [jockey-jane-doe-uuid]
   ```

2. **Matchup Entries** (`matchup_entries` table):
   ```sql
   -- Set A entry
   matchup_id: uuid-123
   race_entry_id: aqu-race3-horse1-entry-uuid  -- Links to AQU race
   connection_id: jockey-john-smith-uuid
   matchup_side: 'A'
   
   -- Set B entry
   matchup_id: uuid-123
   race_entry_id: dmr-race5-horse2-entry-uuid  -- Links to DMR race
   connection_id: jockey-jane-doe-uuid
   matchup_side: 'B'
   ```

3. **To Get Track Info**:
   ```sql
   SELECT 
     m.id as matchup_id,
     m.matchup_type,
     c_a.name as connection_a_name,
     t_a.code as track_a_code,
     r_a.race_number as race_a_number,
     c_b.name as connection_b_name,
     t_b.code as track_b_code,
     r_b.race_number as race_b_number
   FROM matchups m
   JOIN matchup_entries me_a ON me_a.matchup_id = m.id AND me_a.matchup_side = 'A'
   JOIN race_entries re_a ON re_a.id = me_a.race_entry_id
   JOIN races r_a ON r_a.id = re_a.race_id
   JOIN race_cards rc_a ON rc_a.id = r_a.race_card_id
   JOIN tracks t_a ON t_a.id = rc_a.track_id
   JOIN connections c_a ON c_a.id = me_a.connection_id
   
   JOIN matchup_entries me_b ON me_b.matchup_id = m.id AND me_b.matchup_side = 'B'
   JOIN race_entries re_b ON re_b.id = me_b.race_entry_id
   JOIN races r_b ON r_b.id = re_b.race_id
   JOIN race_cards rc_b ON rc_b.id = r_b.race_card_id
   JOIN tracks t_b ON t_b.id = rc_b.track_id
   JOIN connections c_b ON c_b.id = me_b.connection_id
   WHERE m.id = 'matchup-uuid';
   ```

## 🎯 Mixed Matchups (Jockey vs Sire from Different Tracks)

### Example
- **Set A**: Jockey "John Smith" from LRL (race 2)
- **Set B**: Sire "Fast Horse" from GP (race 7)

### Storage
- Same structure as above
- `matchup_type` = `'mixed'`
- `matchup_side` = 'A' for jockey, 'B' for sire
- Track info still tracked through `race_entry_id` → `race` → `race_card` → `track`

## 📋 What About `multi_track_bundles`?

The `multi_track_bundles` table is **actively used** in the backend! It serves as a **caching/optimization layer** for cross-track matchups.

### Two Systems Working Together:

1. **Normalized Storage** (`matchups` + `matchup_entries`):
   - Fully relational, normalized data
   - Track info via relationship chain
   - Best for queries and data integrity

2. **Bundle Cache** (`multi_track_bundles`):
   - Pre-calculated matchup bundles stored as JSONB
   - Faster retrieval for cross-track matchups
   - Used by backend services (`simpleCrossTrack.ts`, `multi-track-matchups.ts`)
   - Stores: `contest_ids[]`, `track_codes[]`, `matchup_types[]`, `matchup_data` (JSONB)

**How They Work Together:**
- `multi_track_bundles` stores pre-calculated cross-track matchup bundles
- When you create cross-track matchups, they can be:
  1. Stored in `matchups` + `matchup_entries` (normalized)
  2. Cached in `multi_track_bundles` (for fast retrieval)
  3. Both! (recommended for performance)

**Current Status:**
- ✅ Cross-track matchups are tracked via `matchup_entries` → `race_entries` → `races` → `race_cards` → `tracks`
- ✅ `multi_track_bundles` is used for caching/optimization
- ✅ Both systems support cross-track functionality

## ✅ Summary

**Cross-track matchups ARE fully supported:**

1. ✅ **Track Information**: Tracked through relationship chain (matchup_entry → race_entry → race → race_card → track)
2. ✅ **Matchup Types**: Supports `'cross_track'` and `'mixed'` types
3. ✅ **Contest Types**: Supports `'cross_track'` contest type
4. ✅ **Connection Tracking**: Each connection's track is determinable from `race_entry_id`

**You can create:**
- Jockey (AQU) vs Jockey (DMR) ✅
- Trainer (LRL) vs Trainer (GP) ✅
- Sire (CD) vs Sire (AQU) ✅
- Mixed: Jockey (LRL) vs Sire (GP) ✅
- Any combination across any tracks ✅

## 🔍 Verification Query

To see all cross-track matchups in a contest:

```sql
SELECT 
  m.id,
  m.matchup_type,
  array_agg(DISTINCT t.code ORDER BY t.code) as tracks_involved,
  COUNT(DISTINCT t.id) as track_count
FROM matchups m
JOIN matchup_entries me ON me.matchup_id = m.id
JOIN race_entries re ON re.id = me.race_entry_id
JOIN races r ON r.id = re.race_id
JOIN race_cards rc ON rc.id = r.race_card_id
JOIN tracks t ON t.id = rc.track_id
WHERE m.contest_id = 'your-contest-id'
GROUP BY m.id, m.matchup_type
HAVING COUNT(DISTINCT t.id) > 1;  -- Only cross-track matchups
```
