import { Pool, type PoolConfig } from "pg";

const pools = new Map<string, Pool>();

export function getPool(key: string, config: PoolConfig) {
  if (!pools.has(key)) {
    pools.set(key, new Pool(config));
  }

  return pools.get(key)!;
}

export async function closeAllPools() {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}
