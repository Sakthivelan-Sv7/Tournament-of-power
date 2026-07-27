import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Tournament of Power",
  description: "The ultimate sport-agnostic Tournament Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans bg-background text-foreground">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
