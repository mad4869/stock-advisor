import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import ApiStatus from '@/components/APIStatus';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  title: 'StockAdvisor — Smart Stock Recommendations',
  description:
    'Get data-driven stock recommendations, lot size calculations, and portfolio monitoring for US and Indonesian markets.',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'StockAdvisor — Smart Stock Recommendations',
    description:
      'Technical analysis powered stock recommendations for US & Indonesian markets.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-dark-900 text-white antialiased`}>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex justify-end">
            <ApiStatus />
          </div>
        </div>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}