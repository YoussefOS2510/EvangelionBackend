import pg from 'pg';
import { config } from '../config/env.js';
import { memoryDb } from './memory_db.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

let postgresAvailable: boolean | null = null;
let loggedFallback = false;

pool.on('error', () => {
  postgresAvailable = false;
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  if (postgresAvailable === false) {
    const memRes = await memoryDb.executeQuery(text, params);
    return {
      rows: memRes.rows as T[],
      rowCount: memRes.rowCount,
      command: '',
      oid: 0,
      fields: []
    };
  }

  try {
    const res = await pool.query<T>(text, params);
    postgresAvailable = true;
    return res;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('connect ECONNREFUSED')) {
      postgresAvailable = false;
      if (!loggedFallback) {
        console.warn('⚠️ [DB Fallback] PostgreSQL offline at localhost:5432 - using active in-memory development database.');
        loggedFallback = true;
      }
      const memRes = await memoryDb.executeQuery(text, params);
      return {
        rows: memRes.rows as T[],
        rowCount: memRes.rowCount,
        command: '',
        oid: 0,
        fields: []
      };
    }
    throw err;
  }
}

export async function getClient() {
  if (postgresAvailable === false) {
    return createMemoryClient();
  }

  try {
    const client = await pool.connect();
    postgresAvailable = true;
    return client;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('connect ECONNREFUSED')) {
      postgresAvailable = false;
      if (!loggedFallback) {
        console.warn('⚠️ [DB Fallback] PostgreSQL offline at localhost:5432 - using active in-memory development database.');
        loggedFallback = true;
      }
      return createMemoryClient();
    }
    throw err;
  }
}

function createMemoryClient() {
  return {
    query: async (text: string, params?: any[]) => {
      const res = await memoryDb.executeQuery(text, params);
      return {
        rows: res.rows,
        rowCount: res.rowCount,
        command: '',
        oid: 0,
        fields: []
      };
    },
    release: () => {}
  } as any;
}
