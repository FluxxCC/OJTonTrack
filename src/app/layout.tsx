import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "../components/ServiceWorkerRegister";
import InstallPrompt from "../components/InstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OJTonTrack",
  description: "OJT Management System",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons-512.png",
    shortcut: "/icons-512.png",
    apple: "/icons-512.png",
  },
};

import type { Viewport } from "next";
export const viewport: Viewport = {
  themeColor: "#F97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ServiceWorkerRegister />
        <PushNotificationManager />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
