import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, open, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { identifier } from "../services/validation";
import { assertLocalBusinessRuntime } from "../services/runtime";
export const pdfHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function artifactPath(id: string, hash: string) {
  assertLocalBusinessRuntime();identifier(id);
  if(!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid artifact identity.");
  const directory=resolve(".supabase/documents/quotations");
  await mkdir(directory,{recursive:true,mode:0o700});
  if(await realpath(directory)!==directory) throw new Error("Private artifact path must not be redirected.");
  return join(directory,id+"-"+hash+".pdf");
}
export async function preserveQuotationPdf(id: string,bytes: Uint8Array) {
  if(bytes.byteLength>2000000 || Buffer.from(bytes.subarray(0,5)).toString()!=="%PDF-") throw new Error("Invalid PDF.");
  const hash=pdfHash(bytes),path=await artifactPath(id,hash);
  try {
    const file=await open(path,"wx",0o600);
    try { await file.writeFile(bytes);await file.sync(); } finally { await file.close(); }
  }
  catch(error) { if((error as NodeJS.ErrnoException).code!=="EEXIST" || pdfHash(await readFile(path))!==hash) throw new Error("Private document persistence failed."); }
  if(pdfHash(await readFile(path))!==hash)throw new Error("Private document integrity failed before finalization.");
  return hash;
}
export async function readQuotationPdf(id: string,hash: string) {
  const data=await readFile(await artifactPath(id,hash));
  if(data.length>2000000 || pdfHash(data)!==hash) throw new Error("Document integrity check failed.");
  return data;
}
