import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import AuthErrorPage from "./page";

test("authentication error page is a stable render with no form, automatic navigation or untrusted message", async () => {
  const html = renderToStaticMarkup(await AuthErrorPage({ searchParams: Promise.resolve({ message: "untrusted-private-message" }) }));
  assert.match(html, /Authentication status/);
  assert.doesNotMatch(html, /<form|<script|http-equiv|untrusted-private-message/);
});
