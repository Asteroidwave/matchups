# 📊 Database Table Reference

## ✅ NEW Relational Schema Tables (KEEP THESE)

These are the tables from the **NEW relational schema** (`docs/NEW_RELATIONAL_SCHEMA.sql`):

### Core Racing Entities
- ✅ `tracks` - Racing tracks (CD, GP, AQU, etc.)
- ✅ `race_cards` - Daily racing cards at a track
- ✅ `races` - Individual races within a race card
- ✅ `horses` - Horse information
- ✅ `connections` - Jockeys, trainers, owners, sires
- ✅ `race_entries` - Horses entered in specific races
- ✅ `race_results` - Race finishing results (NOT `contest_results`)

### Contests & Matchups
- ✅ `contests` - Fantasy contests
- ✅ `contest_races` - Races included in a contest
- ✅ `matchup_pools` - Pools of connections for matchups
- ✅ `matchups` - Head-to-head matchups
- ✅ `matchup_entries` - Connections in each matchup

### User Data
- ✅ `user_entries` - User contest entries
- ✅ `user_picks` - User matchup picks
- ✅ `profiles` - User profiles (from auth.users)

### System Tables
- ✅ `rounds` - Round lifecycle management
- ✅ `data_ingestion_logs` - Ingestion tracking
- ✅ `entry_changes` - Entry change history
- ✅ `system_events` - System event log

## ❌ OLD Tables (DO NOT USE - May Not Exist)

These are tables from the **OLD system** that should NOT be referenced:

- ❌ `contest_results` - **DOES NOT EXIST** (use `race_results` instead)
- ❌ Any table not listed above in the NEW schema

## 🔍 How to Identify NEW vs OLD Tables

**NEW Tables:**
- Use UUID primary keys
- Have proper foreign key relationships
- Follow naming convention: `snake_case`
- Are defined in `docs/NEW_RELATIONAL_SCHEMA.sql`

**OLD Tables:**
- May use different ID types
- May not have proper relationships
- May have different naming conventions
- Are NOT in the new schema file

## 📝 Safe Cleanup Pattern

When writing cleanup scripts, **ONLY reference tables from the NEW schema**:

```sql
-- ✅ CORRECT - Uses NEW schema table names
DELETE FROM race_results;  -- NEW schema table

-- ❌ WRONG - References non-existent table
DELETE FROM contest_results;  -- DOES NOT EXIST
```

## 🎯 Quick Reference

| What You Need | NEW Schema Table |
|--------------|------------------|
| Race results | `race_results` |
| Contest data | `contests` |
| User entries | `user_entries` |
| User picks | `user_picks` |
| Matchups | `matchups` |
| Horses | `horses` |
| Connections | `connections` |
| Tracks | `tracks` |
| User profiles | `profiles` |
