import { getServicesRepository } from "@/features/services/server";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  try { return Response.json(await (await getServicesRepository()).publishedCatalog(), { headers }); }
  catch { return Response.json({ message: "Catalog unavailable." }, { status: 503, headers }); }
}
