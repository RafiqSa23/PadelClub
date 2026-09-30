import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

function createDb() {
  const client = postgres(connectionString, { prepare: false });
  return drizzle({ client, schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;