import type { Metadata } from "next";
import { PublicServices } from "@/features/services/public-services";
export const metadata: Metadata = { title: "Services | BE WISE INNOVATIONS", robots: { index: false, follow: false } };
export default function ServicesPage() { return <PublicServices mode="catalog" />; }
