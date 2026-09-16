import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@demo/api-client'],
  async rewrites() {
    const backend = process.env.API_URL ?? 'http://127.0.0.1:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
      {
        source: '/schemas/:path*',
        destination: `${backend}/schemas/:path*`,
      },
    ];
  },
};
export default config;
