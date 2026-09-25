const buckets = new Map<string, { n: number; t: number; windowMs: number }>();
let lastSweep = 0;

/** Drop expired windows at most once a minute so the map can't grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    if (now - hit.t > hit.windowMs) buckets.delete(key);
  }
}

export function allow(userId: string, kind: string, max: number, windowMs: number): boolean {
  const key = `${userId}:${kind}`;
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || now - hit.t > windowMs) {
    buckets.set(key, { n: 1, t: now, windowMs });
    return true;
  }
  if (hit.n >= max) return false;
  hit.n += 1;
  return true;
}
