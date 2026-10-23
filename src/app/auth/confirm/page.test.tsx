import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ConfirmPage from "./page";

test("email-link GET renders an inert confirmation form", async () => {
  const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve({ token_hash: "test-token-value", type: "invite" }) }));
  assert.match(html, /action="\/auth\/confirm\/complete"/);
  assert.match(html, /method="post"/);
  assert.match(html, /type="hidden" name="token_hash"/);
  assert.doesNotMatch(html, /<script|https?:\/\//);
});

test("missing token and invalid type do not render a submission form", async () => {
  for (const parameters of [{ type: "invite" }, { token_hash: "token", type: "signup" }]) {
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve(parameters) }));
    assert.doesNotMatch(html, /<form/);
  }
});
