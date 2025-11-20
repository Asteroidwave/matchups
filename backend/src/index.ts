import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST - explicitly specify path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialize Redis IMMEDIATELY after dotenv.config() (before importing routes)
import { initializeRedis } from './utils/redis';
initializeRedis();

// Initialize Supabase AFTER dotenv.config() has run
import { initializeSupabase } from './utils/supabase';
initializeSupabase();

// Debug: Log environment variables and Redis status
console.log('🔍 Environment check:');
console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing');
console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

// Import routes AFTER Redis is initialized (they import redis utils)
import { tracksRouter } from './routes/tracks';
import { connectionsRouter } from './routes/connections';
import { matchupsRouter } from './routes/matchups';
import { healthRouter } from './routes/health';
import { contestsRouter } from './routes/contests';
import { entriesRouter } from './routes/entries';
import { adminRouter } from './routes/admin';
import { adminTrackDataRouter } from './routes/admin-track-data';
import { adminContestsRouter } from './routes/admin-contests';
import { adminOperationsRouter } from './routes/admin-operations';
import simulationRouter from './routes/simulation';
import crossTrackRouter from './routes/cross-track'; // NEW
import multiTrackRouter from './routes/multi-track-matchups';
import allTracksContestRouter from './routes/all-tracks-contest'; // NEW
import { relationalDataRouter } from './routes/relational-data'; // NEW RELATIONAL ARCHITECTURE
import { debugMongoRouter } from './routes/debug-mongo'; // DEBUG MONGO DATA
import { debugIngestionRouter } from './routes/debug-ingestion'; // DEBUG INGESTION STEPS
import { debugSimpleRouter } from './routes/debug-simple'; // SIMPLE DEBUG
import { debugBasicRouter } from './routes/debug-basic'; // BASIC TESTS
import { debugMinimalRouter } from './routes/debug-minimal'; // MINIMAL TESTS
import { workingIngestionRouter } from './routes/working-ingestion'; // WORKING INGESTION
import { debugHorsesRouter } from './routes/debug-horses'; // DEBUG HORSES
import { finalWorkingIngestionRouter } from './routes/final-working-ingestion'; // FINAL WORKING
import { fixedSummaryRouter } from './routes/fixed-summary'; // FIXED SUMMARY API
import { debugEntriesRouter } from './routes/debug-entries'; // DEBUG ENTRIES
import { userManagementRouter } from './routes/user-management'; // USER MANAGEMENT
import { demoUserRouter } from './routes/demo-user'; // DEMO USER CREATION
import { testProfileColumnsRouter } from './routes/test-profile-columns'; // TEST PROFILE COLUMNS
import { testAuthRouter } from './routes/test-auth'; // TEST AUTHENTICATION
import { simpleUserApiRouter } from './routes/simple-user-api'; // SIMPLE USER API
import { migrationDebugRouter } from './routes/migration-debug'; // MIGRATION DEBUG
import { simpleSummaryRouter } from './routes/simple-summary'; // SIMPLE SUMMARY
import { completeIngestionRouter } from './routes/complete-ingestion'; // COMPLETE INGESTION
import { createServer } from 'http';
import { initializeWebSocket } from './services/websocket';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
// Increase payload limit for large localStorage migration data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/health', healthRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/matchups', matchupsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/cross-track', crossTrackRouter); // NEW
app.use('/api/all-tracks-contest', allTracksContestRouter); // NEW
app.use('/api/v2', relationalDataRouter); // NEW RELATIONAL API
app.use('/api/debug/mongo', debugMongoRouter); // DEBUG MONGO DATA
app.use('/api/debug/ingestion', debugIngestionRouter); // DEBUG INGESTION STEPS
app.use('/api/debug/simple', debugSimpleRouter); // SIMPLE DEBUG
app.use('/api/debug/basic', debugBasicRouter); // BASIC TESTS
app.use('/api/debug/minimal', debugMinimalRouter); // MINIMAL TESTS
app.use('/api/working', workingIngestionRouter); // WORKING INGESTION
app.use('/api/debug/horses', debugHorsesRouter); // DEBUG HORSES
app.use('/api/final', finalWorkingIngestionRouter); // FINAL WORKING INGESTION
app.use('/api/fixed', fixedSummaryRouter); // FIXED SUMMARY API
app.use('/api/debug/entries', debugEntriesRouter); // DEBUG ENTRIES
app.use('/api/users', userManagementRouter); // USER MANAGEMENT APIs
app.use('/api/demo', demoUserRouter); // DEMO USER CREATION
app.use('/api/test', testProfileColumnsRouter); // TEST PROFILE COLUMNS
app.use('/api/test-auth', testAuthRouter); // TEST AUTHENTICATION
app.use('/api/simple-user', simpleUserApiRouter); // SIMPLE USER API
app.use('/api/migration-debug', migrationDebugRouter); // MIGRATION DEBUG
app.use('/api/simple', simpleSummaryRouter); // SIMPLE SUMMARY
app.use('/api/complete', completeIngestionRouter); // COMPLETE INGESTION
// Mount multi-track bundles BEFORE the general /api/admin guard
app.use('/api/admin/multi-track-matchups', multiTrackRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/tracks', adminTrackDataRouter);
app.use('/api/admin/contests', adminContestsRouter);
app.use('/api/admin/operations', adminOperationsRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Create HTTP server and initialize WebSocket
const httpServer = createServer(app);
initializeWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSocket server initialized`);
});

