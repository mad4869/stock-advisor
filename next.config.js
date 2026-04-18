/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase timeout for API routes (default 10s may be too short)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Allow external API calls
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 's-maxage=60, stale-while-revalidate=300' },
        ],
      },
    ];
  },

  // Log build info
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

module.exports = nextConfig;