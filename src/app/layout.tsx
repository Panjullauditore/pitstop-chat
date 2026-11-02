import type { Metadata, Viewport } from "next";
import "./globals.css";
import {LanguageProvider} from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/brand/pitlane-symbol.png", type: "image/png" }],
    apple: "/brand/pitlane-symbol.png",
  },
  applicationName: "Pitstop",
  title: "Pitstop — Multiple Minds. One Team. One Goal.",
  description: "Pitstop: Ruang kerja kolaborasi tim manusia dan multi-AI agent untuk berdiskusi, berbagi ide, dan bekerja bersama.",
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground overflow-hidden">
        <LanguageProvider>{children}
        <Toaster position="top-right" richColors /></LanguageProvider>
      </body>
    </html>
  );
}
