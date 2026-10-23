import assert from "node:assert/strict";
import { test } from "node:test";
import { requestRecoveryEmail, type RecoveryGateway } from "./recovery-operation";
import type { AuthFlowStore } from "./auth-store";

function setup(limit: Pick<AuthFlowStore, "consumeRecoveryBudget">) {
  const sent: string[] = [];
  const gateway: RecoveryGateway = {
    resetPasswordForEmail: async (email) => { sent.push(email); return { error: null }; },
  };
  return { gateway, sent, limit };
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
