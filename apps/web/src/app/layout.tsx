import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { TelemetryProvider } from "@/components/providers/TelemetryProvider";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_SITE_NAME || "My Blog",
    template: `%s | ${process.env.NEXT_PUBLIC_SITE_NAME || "My Blog"}`,
  },
  description: "Personal blog and portfolio",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: process.env.NEXT_PUBLIC_SITE_NAME || "My Blog",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TelemetryProvider />
            <Toaster position="bottom-right" />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
