import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentOperator, getAccessibleModules } from '@/lib/operators'
import { ResponsiveDock } from '@/components/navigation/responsive-dock'
import { MainContent } from '@/components/main-content'
import { ThemeProvider } from '@/components/theme-provider'
import { SchemeProvider } from '@/components/scheme-provider'
import { CommandPalette } from '@/components/search/command-palette'
import { StatusBar } from '@/components/status-bar'
import { ToastProvider } from '@/components/ui/visionos-toast'
import { LogoWatermark } from '@/components/logo-watermark'
import { RoutePrefetcher } from '@/components/route-prefetcher'

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "HORIZON",
  description: "Enterprise Operations Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const operator = await getCurrentOperator()
  const accessibleModules = operator ? getAccessibleModules(operator) : ['home']

  const userName = operator ? (operator.name || 'User') : 'User'
  const userRole = operator?.user_role || 'operator'
  const operatorName = operator?.name || 'Horizon'

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-screen overflow-hidden flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SchemeProvider>
            {/* Fixed background — supports optional --app-bg-image */}
            <div className="fixed inset-0 app-bg -z-10" />

            <LogoWatermark />

            <MainContent>
              {children}
            </MainContent>
            <ResponsiveDock operator={operator} accessibleModules={accessibleModules} />
            <StatusBar operatorName={operatorName} userName={userName} userRole={userRole} />
            <CommandPalette />
            <ToastProvider />
            <RoutePrefetcher accessibleModules={accessibleModules} />
          </SchemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
