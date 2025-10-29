import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/contexts/AppContext';
import { Analytics } from "@vercel/analytics/next"

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
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
