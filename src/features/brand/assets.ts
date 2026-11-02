import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { brand } from "./identity";
export async function officialLogo() {
 const bytes=await readFile(join(process.cwd(),"public/brand/original/renewed logo.png"));
 if(createHash("sha256").update(bytes).digest("hex")!==brand.logoSha256)throw new Error("Official brand asset integrity check failed.");
 return bytes;
}
