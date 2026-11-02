import type { Metadata } from "next";
import { PublicServices } from "@/features/services/public-services";
export const metadata: Metadata = { title: "Request a quote | BE WISE INNOVATIONS", robots: { index: false, follow: false } };
export default async function ProjectRequestPage({ searchParams }: { searchParams: Promise<{ service?: string | string[] }> }) {
  const params = await searchParams;
  return <PublicServices mode="request" selectedService={typeof params.service === "string" ? params.service : undefined} />;
}
