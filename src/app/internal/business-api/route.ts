import { staffBusinessHttp } from "@/features/services/staff-http";
export const runtime = "nodejs";
export async function GET(request: Request) { return staffBusinessHttp(request); }
export async function POST(request: Request) { return staffBusinessHttp(request); }
