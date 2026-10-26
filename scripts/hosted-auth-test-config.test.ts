import assert from "node:assert/strict";
import { test } from "node:test";
import { HOSTED_TEST_URL, HOSTED_TEST_REF, parseHostedTestEnvironment, validateHostedTestEnvironment, assertLocalHostedTestProcess } from "./hosted-auth-test-config";

function fixture() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: HOSTED_TEST_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic-test-value".repeat(2)].join("_"),
    SUPABASE_AUTH_STORE_SECRET_KEY: ["sb", "secret", "synthetic-test-value".repeat(2)].join("_"),
    AUTH_FLOW_SIGNING_SECRET: "0123456789abcdef".repeat(4),
    AUTH_RECOVERY_MODE: "disabled", AUTH_RECOVERY_TEST_ORIGIN: "",
  };
}

test("hosted credential readiness requires the dedicated project, keys, and disabled recovery", () => {
  assert.deepEqual(validateHostedTestEnvironment(fixture()), []);
  for (const changes of [
    { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65421" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" },
    { SUPABASE_AUTH_STORE_SECRET_KEY: "" },
    { SUPABASE_AUTH_STORE_SECRET_KEY: fixture().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    { AUTH_FLOW_SIGNING_SECRET: "placeholder" }, { AUTH_RECOVERY_MODE: "hosted-local-test" },
  ]) assert.notEqual(validateHostedTestEnvironment({ ...fixture(), ...changes }).length, 0);
});

test("legacy role/ref inspection rejects local and wrong-project credentials", () => {
  const jwt = (ref: string, role: string) => `header.${Buffer.from(JSON.stringify({ref,role})).toString("base64url")}.signature`;
  assert.deepEqual(validateHostedTestEnvironment({ ...fixture(), SUPABASE_AUTH_STORE_SECRET_KEY: jwt(HOSTED_TEST_REF,"service_role") }), []);
  for (const key of [jwt("supabase-demo","service_role"),jwt("other","service_role"),jwt(HOSTED_TEST_REF,"anon")]) {
    assert.notEqual(validateHostedTestEnvironment({ ...fixture(), SUPABASE_AUTH_STORE_SECRET_KEY:key }).length,0);
  }
});

test("dedicated dotenv parsing rejects duplicates and unexpected environment overrides", () => {
  assert.deepEqual(parseHostedTestEnvironment("# comment\nAUTH_RECOVERY_MODE=disabled\nAUTH_RECOVERY_TEST_ORIGIN=\n"), {AUTH_RECOVERY_MODE:"disabled",AUTH_RECOVERY_TEST_ORIGIN:""});
  assert.throws(() => parseHostedTestEnvironment("NODE_ENV=production"));
  assert.throws(() => parseHostedTestEnvironment("AUTH_RECOVERY_MODE=local\nAUTH_RECOVERY_MODE=disabled"));
});

test("hosted readiness tooling refuses production and managed execution", () => {
  assert.doesNotThrow(() => assertLocalHostedTestProcess({ NODE_ENV:"development" }));
  for (const env of [{NODE_ENV:"production"},{VERCEL:"1"},{CI:"true"},{NETLIFY:"true"},{CF_PAGES:"1"}]) {
    assert.throws(() => assertLocalHostedTestProcess(env));
  }
});
