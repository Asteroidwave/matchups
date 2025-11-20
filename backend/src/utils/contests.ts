/**
 * Contest configuration management
 * Reads from Supabase 'contests' table
 */

import { supabase, isSupabaseInitialized } from './supabase';

export interface ContestConfig {
  id: string;
  track: string;
  trackName: string;
  date: string; // YYYY-MM-DD
  contest_type?: string;
  entry_fee?: number;
  prize_pool?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  horsesCount?: number; // Number of horses in the contest
  firstPostTime?: string | null;
  lastPostTime?: string | null;
  lockTime?: string | null;
  lifecycleStatus?: string | null;
  timeUntilLockMs?: number | null;
  timeUntilStartMs?: number | null;
  timeUntilEndMs?: number | null;
}

// Track name mapping
const TRACK_NAMES: Record<string, string> = {
  'AQU': 'Aqueduct',
  'ARP': 'Arapahoe',
  'BAQ': 'Belmont Park',
  'BEL': 'Belmont At The Big A',
  'CAM': 'Camarero',
  'CEN': 'Century Downs',
  'CD': 'Churchill Downs',
  'CHS': 'Charleston',
  'CT': 'Charles Town',
  'DED': 'Delta Downs',
  'DMR': 'Del Mar',
  'EVD': 'Evangeline',
  'FP': 'Fairmount Park',
  'FL': 'Finger Lakes',
  'GP': 'Gulfstream Park',
  'HAW': 'Hawthorne',
  'IND': 'Horseshoe Indianapolis',
  'LA': 'Los Alamitos Quarter Horse',
  'LS': 'Lone Star',
  'LRL': 'Laurel Park',
  'MVR': 'Mahoning Valley Race Course',
  'MON': 'Montpelier',
  'MNR': 'Mountaineer',
  'OP': 'Oaklawn Park',
  'PEN': 'Penn National',
  'PHC': 'Pennsylvania Hunt Cup',
  'PRX': 'Parx Racing',
  'RP': 'Remington Park',
  'TUP': 'Turf Paradise',
  'WO': 'Woodbine',
  'WRD': 'Will Rogers',
  'ZIA': 'Zia Park',
};

const toMs = (value?: string | null): number => {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

const computeLifecycleInfo = (
  firstPostTime?: string | null,
  lockTime?: string | null,
  lastPostTime?: string | null,
) => {
  const now = Date.now();

  const firstMs = toMs(firstPostTime);
  const lockMs = toMs(lockTime);
  const lastMs = toMs(lastPostTime);

  const diff = (targetMs: number): number | null => {
    if (Number.isNaN(targetMs)) return null;
    return targetMs - now;
  };

  let status = 'pending';

  if (!Number.isNaN(lastMs) && now > lastMs) {
    status = 'settled';
  } else if (!Number.isNaN(firstMs) && now >= firstMs) {
    status = 'live';
  } else if (!Number.isNaN(lockMs) && now >= lockMs) {
    status = 'locked';
  } else if (!Number.isNaN(firstMs)) {
    status = 'scheduled';
  }

  return {
    status,
    timeUntilLockMs: diff(lockMs),
    timeUntilStartMs: diff(firstMs),
    timeUntilEndMs: diff(lastMs),
  };
};

/**
 * Get all active contests from Supabase
 */
export async function getActiveContests(): Promise<ContestConfig[]> {
  // If Supabase not configured, return empty array (fallback removed)
  if (!isSupabaseInitialized()) {
    console.warn('⚠️ Supabase not configured, cannot fetch contests');
    return [];
  }

  try {
    console.log('🔍 Querying Supabase for active contests...');
    const { data, error } = await supabase
      .from('contests')
      .select('*, track_data(metadata)')
      .eq('is_active', true)
      .order('date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching contests from Supabase:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    console.log(`📊 Supabase query returned ${data?.length || 0} contests`);
    if (data && data.length > 0) {
      console.log('Contests found:', data.map(c => ({ id: c.id, track: c.track, date: c.date, is_active: c.is_active })));
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No active contests found in Supabase');
      // Let's also check if there are any contests at all (including inactive)
      const { data: allData } = await supabase
        .from('contests')
        .select('id, track, date, is_active')
        .limit(10);
      console.log(`📋 Total contests in database (including inactive): ${allData?.length || 0}`);
      if (allData && allData.length > 0) {
        console.log('All contests:', allData);
      }
      return [];
    }

    const updatePromises: Array<Promise<unknown>> = [];

    const contests: ContestConfig[] = await Promise.all(
      data.map(async (contest: any) => {
        let horsesCount = 0;
        
        // Try to get horses_count from track_data metadata
        if (contest.track_data && Array.isArray(contest.track_data) && contest.track_data.length > 0) {
          const metadata = contest.track_data[0]?.metadata;
          if (metadata && typeof metadata === 'object') {
            horsesCount = metadata.horses_count || metadata.non_scratched_count || 0;
          }
        } else if (contest.track_data_id) {
          // If track_data relation didn't work, fetch directly
          try {
            const { data: trackData } = await supabase
              .from('track_data')
              .select('metadata')
              .eq('id', contest.track_data_id)
              .single();
            
            if (trackData?.metadata) {
              horsesCount = trackData.metadata.horses_count || trackData.metadata.non_scratched_count || 0;
            }
          } catch (err) {
            console.warn(`Could not fetch track_data for contest ${contest.id}:`, err);
          }
        }
        
        const firstPostTime = contest.first_post_time || null;
        const lastPostTime = contest.last_post_time || null;
        let lockTime = contest.lock_time || null;

        if (!lockTime && firstPostTime) {
          const firstDate = new Date(firstPostTime);
          if (!Number.isNaN(firstDate.getTime())) {
            lockTime = new Date(firstDate.getTime() - 10 * 60 * 1000).toISOString();
          }
        }

        const lifecycleInfo = computeLifecycleInfo(firstPostTime, lockTime, lastPostTime);
        const lifecycleStatus = lifecycleInfo.status;

        if (contest.lifecycle_status !== lifecycleStatus || contest.lock_time !== lockTime) {
          updatePromises.push(
            supabase
              .from('contests')
              .update({
                lifecycle_status: lifecycleStatus,
                lock_time: lockTime,
                updated_at: new Date().toISOString(),
              })
              .eq('id', contest.id)
          );
        }

        return {
          id: contest.id || `${contest.track}-${contest.date}`,
          track: contest.track,
          trackName: TRACK_NAMES[contest.track] || contest.track,
          date: contest.date,
          contest_type: contest.contest_type,
          entry_fee: contest.entry_fee,
          prize_pool: contest.prize_pool,
          isActive: contest.is_active,
          createdAt: contest.created_at,
          updatedAt: contest.updated_at,
          horsesCount, // Add horse count
          firstPostTime,
          lastPostTime,
          lockTime,
          lifecycleStatus,
          timeUntilLockMs: lifecycleInfo.timeUntilLockMs,
          timeUntilStartMs: lifecycleInfo.timeUntilStartMs,
          timeUntilEndMs: lifecycleInfo.timeUntilEndMs,
        };
      })
    );

    if (updatePromises.length > 0) {
      try {
        await Promise.all(updatePromises);
      } catch (updateError) {
        console.warn('⚠️ Failed to persist lifecycle updates for some contests:', updateError);
      }
    }
 
    console.log(`✅ Loaded ${contests.length} active contests from Supabase`);
    return contests;
  } catch (err) {
    console.error('Exception fetching contests:', err);
    return [];
  }
}

/**
 * Get contest by track and date
 */
export async function getContestByTrackAndDate(
  track: string,
  date: string
): Promise<ContestConfig | null> {
  if (!isSupabaseInitialized()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('contests')
      .select('*')
      .eq('track', track.toUpperCase())
      .eq('date', date)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const lifecycleInfo = computeLifecycleInfo(
      data.first_post_time,
      data.lock_time,
      data.last_post_time,
    );

    return {
      id: data.id || `${data.track}-${data.date}`,
      track: data.track,
      trackName: TRACK_NAMES[data.track] || data.track,
      date: data.date,
      contest_type: data.contest_type,
      entry_fee: data.entry_fee,
      prize_pool: data.prize_pool,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      firstPostTime: data.first_post_time || null,
      lastPostTime: data.last_post_time || null,
      lockTime: data.lock_time || null,
      lifecycleStatus: data.lifecycle_status || null,
      ...lifecycleInfo,
    };
  } catch (err) {
    console.error('Error fetching contest by track/date:', err);
    return null;
  }
}

