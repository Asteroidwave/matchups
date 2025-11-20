import { supabase } from '../utils/supabase';

/**
 * Update contest lifecycle status based on current time
 * Called periodically by a cron job or on-demand
 */
export async function updateContestLifecycle(): Promise<void> {
  if (!supabase) {
    console.warn('Supabase not initialized, skipping lifecycle update');
    return;
  }

  const now = new Date();

  try {
    // Get all active contests
    const { data: contests, error } = await supabase
      .from('contests')
      .select('*')
      .eq('is_active', true)
      .in('lifecycle_status', ['scheduled', 'locked', 'live'])
      .order('lock_time', { ascending: true });

    if (error) {
      console.error('Error fetching contests for lifecycle update:', error);
      return;
    }

    if (!contests || contests.length === 0) {
      console.log('No active contests to update');
      return;
    }

    console.log(`Processing ${contests.length} contests for lifecycle updates`);

    for (const contest of contests) {
      let newStatus = contest.lifecycle_status;
      let shouldUpdate = false;

      // Determine new status based on times
      if (contest.lock_time && now >= new Date(contest.lock_time)) {
        if (contest.lifecycle_status === 'scheduled') {
          newStatus = 'locked';
          shouldUpdate = true;
        }
      }

      if (contest.first_post_time && now >= new Date(contest.first_post_time)) {
        if (contest.lifecycle_status === 'locked' || contest.lifecycle_status === 'scheduled') {
          newStatus = 'live';
          shouldUpdate = true;
        }
      }

      // Check if all races are complete (simplified - would need actual race data)
      if (contest.last_post_time) {
        const lastPostTime = new Date(contest.last_post_time);
        // Assume races complete 3 hours after last post time
        const assumedCompleteTime = new Date(lastPostTime.getTime() + (3 * 60 * 60 * 1000));
        
        if (now >= assumedCompleteTime && contest.lifecycle_status === 'live') {
          newStatus = 'pending'; // Pending settlement
          shouldUpdate = true;
        }
      }

      // Update if status changed
      if (shouldUpdate && newStatus !== contest.lifecycle_status) {
        const { error: updateError } = await supabase
          .from('contests')
          .update({ 
            lifecycle_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', contest.id);

        if (updateError) {
          console.error(`Error updating contest ${contest.id} status:`, updateError);
        } else {
          console.log(`Updated contest ${contest.id} status from ${contest.lifecycle_status} to ${newStatus}`);
        }
      }
    }

  } catch (error) {
    console.error('Error in contest lifecycle update:', error);
  }
}

/**
 * Get contest status display info
 */
export function getContestStatusInfo(status: string) {
  switch (status) {
    case 'scheduled':
      return { label: 'Scheduled', color: 'blue' };
    case 'locked':
      return { label: 'Locked', color: 'orange' };
    case 'live':
      return { label: 'Live', color: 'green' };
    case 'pending':
      return { label: 'Pending Results', color: 'yellow' };
    case 'settled':
      return { label: 'Completed', color: 'gray' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
}

/**
 * Check if contest accepts new entries
 */
export function canAcceptEntries(contest: any): boolean {
  if (!contest.is_active) return false;
  
  // Can only accept entries if scheduled and not yet locked
  if (contest.lifecycle_status !== 'scheduled') return false;
  
  // Check lock time
  if (contest.lock_time) {
    const now = new Date();
    const lockTime = new Date(contest.lock_time);
    return now < lockTime;
  }
  
  return true;
}
