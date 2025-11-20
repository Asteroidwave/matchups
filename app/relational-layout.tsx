/**
 * Relational Layout - Uses the new relational database system
 * REPLACES the localStorage-dependent layout
 */
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { RelationalAppProvider } from "@/contexts/RelationalAppContext";
import { MigrationPrompt } from "@/components/migration/MigrationPrompt";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RelationalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <RelationalAppProvider>
            {/* Migration prompt will show if localStorage data exists */}
            <MigrationPrompt />
            
            <main className="min-h-screen bg-background">
              {children}
            </main>
            
            <Toaster />
          </RelationalAppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
