import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentOperator, getAccessibleModules } from '@/lib/operators'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { Dock } from '@/components/navigation/dock'
import { BreadcrumbNav } from '@/components/navigation/breadcrumb-nav'
import { ThemeProvider } from '@/components/theme-provider'
import { SchemeProvider } from '@/components/scheme-provider'
import { CommandPalette } from '@/components/search/command-palette'
import { StatusBar } from '@/components/status-bar'

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
        className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SchemeProvider>
            {/* Fixed background — supports optional --app-bg-image */}
            <div className="fixed inset-0 app-bg -z-10" />

            <div className="min-h-screen pb-36">
              <div className="container mx-auto p-8">
                <BreadcrumbNav />
                {children}
              </div>
            </div>
            <Dock operator={operator} accessibleModules={accessibleModules} />
            <StatusBar operatorName={operatorName} userName={userName} userRole={userRole} />
            <CommandPalette />
          </SchemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
