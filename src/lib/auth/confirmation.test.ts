import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyConfirmation, type ConfirmationGateway } from "./confirmation";
import { readFlowTicket } from "./flow";
import type { AuthFlowStore } from "./auth-store";

const TEST_SECRET = "test-only-signing-secret-with-at-least-32-characters";

function gateway(userId = "local-user"): ConfirmationGateway {
  return {
    verifyOtp: async () => ({ data: { user: { id: userId }, session: { access_token: "local-access-token" } }, error: null }),
    getUser: async () => ({ data: { user: { id: userId } }, error: null }),
  };
}

function store(): AuthFlowStore {
  return {
    ready: async () => true,
    register: async () => {},
    redeem: async () => true,
    consumeRecoveryBudget: async () => true,
  };
}

test("POST confirmation verifies the exact flow type and binds its ticket to the verified user", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    let input: { token_hash: string; type: "invite" | "recovery" } | undefined;
    const auth = gateway();
    auth.verifyOtp = async (value) => { input = value; return gateway().verifyOtp(value); };
    const ticket = await verifyConfirmation(auth, store(), "invite", "test-token");
    assert.deepEqual(input, { token_hash: "test-token", type: "invite" });
    assert.equal(readFlowTicket(ticket ?? undefined, "invite", "local-user"), true);
    assert.equal(readFlowTicket(ticket ?? undefined, "recovery", "local-user"), false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("invalid or expired OTP and mismatched Auth identity fail without a ticket", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const expired = gateway();
    expired.verifyOtp = async () => ({ data: { user: null, session: null }, error: new Error("expired") });
    assert.equal(await verifyConfirmation(expired, store(), "recovery", "expired-token"), null);
    const mismatch = gateway();
    mismatch.getUser = async () => ({ data: { user: { id: "different-user" } }, error: null });
    assert.equal(await verifyConfirmation(mismatch, store(), "invite", "valid-token"), null);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("missing signing secret fails before the OTP is consumed", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  delete process.env.AUTH_FLOW_SIGNING_SECRET;
  try {
    let called = false;
    const auth = gateway();
    auth.verifyOtp = async (input) => { called = true; return gateway().verifyOtp(input); };
    await assert.rejects(verifyConfirmation(auth, store(), "invite", "unused-token"), /not configured/);
    assert.equal(called, false);
  } finally {
    if (previous !== undefined) process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("unavailable durable store prevents OTP consumption", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    let called = false;
    const auth = gateway();
    auth.verifyOtp = async (input) => { called = true; return gateway().verifyOtp(input); };
    const unavailable = store();
    unavailable.ready = async () => false;
    await assert.rejects(verifyConfirmation(auth, unavailable, "invite", "unused-token"));
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});
