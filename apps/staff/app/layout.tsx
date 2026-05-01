import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AuthProvider } from './providers';
import { ImpersonationHandoff } from '@rally/ui';

export const metadata: Metadata = {
  title: { default: 'Rally', template: '%s | Rally' },
  description: 'Dealership operating system',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="bg-[var(--surface-base)] text-[var(--text-primary)] antialiased min-h-screen">
        <AuthProvider>
          <ImpersonationHandoff />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
