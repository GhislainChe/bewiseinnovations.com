import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverySubmissionAvailable, type RecoveryEnvironment } from "./recovery-availability";

const local: RecoveryEnvironment = {
  runtime: "development", requestUrl: "http://localhost:3000/auth/forgot-password/request",
  host: "localhost:3000", forwardedHost: null, forwardedProto: null,
  supabaseUrl: "http://127.0.0.1:65421",
};
const hosted: RecoveryEnvironment = {
  ...local, supabaseUrl: "https://onfxxtvfprjnqsxdmhkp.supabase.co",
  mode: "hosted-local-test", testOrigin: "http://localhost:3000",
};

test("local development needs a valid loopback API and exact application origin", () => {
  assert.equal(recoverySubmissionAvailable(local), true);
  for (const supabaseUrl of [undefined, "", "not a URL", "https://127.0.0.1:65421", "http://example.com", "http://localhost:65421/other", "http://user:pass@localhost:65421"]) {
    assert.equal(recoverySubmissionAvailable({ ...local, supabaseUrl }), false);
  }
});

test("hosted recovery is disabled by default and needs both explicit controls", () => {
  assert.equal(recoverySubmissionAvailable({ ...local, supabaseUrl: hosted.supabaseUrl }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, mode: undefined }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, testOrigin: undefined }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, testOrigin: "https://example.com" }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, mode: "true" }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, mode: "disabled" }), false);
  assert.equal(recoverySubmissionAvailable(hosted), true);
});

test("controlled hosted testing is restricted to the exact project", () => {
  for (const supabaseUrl of ["https://other.supabase.co", "http://onfxxtvfprjnqsxdmhkp.supabase.co", `${hosted.supabaseUrl}.evil.example`, `${hosted.supabaseUrl}/?x=1`]) {
    assert.equal(recoverySubmissionAvailable({ ...hosted, supabaseUrl }), false);
  }
});

test("production and managed environments cannot use the testing override", () => {
  for (const runtime of [undefined, "production", "test", "preview"]) {
    assert.equal(recoverySubmissionAvailable({ ...hosted, runtime }), false);
    assert.equal(recoverySubmissionAvailable({ ...local, runtime }), false);
  }
  assert.equal(recoverySubmissionAvailable({ ...hosted, managedDeployment: true }), false);
});

test("public origins and spoofed forwarding cannot select an approved origin", () => {
  for (const changes of [
    { requestUrl: "https://bewiseinnovation.com/auth/forgot-password/request" },
    { requestUrl: "http://localhost:3001/auth/forgot-password/request" },
    { host: "bewiseinnovation.com" }, { host: null },
    { forwardedHost: "evil.example" }, { forwardedHost: "localhost:3000,evil.example" },
    { forwardedProto: "https" },
  ]) assert.equal(recoverySubmissionAvailable({ ...hosted, ...changes }), false);
  assert.equal(recoverySubmissionAvailable({ ...hosted, forwardedHost: "localhost:3000", forwardedProto: "http" }), true);
});
