const buckets = new Map<string, { n: number; t: number }>();

export function allow(userId: string, kind: string, max: number, windowMs: number): boolean {
  const key = `${userId}:${kind}`;
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now - hit.t > windowMs) {
    buckets.set(key, { n: 1, t: now });
    return true;
  }
  if (hit.n >= max) return false;
  hit.n += 1;
  return true;
}
