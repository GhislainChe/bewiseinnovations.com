import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AuthorizationError,
  getCurrentTeamMember,
  hasPermission,
  requirePermission,
  safeAuthReturnPath,
  signInTeamMember,
  signOutTeamMember,
  type AuthGateway,
} from "./core";

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    getVerifiedUserId: async () => "user-1",
    getProfile: async () => ({ id: "user-1", fullName: "Test Staff", isActive: true }),
    getRoleIds: async () => ["role-1"],
    getRoles: async () => [{ id: "role-1", code: "operations_lead" }],
    getPermissionIds: async () => ["permission-1"],
    getPermissions: async () => [{ id: "permission-1", code: "inquiries.read" }],
    signInWithPassword: async () => true,
    signOutCurrentSession: async () => {},
    ...overrides,
  };
}

test("missing or invalid Auth identity cannot become staff", async () => {
  for (const identity of [null, ""]) {
    const member = await getCurrentTeamMember(gateway({ getVerifiedUserId: async () => identity }));
    assert.equal(member, null);
  }
});

test("an inactive profile and a mismatched profile are denied", async () => {
  assert.equal(
    await getCurrentTeamMember(gateway({
      getProfile: async () => ({ id: "user-1", fullName: "Test Staff", isActive: false }),
    })),
    null,
  );
  assert.equal(
    await getCurrentTeamMember(gateway({
      getProfile: async () => ({ id: "other-user", fullName: "Test Staff", isActive: true }),
    })),
    null,
  );
});

test("valid Auth account without a profile or role is denied", async () => {
  assert.equal(await getCurrentTeamMember(gateway({ getProfile: async () => null })), null);
  assert.equal(await getCurrentTeamMember(gateway({ getRoleIds: async () => [] })), null);
});

test("permissions come from the database gateway and are enforced individually", async () => {
  const client = gateway();
  assert.equal(await hasPermission(client, "inquiries.read"), true);
  assert.equal(await hasPermission(client, "roles.assign"), false);
  assert.equal((await requirePermission(client, "inquiries.read")).roleCodes[0], "operations_lead");
  await assert.rejects(requirePermission(client, "roles.assign"), AuthorizationError);
});

test("inconsistent role or permission lookups fail closed", async () => {
  await assert.rejects(
    getCurrentTeamMember(gateway({ getRoles: async () => [] })),
    AuthorizationError,
  );
  await assert.rejects(
    getCurrentTeamMember(gateway({ getPermissions: async () => [] })),
    AuthorizationError,
  );
});

test("failed password authentication clears an existing session", async () => {
  let signedOut = false;
  const member = await signInTeamMember(gateway({
    signInWithPassword: async () => false,
    signOutCurrentSession: async () => { signedOut = true; },
  }), "test@example.invalid", "incorrect");
  assert.equal(member, null);
  assert.equal(signedOut, true);
});

test("failed password authentication without a session does not call sign-out", async () => {
  let signedOut = false;
  assert.equal(await signInTeamMember(gateway({
    signInWithPassword: async () => false,
    getVerifiedUserId: async () => null,
    signOutCurrentSession: async () => { signedOut = true; },
  }), "test@example.invalid", "incorrect"), null);
  assert.equal(signedOut, false);
});

test("successful Auth sign-in without staff authorization signs out", async () => {
  let signedOut = false;
  const member = await signInTeamMember(gateway({
    getRoleIds: async () => [],
    signOutCurrentSession: async () => { signedOut = true; },
  }), "test@example.invalid", "password");
  assert.equal(member, null);
  assert.equal(signedOut, true);
});

test("authorized sign-in keeps the session; sign-out ends the current session", async () => {
  let signOutCount = 0;
  const client = gateway({ signOutCurrentSession: async () => { signOutCount++; } });
  assert.equal((await signInTeamMember(client, "test@example.invalid", "password"))?.id, "user-1");
  assert.equal(signOutCount, 0);
  await signOutTeamMember(client);
  assert.equal(signOutCount, 1);
});

test("auth callback return paths stay on the same origin", () => {
  assert.equal(safeAuthReturnPath("/internal?tab=team"), "/internal?tab=team");
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "/%2F%2Fevil.example", "%2F%2Fevil.example", "/bad\npath"]) {
    assert.equal(safeAuthReturnPath(unsafe), "/");
  }
});
