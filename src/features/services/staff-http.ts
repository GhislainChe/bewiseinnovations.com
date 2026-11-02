import "server-only";
import { inspectAuthOrigin } from "@/lib/auth/origin";
import { AuthorizationError } from "@/lib/auth/core";
import { readBoundedJson } from "./submission";
import { BusinessConflictError, getServicesRepository } from "./server";
import { assertLocalBusinessRuntime } from "./runtime";
import { identifier, record } from "./validation";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
type Repository = Awaited<ReturnType<typeof getServicesRepository>>;
export async function staffBusinessHttp(request: Request, repository = getServicesRepository): Promise<Response> {
  try {
    assertLocalBusinessRuntime();
    let repo: Repository;
    if (request.method === "GET") {
      repo = await repository();
      const q = new URL(request.url).searchParams;
      switch (q.get("view")) {
        case "catalog": return Response.json(await repo.staffCatalog(), { headers });
        case "requests": return Response.json(await repo.listRequests(100, q.get("reference") ?? ""), { headers });
        case "detail": {
          const id = identifier(q.get("id"));
          const detail = await repo.getRequest(id);
          return Response.json({ detail, attachments: detail ? await repo.attachments(id) : [] }, { headers });
        }
        default: throw new Error();
      }
    }
    if (request.method !== "POST" || !inspectAuthOrigin(request).allowed) return Response.json({ message: "Request rejected." }, { status: 403, headers });
    const input = record(await readBoundedJson(request));
    if (Object.keys(input).some(k => !["operation", "input"].includes(k))) throw new Error();
    repo = await repository();
    switch (input.operation) {
      case "service": return Response.json(await repo.saveService(input.input), { headers });
      case "budget": return Response.json(await repo.saveBudget(input.input), { headers });
      case "status": return Response.json(await repo.changeRequestStatus(input.input), { headers });
      case "download": {
        const data = record(input.input);
        if (Object.keys(data).some(k => k !== "id")) throw new Error();
        return Response.json({ url: await repo.attachmentDownload(identifier(data.id)) }, { headers });
      }
      default: throw new Error();
    }
  } catch (error) {
    const conflict = error instanceof BusinessConflictError;
    return Response.json({ message: conflict ? "This record changed. Reload before editing again." : "Operation unavailable. Check your access and input, then reload to inspect the current state." }, { status: error instanceof AuthorizationError ? 403 : conflict ? 409 : 400, headers });
  }
}
