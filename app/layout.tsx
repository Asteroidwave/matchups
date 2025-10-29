import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/contexts/AppContext';
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
    <html lang="en">
      <body className={inter.className}>
        <AppProvider>
          <Navigation />
          {children}
          <Analytics />
        </AppProvider>
      </body>
    </html>
  );
}

