import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyConfirmation, type ConfirmationGateway, type ConfirmationEvent } from "./confirmation";
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

test("safe diagnostics distinguish provider rejection from failure after successful OTP verification", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const events: ConfirmationEvent[] = [];
    const report = (event: ConfirmationEvent) => { events.push(event); };
    const auth = gateway();
    auth.verifyOtp = async () => ({ data: { user: null, session: null }, error: { code: "otp_expired", message: "sensitive-provider-details" } });
    assert.equal(await verifyConfirmation(auth, store(), "invite", "sensitive-token", report), null);
    assert.deepEqual(events.splice(0), ["otp_expired"]);
    auth.verifyOtp = async () => ({ data: { user: null, session: null }, error: { code: "unknown-sensitive-code" } });
    await verifyConfirmation(auth, store(), "invite", "sensitive-token", report);
    assert.deepEqual(events.splice(0), ["otp_rejected"]);
    const failedStore = store();
    failedStore.register = async () => { throw new Error("sensitive-provider-details"); };
    await assert.rejects(verifyConfirmation(gateway(), failedStore, "invite", "sensitive-token", report));
    assert.deepEqual(events.splice(0), ["ticket_registration_failed"]);
    const mismatch = gateway();
    mismatch.getUser = async () => ({ data: { user: null }, error: new Error("sensitive-session-details") });
    assert.equal(await verifyConfirmation(mismatch, store(), "invite", "sensitive-token", report), null);
    assert.deepEqual(events.splice(0), ["session_verification_failed"]);
    await verifyConfirmation(gateway(), store(), "invite", "sensitive-token", report);
    assert.deepEqual(events, ["confirmed"]);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("safe diagnostics report failed prerequisites without calling verifyOtp", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  const events: ConfirmationEvent[] = [];
  let calls = 0;
  const auth = gateway();
  auth.verifyOtp = async (input) => { calls++; return gateway().verifyOtp(input); };
  const report = (event: ConfirmationEvent) => { events.push(event); };
  try {
    delete process.env.AUTH_FLOW_SIGNING_SECRET;
    await assert.rejects(verifyConfirmation(auth, store(), "invite", "sensitive-token", report));
    assert.deepEqual(events.splice(0), ["signing_configuration_failed"]);
    process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
    const unavailable = store();
    unavailable.ready = async () => false;
    await assert.rejects(verifyConfirmation(auth, unavailable, "invite", "sensitive-token", report));
    assert.deepEqual(events, ["store_check_failed"]);
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});
