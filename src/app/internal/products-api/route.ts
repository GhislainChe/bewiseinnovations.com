import {staffProductsHttp} from "@/features/products/http";
export const runtime="nodejs";
export async function GET(r:Request){return staffProductsHttp(r);}
export async function POST(r:Request){return staffProductsHttp(r);}
