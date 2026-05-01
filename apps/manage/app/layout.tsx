import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppProviders } from './providers';
import { ImpersonationHandoff } from '@rally/ui';

export const metadata: Metadata = {
  title: 'Rally Management',
  description: 'Management Console — store operations, analytics, and team management',
};

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="bg-surface-base text-text-primary antialiased min-h-screen">
        <AppProviders>
          <ImpersonationHandoff />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
