import { submitRequestHttp } from "@/features/services/submission";
export const runtime = "nodejs";
export async function POST(request: Request) { return submitRequestHttp(request); }
