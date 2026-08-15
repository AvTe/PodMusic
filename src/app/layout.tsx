import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Needed so og:image / twitter:image and canonicals resolve to absolute URLs.
  // Inherited by every segment, including (main).
  metadataBase: new URL(SITE_URL),
  title: "PodMixer — Audiobook & Ambient Music Player",
  description: "Extract audio from any URL and mix with ambient YouTube sounds.",
  // Set GOOGLE_SITE_VERIFICATION in the Vercel project to emit the Search
  // Console tag. Absent locally, so no empty meta is rendered.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#06081a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
