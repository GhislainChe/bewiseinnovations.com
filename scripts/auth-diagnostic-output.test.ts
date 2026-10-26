import assert from "node:assert/strict";
import { test } from "node:test";
import { safeAuthDiagnosticLine, safeAuthDiagnosticRecord } from "./auth-diagnostic-output";

test("launcher diagnostics accept only exact fixed labels, never arbitrary child output", () => {
  assert.equal(safeAuthDiagnosticLine("auth_preflight ready\r"), "auth_preflight ready");
  assert.equal(safeAuthDiagnosticLine("auth_confirmation store_check_failed"), "auth_confirmation store_check_failed");
  for (const value of ["GET /auth/confirm?token_hash=private", "Error: private", "auth_confirmation otp_rejected private", "auth_preflight private", "auth_confirmation confirmed\nprivate"]) {
    assert.equal(safeAuthDiagnosticLine(value), null);
  }
});

test("log viewer emits only fixed server labels with validated elapsed timestamps", () => {
  const record = { source: "Server", timestamp: "00:11:44.846", message: "auth_confirmation origin_rejected" };
  assert.equal(safeAuthDiagnosticRecord(JSON.stringify(record)), "[elapsed 00:11:44.846] auth_confirmation origin_rejected");
  assert.equal(safeAuthDiagnosticRecord(JSON.stringify({ ...record, message: 'auth_confirmation "origin_rejected"' })), "[elapsed 00:11:44.846] auth_confirmation origin_rejected");
  for (const value of [
    { ...record, source: "Browser" },
    { ...record, timestamp: "private" },
    { ...record, message: "auth_confirmation origin_rejected private" },
    { ...record, message: 'auth_confirmation "origin_rejected" private' },
    { ...record, message: { token: "private" } },
  ]) assert.equal(safeAuthDiagnosticRecord(JSON.stringify(value)), null);
  assert.equal(safeAuthDiagnosticRecord("raw private error"), null);
});
