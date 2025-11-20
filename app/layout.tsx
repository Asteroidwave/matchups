import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { RelationalAppProvider } from '@/contexts/RelationalAppContext';
import { Navigation } from '@/components/layout/Navigation';
import { RelationalNavigation } from '@/components/layout/RelationalNavigation';
import { MigrationPrompt } from '@/components/migration/MigrationPrompt';
import { Analytics } from "@vercel/analytics/react";
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
        <ErrorBoundary>
          <AuthProvider>
            <AppProvider>
              <RelationalAppProvider>
                {/* Migration prompt shows if localStorage data exists */}
                <MigrationPrompt />
                
                {/* Use enhanced navigation with user account features */}
                <RelationalNavigation />
                {children}
                <Analytics />
              </RelationalAppProvider>
            </AppProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

