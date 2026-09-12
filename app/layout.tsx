import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import * as React from "react";

import { MobileHeader, MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { getMerchantId, isPhiniteConfigured } from "@/lib/config";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Dolfin";

export const metadata: Metadata = {
  title: {
    default: `${appName} — Your AI Store Manager`,
    template: `%s · ${appName}`,
  },
  description:
    "Dolfin tells you what to restock, how much to buy, who to buy it from, and why.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read on the server so the browser never learns anything about credentials
  // beyond whether a backend is present.
  const connected = isPhiniteConfigured();
  const merchantId = getMerchantId();

  return (
    <html lang="en-IN">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Sidebar appName={appName} merchantId={merchantId} connected={connected} />
        <MobileHeader appName={appName} />

        <div className="lg:pl-60">
          <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:py-10">
            {children}
          </main>
        </div>

        <MobileNav />
      </body>
    </html>
  );
}
