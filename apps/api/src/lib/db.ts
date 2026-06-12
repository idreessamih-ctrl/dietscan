import { Pool, QueryResult, QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "../config";

export const pool = new Pool({
  host: config.PGHOST,
  port: config.PGPORT,
  user: config.PGUSER,
  password: config.PGPASSWORD,
  database: config.PGDATABASE,
  max: 10,
});

export const db = drizzle(pool);

/**
 * Executes a parameterized SQL query.
 * All SQL statements must be parameterized.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

