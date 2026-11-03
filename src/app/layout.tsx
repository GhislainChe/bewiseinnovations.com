import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";
import Script from "next/script";
import { CONFIRMATION_FRAGMENT_BOOTSTRAP } from "@/lib/auth/fragment";
import { EVENT_FRAGMENT_BOOTSTRAP } from "@/features/events/fragment";
import { WAITLIST_FRAGMENT_BOOTSTRAP } from "@/features/products/fragment";

export const metadata: Metadata = {
  title: "BE WISE INNOVATIONS",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Script id="confirmation-fragment-privacy" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: CONFIRMATION_FRAGMENT_BOOTSTRAP }} />
        <Script id="event-fragment-privacy" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: EVENT_FRAGMENT_BOOTSTRAP }} />
        <Script id="waitlist-fragment-privacy" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: WAITLIST_FRAGMENT_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}
