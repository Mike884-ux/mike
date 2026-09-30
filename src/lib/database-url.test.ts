import { test } from "node:test";
import assert from "node:assert/strict";
import { explicitSsl, findDatabaseUrl } from "../../scripts/database-url.mjs";

test("sslmode=require is spelled out as verify-full, so pg doesn't warn on every start", () => {
  const neon = "postgresql://u:p%40ss@ep-x.neon.tech/db?sslmode=require&channel_binding=require";
  assert.equal(explicitSsl(neon), "postgresql://u:p%40ss@ep-x.neon.tech/db?sslmode=verify-full&channel_binding=require");
  assert.equal(explicitSsl("postgres://h/db?a=1&sslmode=prefer"), "postgres://h/db?a=1&sslmode=verify-full");
  assert.equal(explicitSsl("postgres://h/db?sslmode=disable"), "postgres://h/db?sslmode=disable");
  assert.equal(explicitSsl("postgres://h/db"), "postgres://h/db");
  const compat = "postgres://h/db?uselibpqcompat=true&sslmode=require";
  assert.equal(explicitSsl(compat), compat, "libpq semantics were asked for");
  assert.equal(findDatabaseUrl({ DATABASE_URL: ` ${neon} ` }), explicitSsl(neon));
  assert.equal(findDatabaseUrl({}), undefined);
});
