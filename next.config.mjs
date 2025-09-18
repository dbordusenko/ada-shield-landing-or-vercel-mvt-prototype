/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'axe-core'],
  },
};

export default nextConfig;