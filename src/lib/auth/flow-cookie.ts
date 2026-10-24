import type { NextResponse } from "next/server";
import { FLOW_COOKIE_NAME, expiredFlowCookieOptions, flowCookieOptions } from "./flow";

export function setFlowCookie(response: NextResponse, ticket: string, protocol: string) {
  response.cookies.set(FLOW_COOKIE_NAME, ticket, flowCookieOptions(protocol));
}

export function clearFlowCookie(response: NextResponse, protocol: string) {
  response.cookies.set(FLOW_COOKIE_NAME, "", expiredFlowCookieOptions(protocol));
}
