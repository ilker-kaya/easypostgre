import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { z } from "zod";
import { withPool } from "./db.js";
import { store } from "./store.js";
import { ServerConnectionPayload } from "./types.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "public");
const fallbackPublicDir = path.resolve(__dirname, "../src/public");
app.use(express.static(publicDir));

const serverSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).default(5432),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ssl: z.boolean().default(false),
  envTag: z.enum(["local", "staging", "prod"]).optional()
});

const idParam = z.object({ serverId: z.string().uuid() });

function safeServer(server: ReturnType<typeof store.getServer>) {
  if (!server) return null;
  return server;
}

async function testConnection(payload: ServerConnectionPayload) {
  const { Pool } = await import("pg");
  const pool = new Pool({
    host: payload.host,
    port: payload.port ?? 5432,
    user: payload.user,
    password: payload.password,
    database: payload.database,
    ssl: payload.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });
  try {
    await pool.query("select 1");
    return { ok: true };
  } finally {
    await pool.end();
  }
}

app.get("/api/servers", (_req, res) => {
  res.json({ servers: store.listServers() });
});

app.post("/api/servers", async (req, res) => {
  const parsed = serverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const server = { ...parsed.data, id, createdAt: now, updatedAt: now };
  try {
    await testConnection(parsed.data);
    store.setServer(server, parsed.data.password);
    res.status(201).json({ server: safeServer(server) });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/servers/:serverId", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid id" });
  const current = store.getServer(p.data.serverId);
  if (!current) return res.status(404).json({ error: "Not found" });

  const updateSchema = serverSchema.partial();
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const next = {
    ...current,
    ...parsed.data,
    updatedAt: new Date().toISOString()
  };

  try {
    await testConnection({
      ...next,
      password: parsed.data.password ?? store.getPassword(current.id) ?? ""
    });
    store.updateServer(next, parsed.data.password);
    res.json({ server: safeServer(next) });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/servers/:serverId", (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid id" });
  store.deleteServer(p.data.serverId);
  res.status(204).send();
});

app.post("/api/servers/:serverId/test", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid id" });
  const server = store.getServer(p.data.serverId);
  if (!server) return res.status(404).json({ error: "Not found" });
  const password = store.getPassword(server.id);
  if (!password) return res.status(500).json({ error: "Credential issue" });
  try {
    await testConnection({ ...server, password });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: (error as Error).message });
  }
});

app.get("/api/servers/:serverId/metadata", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid id" });
  try {
    const data = await withPool(p.data.serverId, async (pool) => {
      const [dbs, schemas, rels, funcs, triggers, seqs] = await Promise.all([
        pool.query(`select datname from pg_database where datistemplate=false order by datname`),
        pool.query(`select schema_name from information_schema.schemata order by schema_name`),
        pool.query(`
          select table_schema, table_name, table_type
          from information_schema.tables
          where table_schema not in ('pg_catalog','information_schema')
          order by table_schema, table_name
        `),
        pool.query(`
          select routine_schema, routine_name, routine_type
          from information_schema.routines
          where routine_schema not in ('pg_catalog','information_schema')
          order by routine_schema, routine_name
        `),
        pool.query(`
          select event_object_schema as schema_name, event_object_table as table_name, trigger_name
          from information_schema.triggers
          order by event_object_schema, event_object_table, trigger_name
        `),
        pool.query(`
          select sequence_schema, sequence_name
          from information_schema.sequences
          order by sequence_schema, sequence_name
        `)
      ]);
      return {
        databases: dbs.rows,
        schemas: schemas.rows,
        relations: rels.rows,
        functions: funcs.rows,
        triggers: triggers.rows,
        sequences: seqs.rows
      };
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/servers/:serverId/table-data", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const querySchema = z.object({
    schema: z.string().default("public"),
    table: z.string(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
    sortBy: z.string().optional(),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    filter: z.string().optional()
  });
  const parsed = querySchema.safeParse(req.query);
  if (!p.success || !parsed.success) return res.status(400).json({ error: "Invalid request" });
  const q = parsed.data;

  const safeIdent = (x: string) => /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(x);
  if (!safeIdent(q.schema) || !safeIdent(q.table) || (q.sortBy && !safeIdent(q.sortBy))) {
    return res.status(400).json({ error: "Unsafe identifier" });
  }

  try {
    const result = await withPool(p.data.serverId, async (pool) => {
      const offset = (q.page - 1) * q.pageSize;
      const where = q.filter ? "where cast(t as text) ilike $1" : "";
      const params = q.filter ? [`%${q.filter}%`] : [];

      const count = await pool.query(
        `select count(*)::int as total from (select * from "${q.schema}"."${q.table}" t ${where}) x`,
        params
      );

      const orderBy = q.sortBy ? `order by "${q.sortBy}" ${q.sortDir}` : "";
      const rowsQuery = `select * from "${q.schema}"."${q.table}" t ${where} ${orderBy} offset ${offset} limit ${q.pageSize}`;
      const rows = await pool.query(rowsQuery, params);

      const pk = await pool.query(
        `
        select kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
        where tc.constraint_type='PRIMARY KEY' and tc.table_schema=$1 and tc.table_name=$2
        order by kcu.ordinal_position
        `,
        [q.schema, q.table]
      );

      return { rows: rows.rows, total: count.rows[0].total, primaryKeys: pk.rows.map((r) => r.column_name) };
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/servers/:serverId/table-data/:schema/:table", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const schema = req.params.schema;
  const table = req.params.table;
  const body = z.object({ values: z.record(z.any()) }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  const keys = Object.keys(body.data.values);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const values = keys.map((k) => body.data.values[k]);
  try {
    const data = await withPool(p.data.serverId, (pool) =>
      pool.query(`insert into "${schema}"."${table}" (${cols}) values (${placeholders}) returning *`, values)
    );
    res.status(201).json({ row: data.rows[0] });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.patch("/api/servers/:serverId/table-data/:schema/:table", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z
    .object({
      primaryKeys: z.array(z.string()).min(1),
      keyValues: z.record(z.any()),
      values: z.record(z.any())
    })
    .safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });

  const { primaryKeys, keyValues, values } = body.data;
  const setKeys = Object.keys(values);
  const setSql = setKeys.map((k, i) => `"${k}"=$${i + 1}`).join(",");
  const whereSql = primaryKeys.map((k, i) => `"${k}"=$${setKeys.length + i + 1}`).join(" and ");
  const params = [...setKeys.map((k) => values[k]), ...primaryKeys.map((k) => keyValues[k])];

  try {
    const data = await withPool(p.data.serverId, (pool) =>
      pool.query(
        `update "${req.params.schema}"."${req.params.table}" set ${setSql} where ${whereSql} returning *`,
        params
      )
    );
    res.json({ row: data.rows[0] });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/servers/:serverId/table-data/:schema/:table", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z.object({ primaryKeys: z.array(z.string()).min(1), rows: z.array(z.record(z.any())).min(1) }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });

  try {
    const deleted = await withPool(p.data.serverId, async (pool) => {
      let count = 0;
      for (const row of body.data.rows) {
        const where = body.data.primaryKeys.map((k, i) => `"${k}"=$${i + 1}`).join(" and ");
        const params = body.data.primaryKeys.map((k) => row[k]);
        const out = await pool.query(`delete from "${req.params.schema}"."${req.params.table}" where ${where}`, params);
        count += out.rowCount || 0;
      }
      return count;
    });
    res.json({ deleted });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/servers/:serverId/sql", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z.object({ sql: z.string().min(1) }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  const started = Date.now();
  try {
    const out = await withPool(p.data.serverId, (pool) => pool.query(body.data.sql));
    const durationMs = Date.now() - started;
    store.addHistory({
      id: crypto.randomUUID(),
      serverId: p.data.serverId,
      sql: body.data.sql,
      startedAt: new Date(started).toISOString(),
      durationMs,
      rowCount: out.rowCount ?? out.rows.length,
      ok: true
    });
    res.json({ rows: out.rows, fields: out.fields.map((f) => f.name), rowCount: out.rowCount ?? out.rows.length, durationMs });
  } catch (error) {
    const durationMs = Date.now() - started;
    store.addHistory({
      id: crypto.randomUUID(),
      serverId: p.data.serverId,
      sql: body.data.sql,
      startedAt: new Date(started).toISOString(),
      durationMs,
      rowCount: 0,
      ok: false,
      errorMessage: (error as Error).message
    });
    res.status(400).json({ error: (error as Error).message, durationMs });
  }
});

app.get("/api/servers/:serverId/sql/history", (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid request" });
  res.json({ history: store.historyByServer(p.data.serverId) });
});

app.get("/api/servers/:serverId/sql/snippets", (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid request" });
  res.json({ snippets: store.listSnippets(p.data.serverId) });
});

app.post("/api/servers/:serverId/sql/snippets", (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z.object({ name: z.string().min(1), sql: z.string().min(1), id: z.string().uuid().optional() }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  const now = new Date().toISOString();
  const snippet = {
    id: body.data.id ?? crypto.randomUUID(),
    serverId: p.data.serverId,
    name: body.data.name,
    sql: body.data.sql,
    createdAt: now,
    updatedAt: now
  };
  store.upsertSnippet(snippet);
  res.status(201).json({ snippet });
});

app.delete("/api/servers/:serverId/sql/snippets/:snippetId", (req, res) => {
  store.deleteSnippet(req.params.snippetId);
  res.status(204).send();
});

app.get("/api/servers/:serverId/roles", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid request" });
  try {
    const data = await withPool(p.data.serverId, (pool) =>
      pool.query(`select rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin from pg_roles order by rolname`)
    );
    res.json({ roles: data.rows });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/servers/:serverId/roles", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z.object({ name: z.string().min(1), login: z.boolean().default(true), password: z.string().optional() }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  try {
    await withPool(p.data.serverId, (pool) =>
      pool.query(`create role "${body.data.name}" ${body.data.login ? "login" : ""} ${body.data.password ? `password '${body.data.password.replace(/'/g, "''")}'` : ""}`)
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/servers/:serverId/roles/grant", async (req, res) => {
  const p = idParam.safeParse(req.params);
  const body = z.object({ role: z.string().min(1), grantee: z.string().min(1) }).safeParse(req.body);
  if (!p.success || !body.success) return res.status(400).json({ error: "Invalid request" });
  try {
    await withPool(p.data.serverId, (pool) => pool.query(`grant "${body.data.role}" to "${body.data.grantee}"`));
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/servers/:serverId/roles/:role", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid request" });
  try {
    await withPool(p.data.serverId, (pool) => pool.query(`drop role "${req.params.role}"`));
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/servers/:serverId/backup", async (req, res) => {
  const p = idParam.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: "Invalid request" });
  const server = store.getServer(p.data.serverId);
  const password = store.getPassword(p.data.serverId);
  if (!server || !password) return res.status(404).json({ error: "Server not found" });
  const outputPath = path.resolve("backups", `${server.name}-${Date.now()}.sql`);

  const check = await new Promise<boolean>((resolve) => {
    const proc = spawn("which", ["pg_dump"]);
    proc.on("exit", (code) => resolve(code === 0));
  });

  if (check) {
    const args = ["-h", server.host, "-p", String(server.port), "-U", server.user, "-d", server.database, "-f", outputPath];
    const proc = spawn("pg_dump", args, { env: { ...process.env, PGPASSWORD: password } });
    proc.on("exit", (code) => {
      if (code === 0) return res.json({ mode: "pg_dump", outputPath });
      return res.status(500).json({ error: "pg_dump failed" });
    });
    return;
  }

  try {
    const dump = await withPool(p.data.serverId, (pool) =>
      pool.query(`select table_schema, table_name from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')`)
    );
    res.json({ mode: "sql-fallback", tables: dump.rows, note: "Fallback returns table inventory for manual export." });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) res.sendFile(path.join(fallbackPublicDir, "index.html"));
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
