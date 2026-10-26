import { openSync, closeSync, fstatSync, readSync, watchFile, unwatchFile } from "node:fs";
import { safeAuthDiagnosticRecord } from "./auth-diagnostic-output";

// Reads local logs only. No dotenv loading, HTTP requests or server control.
const path = ".next/dev/logs/next-development.log";
const once = process.argv.length === 3 && process.argv[2] === "--once";
if (process.argv.length > 2 && !once) {
  console.error("Use no arguments to watch, or --once to read retained safe events.");
  process.exit(1);
}
let offset = 0;
let partial = "";
let identity = "";
let waiting = false;
function readEvents() {
  let fd;
  try {
    fd = openSync(path, "r");
    const info = fstatSync(fd);
    const currentIdentity = `${info.dev}:${info.ino}`;
    if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error("Log unavailable.");
    if (identity !== currentIdentity || info.size < offset) { offset = 0; partial = ""; }
    identity = currentIdentity;
    const buffer = Buffer.alloc(info.size - offset);
    const bytes = readSync(fd, buffer, 0, buffer.length, offset);
    offset += bytes;
    const lines = (partial + buffer.subarray(0, bytes).toString("utf8")).split("\n");
    partial = lines.pop() ?? "";
    for (const line of lines) {
      const safe = safeAuthDiagnosticRecord(line);
      if (safe) console.log(safe);
    }
    waiting = false;
  } catch {
    if (!waiting) console.log("Local diagnostic log unavailable; no raw errors printed.");
    waiting = true;
    if (once) process.exitCode = 1;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
console.log("Safe authentication labels only. Times are elapsed log times, not wall-clock timestamps.");
readEvents();
if (!once) {
  console.log("Watching local diagnostics. Ctrl+C stops this viewer only.");
  watchFile(path, { interval: 500 }, readEvents);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    unwatchFile(path);
    process.exit(0);
  });
}
