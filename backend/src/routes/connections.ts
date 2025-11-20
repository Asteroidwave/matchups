import { Router, Request, Response } from 'express';
import { getJockeyPerformances, getTrainerPerformances, getSirePerformances } from '../utils/mongodb';
import { cache } from '../utils/cache';

export const connectionsRouter = Router();

/**
 * GET /api/connections?type=jockey|trainer|sire&track=GP&date=YYYY-MM-DD
 * 
 * Fetch connections (jockeys, trainers, or sires) for a track and date
 */
connectionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    const track = req.query.track as string;
    const date = req.query.date as string;

    if (!type || !['jockey', 'trainer', 'sire'].includes(type)) {
      return res.status(400).json({
        error: 'Type parameter is required and must be: jockey, trainer, or sire',
      });
    }

    if (!track) {
      return res.status(400).json({
        error: 'Track parameter is required',
      });
    }

    if (!date) {
      return res.status(400).json({
        error: 'Date parameter is required (format: YYYY-MM-DD)',
      });
    }

    // Check cache first
    const cacheKey = `connections:${type}:${track.toUpperCase()}:${date}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get the appropriate collection
    let collection;
    if (type === 'jockey') {
      collection = await getJockeyPerformances();
    } else if (type === 'trainer') {
      collection = await getTrainerPerformances();
    } else {
      collection = await getSirePerformances();
    }

    // Query for connections on this track/date
    // Note: Adjust query based on your actual MongoDB schema
    const query: any = {
      track: track.toUpperCase(),
    };

    if (date) {
      query.date = date;
    }

    const connections = await collection.find(query).toArray();

    const response = {
      type,
      track: track.toUpperCase(),
      date,
      connections,
    };

    // Cache for 1 hour
    cache.set(cacheKey, response, 60 * 60 * 1000);

    res.json(response);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({
      error: 'Failed to fetch connections',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

