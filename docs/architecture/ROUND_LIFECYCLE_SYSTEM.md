# Complete Round Lifecycle Management System

## Overview
This document outlines a comprehensive system for tracking rounds from conception to completion, including all state transitions, event handling, and real-time updates.

## Round Lifecycle States

### 1. **Creation Phase**
```
DRAFT → BUILDING → READY
```
- **DRAFT**: User is selecting picks but hasn't submitted yet
- **BUILDING**: System is validating picks and calculating potential payouts
- **READY**: Entry is complete and ready for submission

### 2. **Active Phase** 
```
SUBMITTED → LOCKED → LIVE → GRADING
```
- **SUBMITTED**: Entry submitted but contest not locked yet
- **LOCKED**: Contest locked, entry is official, races haven't started
- **LIVE**: Races are running, results coming in real-time
- **GRADING**: All races complete, calculating final results

### 3. **Resolution Phase**
```
GRADING → (WON | LOST | PUSHED | CANCELLED) → SETTLED
```
- **WON**: Entry won, payout calculated
- **LOST**: Entry lost, no payout
- **PUSHED**: Tie or cancelled races, entry amount returned
- **CANCELLED**: Contest cancelled, full refund
- **SETTLED**: Payout processed, round complete

## Database Implementation

### Enhanced Round States Table
```sql
CREATE TABLE round_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id),
  state VARCHAR(20) NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB, -- State-specific data
  triggered_by VARCHAR(50), -- 'user_action', 'race_result', 'system_event'
  notes TEXT
);
```

### State Transition Rules
```sql
CREATE TABLE state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_state VARCHAR(20) NOT NULL,
  to_state VARCHAR(20) NOT NULL,
  trigger_event VARCHAR(50) NOT NULL,
  conditions JSONB, -- Conditions that must be met
  actions JSONB, -- Actions to take during transition
  is_automatic BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(from_state, to_state, trigger_event)
);
```

### Round Events Log
```sql
CREATE TABLE round_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  race_id UUID REFERENCES races(id), -- If event relates to specific race
  matchup_id UUID REFERENCES matchups(id), -- If event relates to specific matchup
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Lifecycle Management Functions

### 1. Round State Machine
```sql
CREATE OR REPLACE FUNCTION transition_round_state(
  p_round_id UUID,
  p_new_state VARCHAR(20),
  p_trigger_event VARCHAR(50),
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_state VARCHAR(20);
  transition_allowed BOOLEAN := FALSE;
  round_record rounds%ROWTYPE;
BEGIN
  -- Get current round state
  SELECT * INTO round_record FROM rounds WHERE id = p_round_id;
  current_state := round_record.status;
  
  -- Check if transition is allowed
  SELECT EXISTS (
    SELECT 1 FROM state_transitions 
    WHERE from_state = current_state 
    AND to_state = p_new_state 
    AND trigger_event = p_trigger_event
  ) INTO transition_allowed;
  
  IF NOT transition_allowed THEN
    RAISE EXCEPTION 'Invalid state transition from % to % via %', current_state, p_new_state, p_trigger_event;
  END IF;
  
  -- Perform the transition
  UPDATE rounds 
  SET status = p_new_state, updated_at = NOW()
  WHERE id = p_round_id;
  
  -- Log the state change
  INSERT INTO round_states (round_id, state, metadata, triggered_by)
  VALUES (p_round_id, p_new_state, p_metadata, p_trigger_event);
  
  -- Log the event
  INSERT INTO round_events (round_id, event_type, event_data)
  VALUES (p_round_id, 'state_transition', jsonb_build_object(
    'from_state', current_state,
    'to_state', p_new_state,
    'trigger', p_trigger_event,
    'metadata', p_metadata
  ));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### 2. Real-time Result Processing
```sql
CREATE OR REPLACE FUNCTION process_race_result(
  p_race_id UUID,
  p_results JSONB -- Array of {race_entry_id, finish_position, points}
)
RETURNS INTEGER AS $$
DECLARE
  result RECORD;
  affected_rounds INTEGER := 0;
  round_id UUID;
  matchup RECORD;
BEGIN
  -- Process each result
  FOR result IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    -- Update race result
    INSERT INTO race_results (race_entry_id, finish_position, points_earned)
    VALUES (
      (result->>'race_entry_id')::UUID,
      (result->>'finish_position')::INTEGER,
      (result->>'points')::DECIMAL
    )
    ON CONFLICT (race_entry_id) 
    DO UPDATE SET 
      finish_position = EXCLUDED.finish_position,
      points_earned = EXCLUDED.points_earned;
  END LOOP;
  
  -- Find all matchups affected by this race
  FOR matchup IN 
    SELECT DISTINCT m.* 
    FROM matchups m
    JOIN matchup_entries me ON m.id = me.matchup_id
    JOIN race_entries re ON me.race_entry_id = re.id
    WHERE re.race_id = p_race_id
  LOOP
    -- Calculate matchup result
    PERFORM calculate_matchup_result(matchup.id);
    
    -- Find affected rounds and update them
    FOR round_id IN
      SELECT DISTINCT r.id
      FROM rounds r
      JOIN user_entries ue ON r.user_entry_id = ue.id
      JOIN user_picks up ON ue.id = up.user_entry_id
      WHERE up.matchup_id = matchup.id
      AND r.status IN ('live', 'grading')
    LOOP
      PERFORM update_round_progress(round_id);
      affected_rounds := affected_rounds + 1;
    END LOOP;
  END LOOP;
  
  RETURN affected_rounds;
END;
$$ LANGUAGE plpgsql;
```

### 3. Round Progress Calculation
```sql
CREATE OR REPLACE FUNCTION update_round_progress(p_round_id UUID)
RETURNS VOID AS $$
DECLARE
  round_record rounds%ROWTYPE;
  entry_record user_entries%ROWTYPE;
  pick_stats RECORD;
  new_status VARCHAR(20);
BEGIN
  -- Get round and entry details
  SELECT r.*, ue.* INTO round_record, entry_record
  FROM rounds r
  JOIN user_entries ue ON r.user_entry_id = ue.id
  WHERE r.id = p_round_id;
  
  -- Calculate current pick statistics
  SELECT 
    COUNT(*) as total_picks,
    COUNT(*) FILTER (WHERE up.is_winner = TRUE) as correct_picks,
    COUNT(*) FILTER (WHERE up.is_winner = FALSE) as incorrect_picks,
    COUNT(*) FILTER (WHERE up.is_push = TRUE) as pushed_picks,
    COUNT(*) FILTER (WHERE up.is_winner IS NULL) as pending_picks,
    -- Check if all picks have results
    (COUNT(*) FILTER (WHERE up.is_winner IS NULL) = 0) as all_resulted
  INTO pick_stats
  FROM user_picks up
  WHERE up.user_entry_id = entry_record.id;
  
  -- Update round statistics
  UPDATE rounds 
  SET 
    total_picks = pick_stats.total_picks,
    correct_picks = pick_stats.correct_picks,
    incorrect_picks = pick_stats.incorrect_picks,
    pushed_picks = pick_stats.pushed_picks,
    pending_picks = pick_stats.pending_picks,
    updated_at = NOW()
  WHERE id = p_round_id;
  
  -- Determine new status if all picks have results
  IF pick_stats.all_resulted THEN
    -- Calculate final result
    IF entry_record.is_flex THEN
      -- Flex entry logic
      IF pick_stats.correct_picks >= entry_record.required_picks THEN
        new_status := 'won';
      ELSE
        new_status := 'lost';
      END IF;
    ELSE
      -- Regular entry logic - need all picks correct
      IF pick_stats.incorrect_picks = 0 THEN
        IF pick_stats.pushed_picks > 0 THEN
          new_status := 'pushed';
        ELSE
          new_status := 'won';
        END IF;
      ELSE
        new_status := 'lost';
      END IF;
    END IF;
    
    -- Transition to final state
    PERFORM transition_round_state(p_round_id, new_status, 'all_results_in', 
      jsonb_build_object(
        'pick_stats', to_jsonb(pick_stats),
        'final_calculation_at', NOW()
      )
    );
    
    -- Calculate payout
    PERFORM calculate_round_payout(p_round_id);
  END IF;
  
  -- Log progress event
  INSERT INTO round_events (round_id, event_type, event_data)
  VALUES (p_round_id, 'progress_update', jsonb_build_object(
    'pick_stats', to_jsonb(pick_stats),
    'updated_at', NOW()
  ));
END;
$$ LANGUAGE plpgsql;
```

## Real-time Event Processing

### WebSocket Event Types
```typescript
interface RoundEvent {
  roundId: string;
  userId: string;
  eventType: 'state_change' | 'pick_result' | 'progress_update' | 'payout_calculated';
  data: {
    oldState?: string;
    newState?: string;
    pickResults?: Array<{
      matchupId: string;
      isWinner: boolean;
      isPush: boolean;
    }>;
    currentStats?: {
      totalPicks: number;
      correctPicks: number;
      pendingPicks: number;
    };
    payout?: {
      amount: number;
      multiplier: number;
    };
  };
  timestamp: string;
}
```

### Event Handlers
```typescript
// Backend WebSocket handler
class RoundLifecycleHandler {
  async handleRaceResult(raceId: string, results: RaceResult[]) {
    // Process results in database
    const affectedRounds = await this.processRaceResult(raceId, results);
    
    // Notify all affected users via WebSocket
    for (const roundId of affectedRounds) {
      const roundData = await this.getRoundData(roundId);
      const userId = roundData.userId;
      
      this.socketManager.emit(`user:${userId}`, {
        type: 'round_update',
        roundId,
        data: roundData
      });
    }
  }
  
  async handleScratch(raceEntryId: string, scratchTime: Date) {
    // Find affected matchups
    const affectedMatchups = await this.findMatchupsWithEntry(raceEntryId);
    
    // Process each matchup
    for (const matchup of affectedMatchups) {
      // Void the matchup or recalculate
      await this.handleMatchupChange(matchup.id, 'entry_scratched');
      
      // Find affected rounds
      const affectedRounds = await this.findRoundsWithMatchup(matchup.id);
      
      // Notify users
      for (const roundId of affectedRounds) {
        await this.notifyRoundChange(roundId, 'matchup_voided');
      }
    }
  }
}
```

## Race Day Operations

### Pre-Race Setup
1. **Lock Contest** → Transition all entries from `SUBMITTED` to `LOCKED`
2. **Validate All Picks** → Ensure no picks on scratched horses
3. **Calculate Potential Payouts** → Pre-calculate maximum possible winnings
4. **Set Up Real-time Monitoring** → Initialize WebSocket connections

### During Races
1. **Live Result Processing** → Update results as they come in
2. **Real-time Notifications** → Notify users immediately when their picks win/lose
3. **Progressive Updates** → Show running totals and potential remaining winnings
4. **Handle Changes** → Process scratches, AE elevations immediately

### Post-Race Settlement
1. **Final Calculations** → Calculate all payouts
2. **Payout Processing** → Update user bankrolls
3. **Audit Trail** → Log all transactions
4. **Historical Storage** → Archive completed rounds

## Monitoring & Analytics

### Key Metrics to Track
```sql
-- Round completion times by status
SELECT 
  status,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_minutes_to_complete,
  COUNT(*) as total_rounds
FROM rounds 
WHERE completed_at IS NOT NULL
GROUP BY status;

-- Pick accuracy by user
SELECT 
  ue.user_id,
  COUNT(up.*) as total_picks,
  COUNT(*) FILTER (WHERE up.is_winner = TRUE) as correct_picks,
  ROUND(COUNT(*) FILTER (WHERE up.is_winner = TRUE) * 100.0 / COUNT(*), 2) as accuracy_pct
FROM user_picks up
JOIN user_entries ue ON up.user_entry_id = ue.id
GROUP BY ue.user_id
ORDER BY accuracy_pct DESC;

-- Contest performance metrics
SELECT 
  c.name,
  COUNT(DISTINCT ue.id) as total_entries,
  COUNT(DISTINCT ue.user_id) as unique_users,
  SUM(ue.entry_amount) as total_entry_fees,
  COUNT(*) FILTER (WHERE r.status = 'won') as winning_entries,
  SUM(r.actual_payout) as total_payouts
FROM contests c
JOIN user_entries ue ON c.id = ue.contest_id
JOIN rounds r ON ue.id = r.user_entry_id
WHERE c.status = 'settled'
GROUP BY c.id, c.name;
```

## Error Handling & Recovery

### Race Cancellation Scenario
```sql
CREATE OR REPLACE FUNCTION handle_race_cancellation(p_race_id UUID)
RETURNS INTEGER AS $$
DECLARE
  affected_rounds INTEGER := 0;
  round_id UUID;
BEGIN
  -- Mark race as cancelled
  UPDATE races SET status = 'cancelled' WHERE id = p_race_id;
  
  -- Find all rounds with picks on matchups from this race
  FOR round_id IN
    SELECT DISTINCT r.id
    FROM rounds r
    JOIN user_entries ue ON r.user_entry_id = ue.id
    JOIN user_picks up ON ue.id = up.user_entry_id
    JOIN matchups m ON up.matchup_id = m.id
    JOIN matchup_entries me ON m.id = me.matchup_id
    JOIN race_entries re ON me.race_entry_id = re.id
    WHERE re.race_id = p_race_id
    AND r.status IN ('live', 'grading')
  LOOP
    -- Transition round to pushed (return entry amount)
    PERFORM transition_round_state(round_id, 'pushed', 'race_cancelled');
    affected_rounds := affected_rounds + 1;
  END LOOP;
  
  RETURN affected_rounds;
END;
$$ LANGUAGE plpgsql;
```

This comprehensive lifecycle system provides:
- ✅ Complete state machine with proper transitions
- ✅ Real-time result processing and notifications  
- ✅ Robust error handling for race day issues
- ✅ Full audit trail and analytics
- ✅ Scalable architecture for multiple concurrent contests
- ✅ Recovery procedures for edge cases
