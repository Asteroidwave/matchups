import { Router, Request, Response } from 'express';
import { getActiveContests } from '../utils/contests';
import { getCache, setCache } from '../utils/redis';

export const contestsRouter = Router();

/**
 * GET /api/contests
 * 
 * Get all active contests available for players
 * Returns contest configuration (track, date, etc.)
 */
contestsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'contests:active';
    
    // Check cache first (cache for 1 hour)
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get active contests
    const contests = await getActiveContests();

    const response = {
      contests,
      count: contests.length,
      timestamp: new Date().toISOString(),
    };

    // Cache for 5 minutes (shorter TTL for dynamic admin changes)
    await setCache(cacheKey, response, 5 * 60);

    res.json(response);
  } catch (error) {
    console.error('Error fetching contests:', error);
    res.status(500).json({
      error: 'Failed to fetch contests',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contests/:track/:date
 * 
 * Get specific contest by track and date
 */
contestsRouter.get('/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const cacheKey = `contest:${track.toUpperCase()}:${date}`;
    
    // Check cache first
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get contest
    const { getContestByTrackAndDate } = await import('../utils/contests');
    const contest = await getContestByTrackAndDate(track, date);

    if (!contest) {
      return res.status(404).json({
        error: 'Contest not found',
        track,
        date,
      });
    }

    // Cache for 1 hour
    await setCache(cacheKey, contest, 60 * 60);

    res.json(contest);
  } catch (error) {
    console.error('Error fetching contest:', error);
    res.status(500).json({
      error: 'Failed to fetch contest',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

