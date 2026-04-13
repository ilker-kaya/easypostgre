import crypto from "node:crypto";
import { SavedSnippet, ServerRecord, ServerSecret, QueryHistoryItem } from "./types.js";

const keyMaterial = process.env.APP_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const key = crypto.createHash("sha256").update(keyMaterial).digest();

const servers = new Map<string, ServerRecord>();
const secrets = new Map<string, ServerSecret>();
const history: QueryHistoryItem[] = [];
const snippets = new Map<string, SavedSnippet>();

function encrypt(password: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

export const store = {
  listServers: () => [...servers.values()],
  getServer: (id: string) => servers.get(id),
  setServer: (server: ServerRecord, password: string) => {
    servers.set(server.id, server);
    secrets.set(server.id, { serverId: server.id, encryptedPassword: encrypt(password) });
  },
  updateServer: (server: ServerRecord, password?: string) => {
    servers.set(server.id, server);
    if (password) {
      secrets.set(server.id, { serverId: server.id, encryptedPassword: encrypt(password) });
    }
  },
  deleteServer: (id: string) => {
    servers.delete(id);
    secrets.delete(id);
  },
  getPassword: (serverId: string) => {
    const item = secrets.get(serverId);
    return item ? decrypt(item.encryptedPassword) : null;
  },
  addHistory: (item: QueryHistoryItem) => {
    history.unshift(item);
    if (history.length > 200) history.pop();
  },
  historyByServer: (serverId: string) => history.filter((x) => x.serverId === serverId),
  listSnippets: (serverId: string) => [...snippets.values()].filter((x) => x.serverId === serverId),
  upsertSnippet: (snippet: SavedSnippet) => snippets.set(snippet.id, snippet),
  deleteSnippet: (id: string) => snippets.delete(id)
};
