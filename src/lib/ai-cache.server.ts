/**
 * Shared cache of finished AI answers — **server-only**.
 *
 * Memory first, then the database (so answers survive a restart or deploy),
 * and one request at a time per key: when a hundred people ask for the same
 * coin at once, Claude is called once and everyone gets that answer.
 * Failures are never cached.
 */
import { createHash } from "node:crypto";
import type { SqlLike } from "./account-store.server.ts";

export const AI_CACHE_TTL = 15 * 60_000;
const MEMORY_MAX = 500;
const KEEP_MS = 24 * 60 * 60_000;

type Outcome<T, F> = { ok: true; value: T } | { ok: false; reason: F };

let getStore: () => Promise<SqlLike> = async () => (await import("./db")).getSql();
const memory = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<Outcome<unknown, unknown>>>();
let lastSweep = 0;

/** Long keys (a rephrased verdict carries its text) are stored by their hash. */
function dbKey(key: string): string {
  return key.length <= 200 ? key : `${key.slice(0, 60)}#${createHash("sha256").update(key).digest("base64url")}`;
}

/** Tests swap the database and start from an empty cache. */
export function resetAiCache(store?: () => Promise<SqlLike>): void {
  if (store) getStore = store;
  memory.clear();
  inflight.clear();
  lastSweep = 0;
}

function remember(key: string, at: number, value: unknown): void {
  if (memory.size >= MEMORY_MAX) {
    for (const [k, v] of memory) if (Date.now() - v.at > AI_CACHE_TTL) memory.delete(k);
    // Still full: drop the oldest entries (a Map keeps insertion order).
    for (const k of memory.keys()) {
      if (memory.size < MEMORY_MAX) break;
      memory.delete(k);
    }
  }
  memory.set(key, { at, value });
}

/** A stored answer younger than `ttlMs`, or null. Database trouble counts as a miss. */
export async function peekAi<T>(key: string, ttlMs: number, now = Date.now()): Promise<T | null> {
  const hit = memory.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as T;
  try {
    const sql = await getStore();
    const rows = await sql<{ value: T; created_at: Date | string }>`
      select value, created_at from ai_cache
      where key = ${dbKey(key)} and created_at > ${new Date(now - ttlMs).toISOString()}::timestamptz`;
    const row = rows[0];
    if (!row) return null;
    remember(key, new Date(row.created_at).getTime(), row.value);
    return row.value;
  } catch (err) {
    console.error("[ai-cache] read failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function store(key: string, value: unknown, now: number): Promise<void> {
  remember(key, now, value);
  try {
    const sql = await getStore();
    const at = new Date(now).toISOString();
    await sql`
      insert into ai_cache (key, value, created_at) values (${dbKey(key)}, ${JSON.stringify(value)}::jsonb, ${at}::timestamptz)
      on conflict (key) do update set value = excluded.value, created_at = excluded.created_at`;
    if (now - lastSweep > KEEP_MS / 4) {
      lastSweep = now;
      await sql`delete from ai_cache where created_at < ${new Date(now - KEEP_MS).toISOString()}::timestamptz`;
    }
  } catch (err) {
    console.error("[ai-cache] write failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Runs `run` unless the same key is already running, in which case its answer
 * is shared. A successful answer is stored; a failed one isn't, and a caller
 * who joined someone else's failed run makes its own attempt (the failure may
 * have been the other member's daily limit).
 */
export async function shareAi<T, F>(key: string, run: () => Promise<Outcome<T, F>>, now = Date.now()): Promise<Outcome<T, F>> {
  const running = inflight.get(key) as Promise<Outcome<T, F>> | undefined;
  if (running) {
    const shared = await running.catch(() => null);
    if (shared?.ok) return shared;
  }
  const attempt = (async () => {
    const result = await run();
    if (result.ok) await store(key, result.value, now);
    return result;
  })();
  inflight.set(key, attempt);
  try {
    return await attempt;
  } finally {
    if (inflight.get(key) === attempt) inflight.delete(key);
  }
}

/** A stored answer if there is a fresh one, else one shared run. */
export async function cachedAi<T, F>(key: string, ttlMs: number, run: () => Promise<Outcome<T, F>>, now = Date.now()): Promise<Outcome<T, F>> {
  const hit = await peekAi<T>(key, ttlMs, now);
  if (hit !== null) return { ok: true, value: hit };
  return shareAi(key, run, now);
}
