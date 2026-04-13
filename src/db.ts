import { Pool } from "pg";
import { store } from "./store.js";

export function getPoolForServer(serverId: string): Pool {
  const server = store.getServer(serverId);
  if (!server) throw new Error("Server not found");
  const password = store.getPassword(serverId);
  if (!password) throw new Error("Server credentials missing");

  return new Pool({
    host: server.host,
    port: server.port,
    user: server.user,
    password,
    database: server.database,
    ssl: server.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
  });
}

export async function withPool<T>(serverId: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getPoolForServer(serverId);
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}
