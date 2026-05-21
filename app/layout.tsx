import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Deals Intelligence",
  description: "Discover IT deal announcements — ERP, CRM, cloud, cybersecurity and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080f16] antialiased">{children}</body>
    </html>
  );
}
