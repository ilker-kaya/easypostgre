export type EnvTag = "local" | "staging" | "prod";

export type ServerRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  database: string;
  ssl: boolean;
  envTag?: EnvTag;
  createdAt: string;
  updatedAt: string;
};

export type ServerSecret = {
  serverId: string;
  encryptedPassword: string;
};

export type ServerConnectionPayload = {
  name: string;
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  envTag?: EnvTag;
};

export type QueryHistoryItem = {
  id: string;
  serverId: string;
  sql: string;
  startedAt: string;
  durationMs: number;
  rowCount: number;
  ok: boolean;
  errorMessage?: string;
};

export type SavedSnippet = {
  id: string;
  serverId: string;
  name: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
};
