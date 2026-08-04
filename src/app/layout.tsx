import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GSTTool — Marketplace to GSTR-1 Converter", template: "%s | GSTTool" },
  description:
    "Convert Amazon, Flipkart, Meesho, JioMart and other marketplace Excel files into GSTR-1 JSON and Excel instantly.",
  keywords: [
    "GST",
    "GSTR-1",
    "Amazon GST",
    "Flipkart GST",
    "Meesho GST",
    "GST Return",
    "GST Tool",
    "Marketplace GST",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
