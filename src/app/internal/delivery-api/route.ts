import { deliveryHttp } from "@/features/delivery/http";
export const runtime="nodejs";
export async function GET(r:Request){return deliveryHttp(r);}
export async function POST(r:Request){return deliveryHttp(r);}
