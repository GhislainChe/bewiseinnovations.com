import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverySubmissionAvailable } from "./recovery-availability";

test("recovery email submission remains local-only until the shared store is deployed and tested", () => {
  const local = "http://127.0.0.1:54321";
  const hosted = "https://onfxxtvfprjnqsxdmhkp.supabase.co";
  assert.equal(recoverySubmissionAvailable("development", "localhost", local), true);
  assert.equal(recoverySubmissionAvailable("development", "127.0.0.1", local), true);
  assert.equal(recoverySubmissionAvailable("production", "localhost", local), false);
  assert.equal(recoverySubmissionAvailable("development", "bewiseinnovation.com", local), false);
  assert.equal(recoverySubmissionAvailable("development", "localhost", hosted), false);
});
