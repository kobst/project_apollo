import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required when using the postgres storage backend');
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
    });
  }

  return pool;
}
