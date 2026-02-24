import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@rally/ui', '@rally/firebase', '@rally/services', '@rally/infra'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.firebasestorage.app' },
      { protocol: 'https', hostname: '**.googleapis.com' },
      { protocol: 'https', hostname: 'img.vincue.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
