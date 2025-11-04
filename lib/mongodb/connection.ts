import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI_COMMON) {
  throw new Error('Please add MONGODB_URI_COMMON to .env.local');
}

if (!process.env.MONGODB_URI_STAGING) {
  throw new Error('Please add MONGODB_URI_STAGING to .env.local');
}

// MongoDB connection URIs (match your Python scripts)
const MONGODB_URI_COMMON = process.env.MONGODB_URI_COMMON;
const MONGODB_URI_STAGING = process.env.MONGODB_URI_STAGING;

// Global connections (reuse across requests)
let clientCommon: MongoClient | null = null;
let clientStaging: MongoClient | null = null;

// Databases
let dbCommon: Db | null = null;
let dbStaging: Db | null = null;

/**
 * Get MongoDB client for common-central database
 */
export async function getCommonClient(): Promise<MongoClient> {
  if (!clientCommon) {
    clientCommon = new MongoClient(MONGODB_URI_COMMON);
    await clientCommon.connect();
  }
  return clientCommon;
}

/**
 * Get MongoDB client for staging-gos database
 */
export async function getStagingClient(): Promise<MongoClient> {
  if (!clientStaging) {
    clientStaging = new MongoClient(MONGODB_URI_STAGING);
    await clientStaging.connect();
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
  }
  if (clientStaging) {
    await clientStaging.close();
    clientStaging = null;
    dbStaging = null;
  }
}

