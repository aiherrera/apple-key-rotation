import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Mirrors `src/lib/persistedRotation.ts` for the main process bundle. */
export type PersistedRotationRow = {
  id: string;
  profile_id: string;
  rotated_at: string;
  expires_at: string;
  status: string;
  error_message: string | null;
  triggered_by: string;
  jwt: string | null;
  key_id: string | null;
  team_id: string | null;
  services_id: string | null;
};

export const SQLITE_FILENAME = "app.sqlite";

let db: Database.Database | null = null;

export function getDbPath(userData: string): string {
  return path.join(userData, SQLITE_FILENAME);
}

export function openSqlite(userData: string): Database.Database {
  if (db) return db;
  fs.mkdirSync(userData, { recursive: true });
  const dbPath = getDbPath(userData);
  const d = new Database(dbPath);
  d.pragma("journal_mode = WAL");
  applyMigrations(d);
  db = d;
  return d;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("SQLite not initialized");
  }
  return db;
}

export function closeSqlite(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
    db = null;
  }
}

export function reopenSqlite(userData: string): Database.Database {
  closeSqlite();
  return openSqlite(userData);
}

function applyMigrations(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);

  const row = d.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as
    | { v: number | null }
    | undefined;
  let current = row?.v ?? 0;

  if (current < 1) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rotations (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL DEFAULT '',
        rotated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        triggered_by TEXT NOT NULL,
        jwt TEXT,
        key_id TEXT,
        team_id TEXT,
        services_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_rotations_profile_rotated
        ON rotations (profile_id, rotated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_rotations_expires
        ON rotations (expires_at DESC);

      INSERT INTO schema_migrations (version) VALUES (1);
    `);
    current = 1;
  }

  if (current < 2) {
    d.exec(`
      CREATE INDEX IF NOT EXISTS idx_rotations_saved_secrets
        ON rotations (profile_id, rotated_at DESC)
        WHERE jwt IS NOT NULL AND jwt != '' AND status = 'success';

      INSERT INTO schema_migrations (version) VALUES (2);
    `);
    current = 2;
  }
}

export function kvGet(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM kv WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function kvGetAll(): Record<string, string> {
  const rows = getDb().prepare("SELECT key, value FROM kv").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) {
    out[r.key] = r.value;
  }
  return out;
}

export function kvSet(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

export function kvDelete(key: string): void {
  getDb().prepare("DELETE FROM kv WHERE key = ?").run(key);
}

export function kvDeleteMany(keys: readonly string[]): void {
  const d = getDb();
  const tx = d.transaction((ks: readonly string[]) => {
    const st = d.prepare("DELETE FROM kv WHERE key = ?");
    for (const k of ks) {
      st.run(k);
    }
  });
  tx(keys);
}

export function kvClear(): void {
  getDb().exec("DELETE FROM kv");
}

export type RotationRow = PersistedRotationRow;

export function rotationsList(params: {
  profileId?: string;
  limit: number;
  offset: number;
}): PersistedRotationRow[] {
  const { profileId, limit, offset } = params;
  const d = getDb();
  if (profileId) {
    return d
      .prepare(
        `SELECT id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
                jwt, key_id, team_id, services_id
         FROM rotations
         WHERE profile_id = ?
         ORDER BY rotated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(profileId, limit, offset) as PersistedRotationRow[];
  }
  return d
    .prepare(
      `SELECT id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
              jwt, key_id, team_id, services_id
       FROM rotations
       ORDER BY rotated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as PersistedRotationRow[];
}

export function rotationsCount(profileId?: string): number {
  const d = getDb();
  if (profileId) {
    const r = d
      .prepare("SELECT COUNT(*) AS c FROM rotations WHERE profile_id = ?")
      .get(profileId) as { c: number };
    return r.c;
  }
  const r = d.prepare("SELECT COUNT(*) AS c FROM rotations").get() as { c: number };
  return r.c;
}

/** Successful generations with a stored JWT (paginated list for UI). */
export function savedSecretsList(params: {
  profileId?: string;
  limit: number;
  offset: number;
}): PersistedRotationRow[] {
  const { profileId, limit, offset } = params;
  const d = getDb();
  const base = `SELECT id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
                jwt, key_id, team_id, services_id
         FROM rotations
         WHERE jwt IS NOT NULL AND jwt != '' AND status = 'success'`;
  if (profileId) {
    return d
      .prepare(
        `${base} AND profile_id = ?
         ORDER BY rotated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(profileId, limit, offset) as PersistedRotationRow[];
  }
  return d
    .prepare(
      `${base}
       ORDER BY rotated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as PersistedRotationRow[];
}

export function savedSecretsCount(profileId?: string): number {
  const d = getDb();
  const base = `SELECT COUNT(*) AS c FROM rotations
                WHERE jwt IS NOT NULL AND jwt != '' AND status = 'success'`;
  if (profileId) {
    const r = d.prepare(`${base} AND profile_id = ?`).get(profileId) as { c: number };
    return r.c;
  }
  const r = d.prepare(base).get() as { c: number };
  return r.c;
}

export function exportAllRotations(): PersistedRotationRow[] {
  return getDb()
    .prepare(
      `SELECT id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
              jwt, key_id, team_id, services_id
       FROM rotations
       ORDER BY rotated_at DESC`,
    )
    .all() as PersistedRotationRow[];
}

export type AppSnapshot = {
  schemaVersion: number;
  exportedAt: string;
  kv: Record<string, string>;
  rotations: PersistedRotationRow[];
};

export function buildSnapshot(): AppSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    kv: kvGetAll(),
    rotations: exportAllRotations(),
  };
}

function normalizeRotationFromJson(raw: unknown): PersistedRotationRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.length > 0 ? r.id : randomUUID();
  const rotated_at =
    typeof r.rotated_at === "string" ? r.rotated_at : new Date().toISOString();
  const expires_at = typeof r.expires_at === "string" ? r.expires_at : rotated_at;
  const status = typeof r.status === "string" ? r.status : "success";
  const error_message =
    r.error_message === null || typeof r.error_message === "string"
      ? r.error_message
      : null;
  const triggered_by = typeof r.triggered_by === "string" ? r.triggered_by : "manual";
  return {
    id,
    profile_id: typeof r.profile_id === "string" ? r.profile_id : "",
    rotated_at,
    expires_at,
    status,
    error_message,
    triggered_by,
    jwt: typeof r.jwt === "string" ? r.jwt : null,
    key_id: typeof r.key_id === "string" ? r.key_id : null,
    team_id: typeof r.team_id === "string" ? r.team_id : null,
    services_id: typeof r.services_id === "string" ? r.services_id : null,
  };
}

/** Parse app JSON snapshot or legacy web export (array of rotations only). */
export function parseSnapshotJson(text: string): { kv: Record<string, string>; rotations: PersistedRotationRow[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }

  if (Array.isArray(parsed)) {
    const rotations = parsed
      .map(normalizeRotationFromJson)
      .filter((x): x is PersistedRotationRow => x !== null);
    return { kv: {}, rotations };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Snapshot must be an object or array");
  }

  const o = parsed as Record<string, unknown>;
  const kvRaw = o.kv;
  const kv: Record<string, string> =
    kvRaw && typeof kvRaw === "object" && !Array.isArray(kvRaw)
      ? Object.fromEntries(
          Object.entries(kvRaw as Record<string, unknown>).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        )
      : {};

  const rotRaw = o.rotations;
  const rotations: PersistedRotationRow[] = Array.isArray(rotRaw)
    ? rotRaw.map(normalizeRotationFromJson).filter((x): x is PersistedRotationRow => x !== null)
    : [];

  return { kv, rotations };
}

/** Replace all KV and rotations with snapshot (schema_migrations untouched). */
export function importSnapshotReplace(payload: {
  kv: Record<string, string>;
  rotations: PersistedRotationRow[];
}): void {
  wipeAllUserData();
  migrateLegacyPayload(payload);
}

export function rotationInsert(row: PersistedRotationRow): void {
  getDb()
    .prepare(
      `INSERT INTO rotations (
        id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
        jwt, key_id, team_id, services_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.profile_id,
      row.rotated_at,
      row.expires_at,
      row.status,
      row.error_message,
      row.triggered_by,
      row.jwt,
      row.key_id,
      row.team_id,
      row.services_id,
    );
}

export function rotationsClear(): void {
  getDb().exec("DELETE FROM rotations");
}

export function isDatabaseEmpty(): boolean {
  const kvCount = (getDb().prepare("SELECT COUNT(*) AS c FROM kv").get() as { c: number }).c;
  const rotCount = (getDb().prepare("SELECT COUNT(*) AS c FROM rotations").get() as { c: number })
    .c;
  return kvCount === 0 && rotCount === 0;
}

export function migrateLegacyPayload(payload: {
  kv: Record<string, string>;
  rotations: PersistedRotationRow[];
}): void {
  const d = getDb();
  const upsertKv = d.prepare(
    `INSERT INTO kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  const insertRot = d.prepare(
    `INSERT OR IGNORE INTO rotations (
      id, profile_id, rotated_at, expires_at, status, error_message, triggered_by,
      jwt, key_id, team_id, services_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = d.transaction(() => {
    for (const [key, value] of Object.entries(payload.kv)) {
      upsertKv.run(key, value);
    }
    for (const r of payload.rotations) {
      insertRot.run(
        r.id,
        r.profile_id,
        r.rotated_at,
        r.expires_at,
        r.status,
        r.error_message,
        r.triggered_by,
        r.jwt,
        r.key_id,
        r.team_id,
        r.services_id,
      );
    }
  });
  tx();
}

export function wipeAllUserData(): void {
  const d = getDb();
  d.exec("DELETE FROM kv; DELETE FROM rotations;");
}

export function exportDatabaseCopy(userData: string, destPath: string): void {
  getDb().pragma("wal_checkpoint(TRUNCATE)");
  const src = getDbPath(userData);
  fs.copyFileSync(src, destPath);
}

export function importDatabaseReplace(userData: string, srcPath: string): void {
  closeSqlite();
  const dest = getDbPath(userData);
  fs.copyFileSync(srcPath, dest);
  openSqlite(userData);
}
