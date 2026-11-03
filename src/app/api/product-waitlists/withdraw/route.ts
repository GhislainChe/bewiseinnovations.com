import {waitlistHttp} from "@/features/products/http";
export const runtime="nodejs";
export async function POST(r:Request){return waitlistHttp(r,true);}
