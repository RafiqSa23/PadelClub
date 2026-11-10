import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

function createDb() {
  // Pool kecil per instance: Neon/serverless membatasi koneksi total, dan query
  // aplikasi pendek-pendek. `max` bisa dinaikkan lewat env bila perlu.
  const max = Number(process.env.DB_POOL_MAX ?? 5);
  const client = postgres(connectionString, {
    prepare: false,
    max: Number.isFinite(max) && max > 0 ? max : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle({ client, schema });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;