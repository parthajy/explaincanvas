import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import { Analytics } from "@/components/Analytics";
import { ldJson, organizationLd, websiteLd, SITE } from "@/lib/seo";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ExplainCanvas: understand anything visually", template: "%s | ExplainCanvas" },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  keywords: ["visual learning", "AI tutor", "explain with a diagram", "doubt solving", "concept explained visually", "3D", "animation", "step by step", "study help", "India"],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  category: "education",
  alternates: { canonical: SITE.url },
  openGraph: { siteName: SITE.name, type: "website", locale: "en_IN", url: SITE.url, title: "ExplainCanvas: understand anything visually", description: SITE.tagline },
  twitter: { card: "summary_large_image", title: "ExplainCanvas", description: SITE.tagline },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  formatDetection: { telephone: false },
  verification: { other: { "msvalidate.01": "E338B8251BF4C0179E7227136C2334CA" } },
};

export const viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#09090b" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(organizationLd(), websiteLd()) }} />
      </head>
      <body className="min-h-full">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
