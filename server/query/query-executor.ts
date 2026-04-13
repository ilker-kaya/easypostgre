import type { Pool } from "pg";

export async function executeQuery(pool: Pool, sql: string) {
  const startedAt = Date.now();
  const result = await pool.query(sql);

  return {
    rows: result.rows,
    rowCount: result.rowCount,
    elapsedMs: Date.now() - startedAt,
  };
}
