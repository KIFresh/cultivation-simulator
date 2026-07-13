import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "修仙模拟器 — AI驱动的修仙世界",
  description:
    "将现实的努力化为修仙世界的修炼。每日学习、运动、早睡打卡，在凡人修仙传的世界中突破境界，遇见韩立、南宫婉……",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Script
          id="fix-extension-styles"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var o=new MutationObserver(function(){document.querySelectorAll("[style*='user-select']").forEach(function(e){e.style.removeProperty("user-select")})});o.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:["style"]});setTimeout(function(){o.disconnect()},5e3)})()`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            {children}
            <Toaster richColors />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
