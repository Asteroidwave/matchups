# Test Scripts

## test-contests.ts

This script creates test contests for AQU and GP on November 16, 2025, and tests global exclusion and quality tuning features.

### Usage

```bash
# Run from backend directory
cd backend

# Basic usage (keeps existing contests)
npm run test-contests

# Delete old contests first, then create new ones
npm run test-contests -- --delete-old
```

### What it does

1. **Fetches existing contests** - Shows current contests in the database
2. **Optionally deletes old contests** - Use `--delete-old` flag to remove existing contests first
3. **Creates test contests** - Creates contests for:
   - AQU (Aqueduct) on November 16, 2025
   - GP (Gulfstream) on November 16, 2025
4. **Sets matchup types** - Configures each contest with:
   - `jockey_vs_jockey` (10 matchups)
   - `trainer_vs_trainer` (10 matchups)
   - `sire_vs_sire` (10 matchups)
   - `mixed` (15 matchups)
5. **Triggers calculation** - Runs matchup generation which tests:
   - **Global Exclusion**: Connections should not repeat across matchup types
   - **Quality Tuning**: Tiered system and scoring weights

### What to check

After running the script, check the backend logs for:

#### Global Exclusion
- `[UnifiedMatchup] Excluded X connections due to global exclusion (Y total excluded)`
- `[calc-XXX] 🔒 Global Exclusion: X total connections excluded across all matchup types`

#### Quality Tuning
- `[UnifiedMatchup] Created 4 salary tiers (weighted distribution):`
- `[UnifiedMatchup] Tier quality metrics:` (JSON with tier stats)
- `[UnifiedMatchup] ✅ Final Quality Metrics:`
  - Avg Total Salary
  - Avg Total Apps
  - Avg Salary Diff

### Verifying Results

1. **Check Supabase**: Verify matchups are created in the `matchups` table
2. **Check logs**: Look for quality metrics and exclusion messages
3. **Manual verification**: Check that connections don't repeat across matchup types

### Notes

- The script requires Supabase to be configured and running
- Track data must exist for AQU and GP on November 16, 2025
- If track data doesn't exist, contests will be created but matchup calculation may fail
- The script will wait between operations to avoid overwhelming the database

