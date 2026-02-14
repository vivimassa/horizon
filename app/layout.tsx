import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getCurrentOperator, getAccessibleModules, type OperatorWithRole } from '@/lib/operators'
import { Dock } from '@/components/navigation/dock'
import { BreadcrumbNav } from '@/components/navigation/breadcrumb-nav'

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

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen pb-24">
          <div className="container mx-auto p-8">
            <BreadcrumbNav />
            {children}
          </div>
        </div>
        <Dock operator={operator} accessibleModules={accessibleModules} />
      </body>
    </html>
  );
}
