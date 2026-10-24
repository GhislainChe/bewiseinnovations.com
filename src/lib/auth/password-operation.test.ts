import assert from "node:assert/strict";
import { test } from "node:test";
import { issueFlowTicket } from "./flow";
import { changePasswordAfterConfirmation, type PasswordGateway } from "./password-operation";
import type { AuthFlowStore } from "./auth-store";

const TEST_SECRET = "test-only-signing-secret-with-at-least-32-characters";

function gateway() {
  const calls = { updates: 0, signOuts: 0, active: true };
  const auth: PasswordGateway = {
    getUser: async () => ({ data: { user: calls.active ? { id: "local-user" } : null }, error: null }),
    updateUser: async () => { calls.updates++; return { error: null }; },
    signOut: async () => { calls.signOuts++; calls.active = false; return { error: null }; },
  };
  return { auth, calls };
}

function store(): AuthFlowStore {
  const used = new Set<string>();
  return {
    ready: async () => true,
    register: async () => {},
    redeem: async (ticket) => {
      if (used.has(ticket)) return false;
      used.add(ticket);
      return true;
    },
    consumeRecoveryBudget: async () => true,
  };
}

test("password changes require the matching verified invitation or recovery ticket", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const { auth, calls } = gateway();
    const tickets = store();
    const password = "Long-Local-Test-Password-123!";
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, undefined, "invite", password, password), { kind: "denied" });
    const recovery = issueFlowTicket("recovery", "local-user");
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, recovery, "invite", password, password), { kind: "denied" });
    assert.equal(calls.updates, 0);
    assert.equal(calls.signOuts, 0);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("weak and mismatched passwords are refused; success signs out and denies ordinary reuse", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const { auth, calls } = gateway();
    const tickets = store();
    const ticket = issueFlowTicket("invite", "local-user");
    assert.equal((await changePasswordAfterConfirmation(auth, tickets, ticket, "invite", "short", "short")).kind, "validation");
    assert.equal((await changePasswordAfterConfirmation(auth, tickets, ticket, "invite", "Long-Local-Test-Password-123!", "other-password")).kind, "validation");
    assert.equal(calls.updates, 0);
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, ticket, "invite", "Long-Local-Test-Password-123!", "Long-Local-Test-Password-123!"), { kind: "saved" });
    assert.equal(calls.updates, 1);
    assert.equal(calls.signOuts, 1);
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, ticket, "invite", "Long-Local-Test-Password-123!", "Long-Local-Test-Password-123!"), { kind: "denied" });
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("a failed password update burns the ticket, requiring a fresh email link", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const { auth, calls } = gateway();
    auth.updateUser = async () => { calls.updates++; return { error: new Error("provider failed") }; };
    const tickets = store();
    const ticket = issueFlowTicket("recovery", "local-user");
    const password = "Long-Local-Test-Password-123!";
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, ticket, "recovery", password, password), { kind: "save_failed" });
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, ticket, "recovery", password, password), { kind: "denied" });
    assert.equal(calls.updates, 1);
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});

test("expired and tampered tickets never redeem or update a password", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  const now = Date.now;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const { auth, calls } = gateway();
    const tickets = store();
    let redemptions = 0;
    tickets.redeem = async () => { redemptions++; return true; };
    const ticket = issueFlowTicket("recovery", "local-user");
    const password = "Long-Local-Test-Password-123!";
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, `${ticket}x`, "recovery", password, password), { kind: "denied" });
    Date.now = () => now() + 11 * 60_000;
    assert.deepEqual(await changePasswordAfterConfirmation(auth, tickets, ticket, "recovery", password, password), { kind: "denied" });
    assert.equal(redemptions, 0);
    assert.equal(calls.updates, 0);
  } finally {
    Date.now = now;
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});
