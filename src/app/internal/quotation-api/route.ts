import { quotationHttp } from "@/features/quotations/http";
export const runtime="nodejs";
export async function GET(request: Request) { return quotationHttp(request); }
export async function POST(request: Request) { return quotationHttp(request); }
