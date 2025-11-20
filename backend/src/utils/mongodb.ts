import { MongoClient, Db } from 'mongodb';

// Global connections (reuse across requests)
let clientCommon: MongoClient | null = null;
let clientStaging: MongoClient | null = null;
let dbCommon: Db | null = null;
let dbStaging: Db | null = null;

/**
 * Get MongoDB URI for common-central database
 */
function getMongoUriCommon(): string {
  const uri = process.env.MONGODB_URI_COMMON;
  if (!uri) {
    throw new Error('MONGODB_URI_COMMON environment variable is not set');
  }
  return uri;
}

/**
 * Get MongoDB URI for staging-gos database
 */
function getMongoUriStaging(): string {
  const uri = process.env.MONGODB_URI_STAGING;
  if (!uri) {
    throw new Error('MONGODB_URI_STAGING environment variable is not set');
  }
  return uri;
}

/**
 * Get MongoDB client for common-central database
 */
export async function getCommonClient(): Promise<MongoClient> {
  if (!clientCommon) {
    const uri = getMongoUriCommon();
    clientCommon = new MongoClient(uri);
    await clientCommon.connect();
    console.log('✅ Connected to MongoDB (common-central)');
  }
  return clientCommon;
}

/**
 * Get MongoDB client for staging-gos database
 */
export async function getStagingClient(): Promise<MongoClient> {
  if (!clientStaging) {
    const uri = getMongoUriStaging();
    clientStaging = new MongoClient(uri);
    await clientStaging.connect();
    console.log('✅ Connected to MongoDB (staging-gos)');
  }
  return clientStaging;
}

/**
 * Get common-central database
 */
export async function getCommonDb(): Promise<Db> {
  if (!dbCommon) {
    const client = await getCommonClient();
    dbCommon = client.db('test');
  }
  return dbCommon;
}

/**
 * Get staging-gos database
 */
export async function getStagingDb(): Promise<Db> {
  if (!dbStaging) {
    const client = await getStagingClient();
    dbStaging = client.db('gostesting');
  }
  return dbStaging;
}

/**
 * Collections from common-central
 */
export async function getEquibaseEntries() {
  const db = await getCommonDb();
  return db.collection('equibase_entries');
}

export async function getEquibaseResults() {
  const db = await getCommonDb();
  return db.collection('equibase_results');
}

/**
 * Collections from staging-gos
 */
export async function getHorsesCollection() {
  const db = await getStagingDb();
  return db.collection('horses');
}

export async function getJockeyPerformances() {
  const db = await getStagingDb();
  return db.collection('jockeyperformances');
}

export async function getTrainerPerformances() {
  const db = await getStagingDb();
  return db.collection('trainerperformances');
}

export async function getSirePerformances() {
  const db = await getStagingDb();
  return db.collection('sireperformances');
}

/**
 * Close all connections (useful for cleanup)
 */
export async function closeConnections(): Promise<void> {
  if (clientCommon) {
    await clientCommon.close();
    clientCommon = null;
    dbCommon = null;
    console.log('🔌 Closed MongoDB connection (common-central)');
  }
  if (clientStaging) {
    await clientStaging.close();
    clientStaging = null;
    dbStaging = null;
    console.log('🔌 Closed MongoDB connection (staging-gos)');
  }
}

