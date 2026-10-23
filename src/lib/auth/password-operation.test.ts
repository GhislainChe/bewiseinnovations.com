import assert from "node:assert/strict";
import { test } from "node:test";
import { issueFlowTicket } from "./flow";
import { changePasswordAfterConfirmation, type PasswordGateway } from "./password-operation";

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

test("password changes require the matching verified invitation or recovery ticket", async () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = TEST_SECRET;
  try {
    const { auth, calls } = gateway();
    const password = "Long-Local-Test-Password-123!";
    assert.deepEqual(await changePasswordAfterConfirmation(auth, undefined, "invite", password, password), { kind: "denied" });
    const recovery = issueFlowTicket("recovery", "local-user");
    assert.deepEqual(await changePasswordAfterConfirmation(auth, recovery, "invite", password, password), { kind: "denied" });
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
    const ticket = issueFlowTicket("invite", "local-user");
    assert.equal((await changePasswordAfterConfirmation(auth, ticket, "invite", "short", "short")).kind, "validation");
    assert.equal((await changePasswordAfterConfirmation(auth, ticket, "invite", "Long-Local-Test-Password-123!", "other-password")).kind, "validation");
    assert.equal(calls.updates, 0);
    assert.deepEqual(await changePasswordAfterConfirmation(auth, ticket, "invite", "Long-Local-Test-Password-123!", "Long-Local-Test-Password-123!"), { kind: "saved" });
    assert.equal(calls.updates, 1);
    assert.equal(calls.signOuts, 1);
    assert.deepEqual(await changePasswordAfterConfirmation(auth, ticket, "invite", "Long-Local-Test-Password-123!", "Long-Local-Test-Password-123!"), { kind: "denied" });
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});
