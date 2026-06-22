/** @type {import('next').NextConfig} */
const nextConfig = {
  // During development, proxy /api/* to the Hono backend on :8787.
  // For production, point this at your deployed backend URL.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8787/v1/:path*',
      },
    ];
  },
  reactStrictMode: true,
  experimental: {
    // Allow large AI SDK data-stream responses.
  },
};

export default nextConfig;
