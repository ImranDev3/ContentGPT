/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api/* to the Hono backend. In dev, default to localhost; if
  // LAN_HOST is set (e.g. 192.168.0.122 when hosting on the local network
  // for other devices to access), use that instead so the browser on a
  // remote device can still reach the backend.
  async rewrites() {
    const lanHost = process.env.LAN_HOST;
    const backendBase = lanHost
      ? `http://${lanHost}:8787/v1/:path*`
      : 'http://localhost:8787/v1/:path*';
    return [
      {
        source: '/api/:path*',
        destination: backendBase,
      },
    ];
  },
  reactStrictMode: true,
  experimental: {
    // Allow large AI SDK data-stream responses.
  },
  // When binding the dev server to 0.0.0.0, allow this host header from
  // other devices on the network.
  allowedDevOrigins: ['http://192.168.0.122:3000', 'http://localhost:3000'],
};

export default nextConfig;
