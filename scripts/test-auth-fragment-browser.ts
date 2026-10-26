import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { CONFIRMATION_FRAGMENT_BOOTSTRAP } from "../src/lib/auth/fragment";

let phase = "setup";
async function main() {
  const browser = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
  if (!browser) throw new Error("Browser unavailable");
  mkdirSync(".supabase/browser-tests", { recursive: true });
  const marker = `synthetic-fragment-privacy-${randomBytes(12).toString("hex")}`;
  let requests = 0;
  let posts = 0;
  let tokenInRequest = false;
  const server = createServer((req, res) => {
    requests++;
    if (req.method === "POST") posts++;
    if (req.url?.includes(marker)) tokenInRequest = true;
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.end(`<!doctype html><html><head><script>${CONFIRMATION_FRAGMENT_BOOTSTRAP}</script></head><body><script>
      var fragment = window.__beWiseConfirmation ? window.__beWiseConfirmation() : '';
      document.body.dataset.clean = String(!location.hash && !location.search);
      document.body.dataset.ready = String(fragment.includes('type=invite'));
      document.body.dataset.storage = String(localStorage.length + sessionStorage.length);
    </script></body></html>`);
  });
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const run = promisify(execFile);
  async function visit(url: string) {
    const profile = resolve(mkdtempSync(".supabase/browser-tests/fragment-"));
    return run(browser!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--disable-background-networking", "--disable-sync", `--user-data-dir=${profile}`, "--dump-dom", "--virtual-time-budget=7000", url], { timeout: 30000, maxBuffer: 1000000, windowsHide: true });
  }
  try {
    phase = "isolated_browser";
    const fixture = await visit(`http://127.0.0.1:${port}/auth/confirm#token_hash=${marker}&type=invite`);
    assert.match(fixture.stdout, /data-clean="true"/);
    assert.match(fixture.stdout, /data-ready="true"/);
    assert.match(fixture.stdout, /data-storage="0"/);
    assert.equal(tokenInRequest, false);
    assert.equal(posts, 0);
    assert.ok(requests > 0);
    phase = "next_shell";
    const response = await fetch("http://localhost:3000/auth/confirm", { signal: AbortSignal.timeout(20000) });
    const shell = await response.text();
    assert.equal(response.status, 200);
    assert.equal(shell.includes(marker), false);
    const countSubmissions = () => (readFileSync(".next/dev/logs/next-development.log", "utf8").match(/form_received/g) ?? []).length;
    const before = countSubmissions();
    for (const type of ["invite", "recovery"] as const) {
      phase = `next_browser_${type}`;
      const actual = await visit(`http://localhost:3000/auth/confirm#token_hash=${marker}&type=${type}`);
      phase = `next_heading_${type}`;
      assert.match(actual.stdout, type === "invite" ? /Accept invitation/ : /Confirm password recovery/);
      phase = `next_token_input_${type}`;
      assert.ok(actual.stdout.includes(`value="${marker}"`));
      phase = `next_type_input_${type}`;
      assert.ok((actual.stdout.match(/<input\b[^>]*>/g) ?? []).some(tag => /name="type"/.test(tag) && tag.includes(`value="${type}"`)));
    }
    phase = "no_submission";
    assert.equal(countSubmissions(), before);
    phase = "trace_privacy";
    for (const path of [".next/dev/trace", ".next/dev/logs/next-development.log"]) {
      if (existsSync(path)) assert.equal(readFileSync(path, "utf8").includes(marker), false);
    }
    console.log("PASS: real browser fragment scrubbed, memory-only handoff, no token in HTTP requests; real Next.js invite/recovery GETs render Continue without POST or synthetic marker in inspected traces/logs.");
  } finally { server.close(); }
}

void main().catch(() => { console.error(`Fragment browser regression stopped at ${phase}; raw output and URL values suppressed.`); process.exitCode = 1; });
