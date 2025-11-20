/**
 * Debug MongoDB Data Routes - UPDATED VERSION
 * Detailed inspection of actual MongoDB structure
 */
import { Router, Request, Response } from 'express';
import { getCommonDb } from '../utils/mongodb';

export const debugMongoRouter = Router();

/**
 * GET /api/debug/mongo/inspect/:track/:date
 * Deep inspection of actual MongoDB data structure
 */
debugMongoRouter.get('/inspect/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    const db = await getCommonDb();
    const entriesCollection = db.collection('equibase_entries');
    
    // Find entries matching the track/date pattern
    const dateObj = new Date(date);
    const entries = await entriesCollection.find({
      raceDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` }
    }).limit(3).toArray(); // Get first 3 entries for detailed inspection
    
    res.json({
      searchCriteria: {
        track: track.toUpperCase(),
        date: date,
        raceNamePattern: `^${track.toUpperCase()}-`
      },
      foundEntries: entries.length,
      detailedInspection: entries.map(entry => ({
        raceInfo: {
          raceNameForDB: entry.raceNameForDB,
          raceNumber: entry.raceNumber,
          raceDate: entry.raceDate,
          postTime: entry.postTime,
          trackId: entry.trackId
        },
        startersStructure: {
          hasStarters: !!entry.starters,
          startersType: Array.isArray(entry.starters) ? 'array' : typeof entry.starters,
          startersCount: Array.isArray(entry.starters) ? entry.starters.length : 0,
          sampleStarter: Array.isArray(entry.starters) && entry.starters.length > 0 ? {
            keys: Object.keys(entry.starters[0]),
            sample: entry.starters[0]
          } : null
        },
        allFields: Object.keys(entry)
      }))
    });
    
  } catch (error) {
    console.error('MongoDB inspect error:', error);
    res.status(500).json({
      error: 'Failed to inspect MongoDB',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/mongo/available
 * Get all available track/date combinations with correct field names
 */
debugMongoRouter.get('/available', async (req: Request, res: Response) => {
  try {
    const db = await getCommonDb();
    const entriesCollection = db.collection('equibase_entries');
    
    // Get unique track/date combinations using correct field names
    const combinations = await entriesCollection.aggregate([
      {
        $addFields: {
          trackCode: {
            $arrayElemAt: [
              { $split: ["$raceNameForDB", "-"] },
              0
            ]
          },
          dateString: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$raceDate"
            }
          }
        }
      },
      {
        $group: {
          _id: {
            track: "$trackCode",
            date: "$dateString"
          },
          entryCount: { $sum: 1 },
          raceNumbers: { $addToSet: "$raceNumber" }
        }
      },
      { $sort: { "_id.date": -1, "_id.track": 1 } },
      { $limit: 20 }
    ]).toArray();
    
    const suggestions = combinations.map(combo => ({
      track: combo._id.track,
      date: combo._id.date,
      entries: combo.entryCount,
      races: combo.raceNumbers.length,
      testUrl: `/api/v2/data/ingest/${combo._id.track}/${combo._id.date}`,
      inspectUrl: `/api/debug/mongo/inspect/${combo._id.track}/${combo._id.date}`
    }));
    
    res.json({
      totalCombinations: combinations.length,
      suggestions,
      message: "Available track/date combinations from your MongoDB data"
    });
    
  } catch (error) {
    console.error('MongoDB debug error:', error);
    res.status(500).json({
      error: 'Failed to query MongoDB',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/mongo/starters/:track/:date
 * Inspect the starters data structure specifically
 */
debugMongoRouter.get('/starters/:track/:date', async (req: Request, res: Response) => {
  try {
    const { track, date } = req.params;
    
    const db = await getCommonDb();
    const entriesCollection = db.collection('equibase_entries');
    
    const dateObj = new Date(date);
    const entry = await entriesCollection.findOne({
      raceDate: {
        $gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(dateObj.setHours(23, 59, 59, 999))
      },
      raceNameForDB: { $regex: `^${track.toUpperCase()}-` },
      starters: { $exists: true, $not: { $size: 0 } }
    });
    
    if (!entry || !entry.starters) {
      return res.json({
        found: false,
        message: "No entries found with starters data for this track/date"
      });
    }
    
    res.json({
      found: true,
      raceInfo: {
        raceNameForDB: entry.raceNameForDB,
        raceNumber: entry.raceNumber,
        raceDate: entry.raceDate
      },
      startersAnalysis: {
        count: entry.starters.length,
        sampleStarter: entry.starters[0],
        allFieldsInStarters: entry.starters.length > 0 ? Object.keys(entry.starters[0]) : [],
        structureVariations: entry.starters.slice(0, 3).map(starter => Object.keys(starter))
      }
    });
    
  } catch (error) {
    console.error('MongoDB starters debug error:', error);
    res.status(500).json({
      error: 'Failed to inspect starters',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});