# 🧹 Table Cleanup & RLS Security Guide

## 📊 Current Situation

Your Supabase database has:
- ✅ **19 NEW relational schema tables** (should keep)
- ❌ **Backup tables** (should delete)
- ⚠️ **Old/unused tables** (need to verify and possibly delete)
- ❌ **RLS disabled** on most tables (security risk!)

## ✅ NEW Relational Schema Tables (KEEP THESE)

These 19 tables are from the NEW schema and should be kept:

1. `tracks` - Racing tracks
2. `horses` - Horse information
3. `connections` - Jockeys, trainers, owners, sires
4. `race_cards` - Daily racing cards
5. `races` - Individual races
6. `race_entries` - Horses in races
7. `race_results` - Race finishing results
8. `contests` - Fantasy contests
9. `contest_races` - Races in contests
10. `matchup_pools` - Connection pools for matchups
11. `matchups` - Head-to-head matchups
12. `matchup_entries` - Connections in matchups
13. `user_entries` - User contest entries
14. `user_picks` - User matchup picks
15. `rounds` - Round lifecycle
16. `data_ingestion_logs` - Ingestion tracking
17. `entry_changes` - Entry change history
18. `system_events` - System event log
19. `profiles` - User profiles

## ❌ Tables to DELETE

### Backup Tables (Safe to Delete)
- `contests_backup_20251120_0431`
- `contests_backup_20251120_0535`
- `entries_backup_20251120_0431`
- `entries_backup_20251120_0535`
- `profiles_backup_20251120_0431`
- `profiles_backup_20251120_0535`
- Any other `*_backup_*` tables

### Old Tables (Verify Before Deleting)
- `entries` - **OLD**: Replaced by `user_entries`
- `track_data` - **OLD**: Replaced by `tracks` + `race_cards`
- `operations` - **OLD**: Not in new schema
- `simulation_events` - **OLD**: Not in new schema
- `simulations` - **OLD**: Not in new schema
- `user_preferences` - **OLD**: Not in new schema

## 🔒 RLS (Row Level Security) - CRITICAL!

**Current Status**: Most tables show "Unrestricted" = **RLS DISABLED** = **SECURITY RISK!**

### Why RLS Matters
- **Without RLS**: Anyone with database access can read/write all data
- **With RLS**: Users can only access their own data
- **Required for**: Multi-user platform security

### What to Do

1. **Run `docs/ENABLE_RLS_POLICIES.sql`** - Enables RLS and creates security policies
2. **Verify** - Check that tables show "Restricted" instead of "Unrestricted"

## 📋 Step-by-Step Cleanup

### Step 1: Identify Old Tables
Run in Supabase SQL Editor:
```sql
-- See scripts/identify-old-tables.sql
```

### Step 2: Enable RLS (CRITICAL!)
Run in Supabase SQL Editor:
```sql
-- See docs/ENABLE_RLS_POLICIES.sql
```

### Step 3: Delete Backup Tables
Run in Supabase SQL Editor:
```sql
-- See scripts/cleanup-old-tables.sql
-- Review the list first, then uncomment DROP statements
```

### Step 4: Verify Cleanup
After cleanup, you should have:
- ✅ Exactly 19 tables (NEW schema)
- ✅ All tables show "Restricted" (RLS enabled)
- ✅ No backup tables
- ✅ No old/unused tables

## 🎯 Quick Action Plan

1. **Run `scripts/identify-old-tables.sql`** - See what you have
2. **Run `docs/ENABLE_RLS_POLICIES.sql`** - Enable security (DO THIS FIRST!)
3. **Review `scripts/cleanup-old-tables.sql`** - See what will be deleted
4. **Execute cleanup** - Delete backup and old tables
5. **Verify** - Check final table list

## ⚠️ Warnings

- **Backup tables**: Safe to delete (they're backups!)
- **Old tables**: Verify they're not used before deleting
- **RLS**: Must be enabled for production security
- **Test first**: Run on a test database if possible

## ✅ Expected Final State

After cleanup:
- 19 tables (all from NEW schema)
- All tables have RLS enabled
- All tables show "Restricted" in Supabase UI
- No backup or old tables
- Secure multi-user platform ready
