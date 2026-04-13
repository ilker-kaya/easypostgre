import type { Pool } from "pg";

export async function listSchemas(pool: Pool) {
  const result = await pool.query(
    `select schema_name from information_schema.schemata where schema_name not like 'pg_%' order by schema_name`,
  );

  return result.rows.map((row) => row.schema_name as string);
}
