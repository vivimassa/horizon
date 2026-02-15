import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentOperator, getAccessibleModules } from '@/lib/operators'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { ResponsiveDock } from '@/components/navigation/responsive-dock'
import { MainContent } from '@/components/main-content'
import { ThemeProvider } from '@/components/theme-provider'
import { SchemeProvider } from '@/components/scheme-provider'
import { CommandPalette } from '@/components/search/command-palette'
import { StatusBar } from '@/components/status-bar'
import { Toaster } from 'sonner'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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
  const profile = await getOperatorProfile()

  const userName = operator ? (operator.name || 'User') : 'User'
  const userRole = operator?.user_role || 'operator'
  const operatorName = profile?.name || 'Horizon'

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased h-screen overflow-hidden flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SchemeProvider>
            {/* Fixed background — supports optional --app-bg-image */}
            <div className="fixed inset-0 app-bg -z-10" />

            <MainContent>
              {children}
            </MainContent>
            <ResponsiveDock operator={operator} accessibleModules={accessibleModules} />
            <StatusBar operatorName={operatorName} userName={userName} userRole={userRole} />
            <CommandPalette />
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'glass-heavy',
                style: { backdropFilter: 'blur(16px)' },
              }}
            />
          </SchemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
