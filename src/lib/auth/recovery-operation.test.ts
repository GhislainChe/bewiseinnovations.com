import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { requestRecoveryEmail, type RecoveryGateway } from "./recovery-operation";
import type { AuthFlowStore } from "./auth-store";

let previousSecret: string | undefined;
beforeEach(() => {
  previousSecret = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = "synthetic-test-only-signing-secret-at-least-32-chars";
});
afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
  else process.env.AUTH_FLOW_SIGNING_SECRET = previousSecret;
});

function setup(limit: Pick<AuthFlowStore, "consumeRecoveryBudget"> & Partial<Pick<AuthFlowStore, "ready">>) {
  const sent: string[] = [];
  const gateway: RecoveryGateway = {
    resetPasswordForEmail: async (email) => { sent.push(email); return { error: null }; },
  };
  return { gateway, sent, limit: { ready: async () => true, ...limit } };
}

test("recovery response reveals no account state or quota state", async () => {
  const fixture = setup({ consumeRecoveryBudget: async () => false });
  assert.equal(await requestRecoveryEmail(fixture.gateway, fixture.limit, "nobody@example.invalid"), undefined);
  assert.deepEqual(fixture.sent, []);
  fixture.limit.consumeRecoveryBudget = async () => true;
  assert.equal(await requestRecoveryEmail(fixture.gateway, fixture.limit, "Member@Example.Invalid"), undefined);
  assert.deepEqual(fixture.sent, ["member@example.invalid"]);
});

test("limiter outage fails closed, including concurrent recovery attempts", async () => {
  const fixture = setup({ consumeRecoveryBudget: async () => { throw new Error("store unavailable"); } });
  const outcomes = await Promise.all(Array.from({ length: 12 }, () =>
    requestRecoveryEmail(fixture.gateway, fixture.limit, "member@example.invalid")));
  assert.deepEqual(outcomes, Array(12).fill(undefined));
  assert.deepEqual(fixture.sent, []);
});

test("unavailable shared store cannot consume quota or send recovery mail", async () => {
  let consumed = false;
  const fixture = setup({
    ready: async () => false,
    consumeRecoveryBudget: async () => { consumed = true; return true; },
  });
  await requestRecoveryEmail(fixture.gateway, fixture.limit, "member@example.invalid");
  assert.equal(consumed, false);
  assert.deepEqual(fixture.sent, []);
  fixture.limit.ready = async () => { throw new Error("invalid store credentials"); };
  await requestRecoveryEmail(fixture.gateway, fixture.limit, "member@example.invalid");
  assert.deepEqual(fixture.sent, []);
});

test("missing signing configuration fails before shared-store or provider requests", async () => {
  delete process.env.AUTH_FLOW_SIGNING_SECRET;
  const fixture = setup({ ready: async () => { throw new Error("must not run"); }, consumeRecoveryBudget: async () => true });
  assert.equal(await requestRecoveryEmail(fixture.gateway, fixture.limit, "member@example.invalid"), undefined);
  assert.deepEqual(fixture.sent, []);
});

test("approved recovery always uses the fixed confirmation redirect", async () => {
  const fixture = setup({ consumeRecoveryBudget: async () => true });
  let destination: string | undefined;
  fixture.gateway.resetPasswordForEmail = async (_, options) => { destination = options.redirectTo; return { error: null }; };
  await requestRecoveryEmail(fixture.gateway, fixture.limit, "member@example.invalid");
  assert.equal(destination, "http://localhost:3000/auth/confirm");
});
