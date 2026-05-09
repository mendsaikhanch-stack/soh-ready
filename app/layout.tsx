import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DarkModeProvider } from "@/app/lib/dark-mode";
import { I18nProvider } from "@/app/lib/i18n";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://soh-ready.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Хотол — СӨХ удирдлагын систем",
  description: "Байрны төлбөр, зарлал, засвар, тайлан — бүгд нэг апп дээр. Утсандаа суулгаж ашиглаарай.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Хотол",
  },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: siteUrl,
    siteName: "Хотол",
    title: "Хотол — Байрны бүх зүйл нэг дор",
    description: "СӨХ-ийн төлбөр, мэдэгдэл, засвар, тайлан — бүгд нэг апп дээр. Утсандаа суулгаж ашиглаарай.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Хотол — Байрны бүх зүйл нэг дор",
    description: "СӨХ-ийн төлбөр, мэдэгдэл, засвар, тайлан — бүгд нэг апп дээр.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <I18nProvider>
          <DarkModeProvider>
            {children}
          </DarkModeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
