# Comprehensive Database Architecture for Horse Racing Fantasy Platform

## Overview
This document outlines a complete relational database redesign that will solve the current architecture issues and provide a robust, scalable foundation.

## Core Principles
1. **Single Source of Truth**: All data properly normalized and stored relationally
2. **Full Audit Trail**: Track everything from ingestion to final results
3. **Real-time Change Management**: Handle scratches, AE elevations, cancellations gracefully  
4. **Lifecycle Tracking**: Complete visibility into contest/round progression
5. **Referential Integrity**: Proper foreign keys and constraints
6. **Scalability**: Designed for multiple concurrent contests and users

## Database Schema Design

### 1. Core Racing Entities

#### `tracks`
```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE, -- 'GP', 'SA', 'KEE'
  name VARCHAR(100) NOT NULL,       -- 'Gulfstream Park'
  timezone VARCHAR(50) NOT NULL,    -- 'America/New_York'
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `race_cards`
```sql
CREATE TABLE race_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id),
  race_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, cancelled, completed
  post_times JSONB,                       -- Array of race post times
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  metadata JSONB,                         -- Weather, track condition, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(track_id, race_date)
);
```

#### `races`
```sql
CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_card_id UUID NOT NULL REFERENCES race_cards(id),
  race_number INTEGER NOT NULL,
  post_time TIMESTAMPTZ,
  distance VARCHAR(20),
  surface VARCHAR(20),              -- dirt, turf, synthetic
  race_type VARCHAR(50),           -- maiden, allowance, stakes, etc.
  purse DECIMAL(12,2),
  conditions TEXT,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, official, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_card_id, race_number)
);
```

### 2. Horse & Connection Entities

#### `horses`
```sql
CREATE TABLE horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  foaling_year INTEGER,
  sex VARCHAR(10),
  breed VARCHAR(50),
  color VARCHAR(50),
  sire_name VARCHAR(100),
  dam_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Allow same name horses (happens in racing)
  CONSTRAINT horses_name_year_unique UNIQUE (name, foaling_year)
);
```

#### `connections` (jockeys, trainers, owners, sires)
```sql
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,        -- jockey, trainer, owner, sire
  license_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, role)
);
```

#### `race_entries` (the source of truth for all starters)
```sql
CREATE TABLE race_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES races(id),
  horse_id UUID NOT NULL REFERENCES horses(id),
  program_number INTEGER NOT NULL,  -- Saddlecloth number (stable)
  post_position INTEGER,            -- Gate position (can change)
  
  -- Connections
  jockey_id UUID REFERENCES connections(id),
  trainer_id UUID REFERENCES connections(id),
  owner_id UUID REFERENCES connections(id),
  
  -- Betting & Performance Data
  morning_line_odds VARCHAR(10),
  ml_decimal_odds DECIMAL(8,3),
  salary DECIMAL(8,2),
  
  -- Entry Status
  status VARCHAR(20) DEFAULT 'entered', -- entered, scratched, ae_elevated
  scratch_time TIMESTAMPTZ,
  scratch_reason TEXT,
  is_also_eligible BOOLEAN DEFAULT FALSE,
  ae_elevation_time TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_id, program_number),
  UNIQUE(race_id, post_position) -- Only one horse per post position
);
```

#### `race_results`
```sql
CREATE TABLE race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  finish_position INTEGER,
  official_finish_position INTEGER,
  disqualified BOOLEAN DEFAULT FALSE,
  final_odds DECIMAL(8,3),
  payout_win DECIMAL(10,2),
  payout_place DECIMAL(10,2),
  payout_show DECIMAL(10,2),
  points_earned DECIMAL(8,2),
  
  -- Race details
  lengths_behind DECIMAL(5,2),
  running_positions TEXT,        -- '2-1-1-1' (position at each call)
  comments TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_entry_id)
);
```

### 3. Contest & Matchup System

#### `contests`
```sql
CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  contest_type VARCHAR(50) NOT NULL, -- single_track, multi_track, cross_track
  
  -- Scheduling
  contest_date DATE NOT NULL,
  lock_time TIMESTAMPTZ NOT NULL,
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  
  -- Entry Details
  entry_fee DECIMAL(10,2) NOT NULL,
  max_entries INTEGER,
  prize_structure JSONB,            -- Prize pool breakdown
  
  -- Status & Lifecycle
  status VARCHAR(30) DEFAULT 'draft', -- draft, open, locked, live, grading, settled, cancelled
  lifecycle_stage VARCHAR(30) DEFAULT 'setup',
  
  -- Admin
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `contest_races` (which races are in this contest)
```sql
CREATE TABLE contest_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id),
  race_id UUID NOT NULL REFERENCES races(id),
  weight INTEGER DEFAULT 1,         -- For scoring weighting
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, race_id)
);
```

#### `matchup_pools` (calculated connection pools for each contest)
```sql
CREATE TABLE matchup_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id),
  connection_id UUID NOT NULL REFERENCES connections(id),
  
  -- Aggregated Performance Stats
  total_entries INTEGER DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  total_salary DECIMAL(12,2) DEFAULT 0,
  avg_odds DECIMAL(8,3) DEFAULT 0,
  
  -- Recent Performance (last 30/90 days)
  avpa_30d DECIMAL(8,3) DEFAULT 0,
  avpa_90d DECIMAL(8,3) DEFAULT 0,
  
  -- Qualifying races for this contest
  qualifying_entries JSONB,         -- Array of race_entry_ids
  
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, connection_id)
);
```

#### `matchups` 
```sql
CREATE TABLE matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id),
  matchup_type VARCHAR(30) NOT NULL, -- jockey_vs_jockey, trainer_vs_trainer, mixed, etc.
  
  -- Set A (Left Side)
  set_a_connections UUID[] NOT NULL, -- Array of connection IDs
  set_a_total_salary DECIMAL(12,2),
  set_a_total_points DECIMAL(10,2),
  
  -- Set B (Right Side)  
  set_b_connections UUID[] NOT NULL, -- Array of connection IDs
  set_b_total_salary DECIMAL(12,2),
  set_b_total_points DECIMAL(10,2),
  
  -- Matchup Metadata
  tolerance_used DECIMAL(8,2),
  generation_algorithm VARCHAR(50),
  quality_score DECIMAL(5,3),      -- How balanced is this matchup
  
  -- Results (populated after races)
  winning_side CHAR(1),            -- 'A', 'B', or 'T' for tie
  set_a_actual_points DECIMAL(10,2),
  set_b_actual_points DECIMAL(10,2),
  resulted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `matchup_entries` (detailed breakdown of what's in each matchup)
```sql
CREATE TABLE matchup_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL REFERENCES matchups(id),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  connection_id UUID NOT NULL REFERENCES connections(id),
  matchup_side CHAR(1) NOT NULL,    -- 'A' or 'B'
  
  -- Expected performance (at time of matchup creation)
  expected_points DECIMAL(8,2),
  expected_salary DECIMAL(8,2),
  
  -- Actual performance (populated after race)
  actual_points DECIMAL(8,2),
  finish_position INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(matchup_id, race_entry_id)
);
```

### 4. User Entry & Round System

#### `user_entries`
```sql
CREATE TABLE user_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  entry_amount DECIMAL(10,2) NOT NULL,
  max_multiplier INTEGER DEFAULT 2,
  
  -- Entry Options
  is_flex BOOLEAN DEFAULT FALSE,
  required_picks INTEGER,          -- For flex entries
  multiplier_schedule JSONB,       -- Custom multiplier rules
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, live, won, lost, pushed, cancelled
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_picks` (individual picks within an entry)
```sql
CREATE TABLE user_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id),
  matchup_id UUID NOT NULL REFERENCES matchups(id),
  selected_side CHAR(1) NOT NULL,   -- 'A' or 'B'
  
  -- Result tracking
  is_winner BOOLEAN,
  resulted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id, matchup_id)
);
```

#### `rounds` (complete round/entry lifecycle tracking)
```sql
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id),
  
  -- Round Summary
  total_picks INTEGER NOT NULL,
  correct_picks INTEGER DEFAULT 0,
  incorrect_picks INTEGER DEFAULT 0,
  pending_picks INTEGER DEFAULT 0,
  
  -- Payout Calculation
  entry_amount DECIMAL(10,2) NOT NULL,
  potential_payout DECIMAL(10,2),
  actual_payout DECIMAL(10,2) DEFAULT 0,
  final_multiplier DECIMAL(6,3),
  
  -- Status & Lifecycle
  status VARCHAR(20) DEFAULT 'live', -- live, won, lost, pushed, grading
  result_type VARCHAR(20),           -- full_win, partial_win, loss, push
  
  -- Timestamps
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id) -- One round per entry
);
```

### 5. Audit & Change Tracking

#### `data_ingestion_logs`
```sql
CREATE TABLE data_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,      -- 'mongodb', 'api', 'manual'
  data_type VARCHAR(50) NOT NULL,   -- 'entries', 'results', 'changes'
  track_code VARCHAR(10),
  race_date DATE,
  
  -- Processing Details
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
  error_details JSONB,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

#### `entry_changes` (track scratches, AE elevations, etc.)
```sql
CREATE TABLE entry_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  change_type VARCHAR(30) NOT NULL, -- 'scratch', 'ae_elevation', 'jockey_change', 'odds_update'
  
  -- Change Details
  old_values JSONB,                -- What changed from
  new_values JSONB,                -- What changed to
  change_reason TEXT,
  
  -- Impact Tracking
  affected_matchups UUID[],        -- Which matchups need updating
  affected_contests UUID[],        -- Which contests are impacted
  
  -- Processing Status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Key Benefits of This Architecture

### 1. **Complete Data Lineage**
- Every connection can be traced back to specific race entries
- Full audit trail of all changes and their impacts
- Clear visibility into how matchups were generated

### 2. **Real-time Change Management**
- `entry_changes` table captures all live updates
- Automated impact analysis shows which matchups are affected
- Can quickly update or void affected contests

### 3. **Proper Lifecycle Tracking**
- Complete round progression from creation to payout
- Status tracking at every level (contest, entry, round, pick)
- Proper state management with timestamps

### 4. **Referential Integrity**
- Foreign keys ensure data consistency
- Cascading rules handle deletions properly
- Constraints prevent invalid data states

### 5. **Performance & Scalability**
- Proper indexing for fast queries
- Normalized data reduces redundancy
- Pre-calculated pools improve matchup generation speed

### 6. **Flexibility for Growth**
- Easy to add new connection types or matchup formats
- Contest system supports any type of racing event
- Extensible metadata fields for new requirements

## Migration Strategy

1. **Phase 1**: Create new schema alongside existing system
2. **Phase 2**: Build data ingestion pipelines to populate new tables
3. **Phase 3**: Migrate matchup generation to use new relational data
4. **Phase 4**: Update frontend to consume new APIs
5. **Phase 5**: Deprecate old localStorage/cache systems

## Implementation Considerations

### Data Volume Planning
- Expect ~10,000 race entries per day across all tracks
- ~1,000 matchups per contest
- ~100 contests per day
- Proper partitioning and archiving strategies needed

### Real-time Updates
- WebSocket connections for live change notifications
- Event-driven architecture for processing scratches/changes
- Background jobs for calculating impacts

### Caching Strategy
- Redis for frequently accessed matchup data
- Materialized views for complex aggregations
- CDN for static reference data

This architecture provides the robust foundation you need for a professional-grade horse racing fantasy platform that can handle real-time changes, scale to many users, and maintain complete data integrity.
