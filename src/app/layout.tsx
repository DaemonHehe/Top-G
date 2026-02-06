import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sora, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/theme-toggle";
import { PwaRegister } from "./components/pwa-register";
import { Analytics } from "@vercel/analytics/next";

const sora = Sora({
  variable: "--font-ui",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Top-G",
  description: "Productivity Suite",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Top-G",
  },
  icons: {
    icon: "/topg-logo.svg",
    apple: "/Top-G-logo.png",
  },
};

export const viewport = {
  themeColor: "#ef4444",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${fraunces.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <div className="relative min-h-screen">
            <div className="pointer-events-none fixed right-6 top-6 z-50 flex justify-end">
              <div className="pointer-events-auto">
                <ThemeToggle />
              </div>
            </div>
            {children}
          </div>
        </ThemeProvider>
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  );
}
