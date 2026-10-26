import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { readConfirmationFragment, CONFIRMATION_FRAGMENT_BOOTSTRAP, type FragmentWindow } from "./fragment";

const captureConfirmationFragment = (target: FragmentWindow) => runInNewContext(CONFIRMATION_FRAGMENT_BOOTSTRAP, { window: target });

function browser(search = "", hash = "#token_hash=synthetic-fragment-only-token&type=invite") {
  const replaced: unknown[] = [];
  const target: FragmentWindow = { location: { pathname: "/auth/confirm", search, hash }, history: { replaceState: (...args) => { replaced.push(args); } } };
  return { target, replaced };
}

test("fragment bootstrap clears URL before one-time memory-only handoff without network", () => {
  const { target, replaced } = browser();
  runInNewContext(CONFIRMATION_FRAGMENT_BOOTSTRAP, { window: target });
  assert.deepEqual(replaced, [[null, "", "/auth/confirm"]]);
  const consume = target.__beWiseConfirmation!;
  assert.equal(readConfirmationFragment(consume())?.type, "invite");
  assert.equal(target.__beWiseConfirmation, undefined);
  assert.equal(consume(), "");
});

test("legacy query tokens and unsafe fragments fail closed without being copied to output URLs", () => {
  const { target, replaced } = browser("?token_hash=synthetic-query-value&type=invite");
  captureConfirmationFragment(target);
  assert.equal(target.__beWiseConfirmation?.(), "");
  assert.equal(JSON.stringify(replaced).includes("synthetic"), false);
  for (const fragment of ["", "token_hash=short&type=invite", "token_hash=synthetic-test-token&type=signup", "token_hash=synthetic-test-token&type=invite&type=recovery", "token_hash=synthetic-test-token&type=invite&next=https://evil.invalid"]) {
    assert.equal(readConfirmationFragment(fragment), null);
  }
  assert.equal(readConfirmationFragment("token_hash=synthetic-test-token&type=recovery")?.type, "recovery");
});

test("failed history cleanup discards fragment, and other routes are untouched", () => {
  const { target } = browser();
  target.history.replaceState = () => { throw new Error("blocked"); };
  captureConfirmationFragment(target);
  assert.equal(target.__beWiseConfirmation?.(), "");
  const other = browser(); other.target.location.pathname = "/auth/error";
  captureConfirmationFragment(other.target);
  assert.equal(other.replaced.length, 0);
  assert.equal(other.target.__beWiseConfirmation, undefined);
});
