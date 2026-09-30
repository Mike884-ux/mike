// @ts-check
/**
 * The Postgres connection string, whatever name the hosting gave it.
 * Vercel's storage integrations use DATABASE_URL (Neon), POSTGRES_URL (Vercel
 * Postgres, Supabase) or `<CUSTOM PREFIX>_URL` when a prefix was typed in the
 * "Connect project" dialog — e.g. STORAGE_URL. Shared by the app and the
 * deploy-time migrator.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined}
 */
export function findDatabaseUrl(env) {
  const url = pickDatabaseUrl(env);
  return url ? explicitSsl(url) : undefined;
}

/**
 * pg treats sslmode=prefer/require/verify-ca as verify-full today and logs a
 * "SECURITY WARNING" on every start because that will change. Saying
 * verify-full outright keeps the same (strict) behaviour without the warning.
 * A URL that opted into libpq semantics is left alone.
 *
 * @param {string} url
 * @returns {string}
 */
export function explicitSsl(url) {
  if (/[?&]uselibpqcompat=true(?:&|$)/i.test(url)) return url;
  return url.replace(/([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/i, "$1sslmode=verify-full");
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined}
 */
function pickDatabaseUrl(env) {
  const isPg = (/** @type {string | undefined} */ v) => Boolean(v && /^postgres(ql)?:\/\//i.test(v.trim()));
  for (const name of ["DATABASE_URL", "POSTGRES_URL", "STORAGE_URL"]) {
    if (isPg(env[name])) return env[name]?.trim();
  }
  // Any other *_URL holding a Postgres address; pooled ones first.
  const names = Object.keys(env)
    .filter((name) => name.endsWith("_URL") && isPg(env[name]))
    .sort((a, b) => Number(/UNPOOLED|NON_POOLING/.test(a)) - Number(/UNPOOLED|NON_POOLING/.test(b)) || a.localeCompare(b));
  return names.length ? env[names[0]]?.trim() : undefined;
}
