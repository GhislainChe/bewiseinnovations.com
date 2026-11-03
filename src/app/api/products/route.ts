import {publicProductsHttp} from "@/features/products/http";
export const runtime="nodejs";
export async function GET(r:Request){return publicProductsHttp(r);}
