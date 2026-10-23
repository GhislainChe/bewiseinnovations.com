import type { NextRequest } from "next/server";
import { completePassword } from "@/lib/auth/password-handler";

export async function POST(request: NextRequest) { return completePassword(request, "invite"); }
