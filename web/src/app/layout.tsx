import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S&P 500",
  description: "Browse S&P 500 stocks and view daily charts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
