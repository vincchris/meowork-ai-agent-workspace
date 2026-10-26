import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meowork — tiny AI company",
  description: "Don't just chat with AI. Give your AI team work to do.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream text-cocoa min-h-screen">{children}</body>
    </html>
  );
}
