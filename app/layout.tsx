import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Navigation } from '@/components/layout/Navigation';
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Horse Racing Matchups',
  description: 'Fantasy horse racing matchup game',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--page-bg)] text-[var(--text-primary)] transition-colors`}>
        <ThemeProvider>
          <AppProvider>
            <Navigation />
            {children}
            <Analytics />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
