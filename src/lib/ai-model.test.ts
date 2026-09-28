import { test } from "node:test";
import assert from "node:assert/strict";
import { modelFor, routeModel } from "./claude.server.ts";
import { tierOf } from "./quota.server.ts";

const NAMES = ["ANTHROPIC_MODEL", "ANTHROPIC_MODEL_FREE", "ANTHROPIC_MODEL_PAID", "AI_GATEWAY_MODEL"];

function withEnv(values: Record<string, string>, check: () => void) {
  const saved = Object.fromEntries(NAMES.map((n) => [n, process.env[n]]));
  for (const n of NAMES) delete process.env[n];
  Object.assign(process.env, values);
  try {
    check();
  } finally {
    for (const n of NAMES) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
  }
}

test("free members get Haiku, paying members Sonnet", () => {
  withEnv({}, () => {
    assert.equal(tierOf("free"), "free");
    assert.equal(tierOf("pro"), "paid");
    assert.equal(tierOf("max"), "paid");
    assert.equal(modelFor("free"), "claude-haiku-4-5");
    assert.equal(modelFor("paid"), "claude-sonnet-5");
    assert.equal(routeModel("gateway", "free"), "anthropic/claude-haiku-4-5");
    assert.equal(routeModel("gateway", "paid"), "anthropic/claude-sonnet-5");
  });
});

test("the owner can pick the models", () => {
  withEnv({ ANTHROPIC_MODEL: "claude-opus-5" }, () => {
    assert.equal(modelFor("paid"), "claude-opus-5", "the old setting keeps working for paid");
    assert.equal(modelFor("free"), "claude-haiku-4-5");
  });
  withEnv({ ANTHROPIC_MODEL: "claude-opus-5", ANTHROPIC_MODEL_PAID: "claude-sonnet-5", ANTHROPIC_MODEL_FREE: "claude-sonnet-5" }, () => {
    assert.equal(modelFor("paid"), "claude-sonnet-5");
    assert.equal(modelFor("free"), "claude-sonnet-5");
  });
  withEnv({ AI_GATEWAY_MODEL: "anthropic/claude-opus-5" }, () => {
    assert.equal(routeModel("gateway", "paid"), "anthropic/claude-opus-5");
    assert.equal(routeModel("gateway", "free"), "anthropic/claude-haiku-4-5");
    assert.equal(routeModel("direct", "paid"), "claude-sonnet-5");
  });
});
