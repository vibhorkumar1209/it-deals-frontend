import "./globals.css";

export const metadata = {
  title: "RefractOne — Enrichment",
  description:
    "AI-powered IT deal scraper — find ERP, CRM, cloud, cybersecurity and outsourcing deals for any company.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
