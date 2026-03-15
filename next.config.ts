import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xburabmzlolrnywcyxwz.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        // Proxy email images through our domain for better deliverability
        source: '/email-assets/:path*',
        destination: 'https://xburabmzlolrnywcyxwz.supabase.co/storage/v1/object/public/DGA/:path*',
      },
    ];
  },
};

export default nextConfig;

