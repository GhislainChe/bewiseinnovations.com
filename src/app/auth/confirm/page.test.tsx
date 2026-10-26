import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ConfirmPage from "./page";

test("confirmation GET renders a token-free inert shell", () => {
  const html = renderToStaticMarkup(ConfirmPage());
  assert.match(html, /Secure confirmation/);
  assert.doesNotMatch(html, /<form|token_hash|<script|https?:\/\//);
});

test("confirmation server page accepts no query token props", () => {
  assert.equal(ConfirmPage.length, 0);
});
