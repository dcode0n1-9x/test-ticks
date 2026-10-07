import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebSocket Live Market Data Tester — AG Grid",
  description: "High-performance multi-WebSocket live market tick tester using AG Grid with transaction batching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
