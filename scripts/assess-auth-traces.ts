// Local metadata assessment only. Never deletes, copies raw logs, or loads credentials.
import { createReadStream } from "node:fs";
import { lstat, readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { safeAuthDiagnosticRecord } from "./auth-diagnostic-output";

async function main() {
  if (process.argv.length !== 2) throw new Error();
  const root = resolve(".next/dev");
  const output = resolve(".supabase/auth-trace-assessments");
  execFileSync("git", ["check-ignore", "--quiet", ".next/dev/trace"], { stdio: "ignore" });
  execFileSync("git", ["check-ignore", "--quiet", ".supabase/auth-trace-assessments/check.json"], { stdio: "ignore" });
  const files: string[] = [];
  async function walk(directory: string) {
    if ((await lstat(directory)).isSymbolicLink()) throw new Error();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (!path.startsWith(root + sep) || /token_hash|token%5fhash/i.test(path)) throw new Error();
      if (entry.isSymbolicLink()) throw new Error();
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  let bytesScanned = 0;
  const matches = [];
  const changedFiles: string[] = [];
  for (const path of files) {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error();
    const digest = createHash("sha256");
    let carry = "", count = 0, bytes = 0;
    for await (const raw of createReadStream(path, { highWaterMark: 65536 })) {
      const chunk = raw as Buffer;
      digest.update(chunk); bytes += chunk.length;
      const text = carry + chunk.toString("latin1");
      // Supabase's historical token-hash shape. Never retain any matched value.
      for (const match of text.matchAll(/(?:token_hash|token%5fhash)(?:=|%3d|\\u003d)[a-f0-9]{56}(?![a-f0-9])/gi)) {
        if (match.index + match[0].length > carry.length) count++;
      }
      carry = text.slice(-256);
    }
    bytesScanned += bytes;
    const after = await lstat(path);
    const name = relative(process.cwd(), path).replaceAll("\\", "/");
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) changedFiles.push(name);
    if (count) matches.push({ path: name, bytes, sha256: digest.digest("hex"), tokenQueryPatternOccurrences: count });
  }
  const log = resolve(root, "logs/next-development.log");
  if ((await lstat(log)).size > 8 * 1024 * 1024) throw new Error();
  const labels = (await readFile(log, "utf8")).split("\n").map(safeAuthDiagnosticRecord).filter((x): x is string => x !== null);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const report = {
    assessedAt: new Date().toISOString(), scope: ".next/dev", filesScanned: files.length, bytesScanned,
    pattern: "56-hex token_hash query assignments; raw/percent/JSON-escaped equals", changedDuringScan: changedFiles,
    sensitiveGeneratedFiles: matches, sanitizedDiagnosticEvents: labels,
    limitation: "Pattern assessment only, not proof of absence of all secrets. Running server may append after assessment.",
    deletedFiles: 0, rawContentsCopied: false,
  };
  await mkdir(output, { recursive: true });
  const manifest = resolve(output, `stage-2d24-${stamp}.json`);
  await writeFile(manifest, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ manifest: relative(process.cwd(), manifest), filesScanned: files.length, bytesScanned,
    sensitiveGeneratedFiles: matches.map(({ path, bytes, tokenQueryPatternOccurrences }) => ({ path, bytes, tokenQueryPatternOccurrences })),
    changedDuringScan: changedFiles, preservedSafeEvents: labels.length, deletedFiles: 0 }, null, 2));
}

void main().catch(() => { console.error("Local trace assessment stopped; raw file contents and error payloads suppressed. Nothing deleted."); process.exitCode = 1; });
