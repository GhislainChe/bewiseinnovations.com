import { StaffPage } from "@/features/services/staff-page";
export const dynamic = "force-dynamic";
export const metadata = { title: "Client requests | BE WISE", robots: { index: false, follow: false } };
export default function Page() { return <StaffPage mode="requests" />; }
