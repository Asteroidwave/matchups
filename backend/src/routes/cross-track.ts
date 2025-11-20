/**
 * Cross-Track Matchups API
 * Supports unlimited tracks (2-20+)
 */

import express from 'express';
import { supabase } from '../utils/supabase';
import { generateCrossTrackMatchupsForDate } from '../services/simpleCrossTrack';

const router = express.Router();

/**
 * GET /api/cross-track/:date
 * Generate cross-track matchups for a specific date
 * Query params:
 *   - maxTracks: Maximum number of tracks to include (default: 20)
 */
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const maxTracks = parseInt(req.query.maxTracks as string) || 20; // Increased default to 20
    
    console.log(`[API] Cross-track request for date: ${date}, maxTracks: ${maxTracks}`);
    
    // Generate matchups
    const result = await generateCrossTrackMatchupsForDate(date, maxTracks);
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        tracks: result.tracks
      });
    }
    
    // Return matchups
    res.json({
      success: true,
      matchups: result.matchups,
      tracks: result.tracks,
      count: result.matchups.length,
      date
    });
    
  } catch (error) {
    console.error('[API] Error generating cross-track matchups:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/cross-track/available-dates
 * Get dates that have multiple contests (can do cross-track)
 */
router.get('/available-dates', async (req, res) => {
  try {
    // Find dates with 2+ active contests
    const { data: contests } = await supabase
      .from('contests')
      .select('date, track, is_active')
      .eq('is_active', true)
      .order('date', { ascending: false });
    
    if (!contests) {
      return res.json({ dates: [] });
    }
    
    // Group by date
    const dateMap = new Map<string, string[]>();
    for (const contest of contests) {
      const tracks = dateMap.get(contest.date) || [];
      tracks.push(contest.track);
      dateMap.set(contest.date, tracks);
    }
    
    // Filter to dates with 2+ tracks
    const availableDates = Array.from(dateMap.entries())
      .filter(([_, tracks]) => tracks.length >= 2)
      .map(([date, tracks]) => ({
        date,
        tracks,
        trackCount: tracks.length
      }));
    
    res.json({
      dates: availableDates
    });
    
  } catch (error) {
    console.error('[API] Error getting available dates:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;

