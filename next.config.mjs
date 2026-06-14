/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // CI runs `pnpm lint` as a separate gate; never silently skip during build.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // CI runs `pnpm typecheck` as a separate gate; never silently skip.
    ignoreBuildErrors: false,
  },
  images: {
    // Steam CDN allow-list — see docs/SECURITY.md. No user-supplied host is permitted.
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.steamstatic.com' },
      { protocol: 'https', hostname: 'media.steampowered.com' },
      { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com' },
    ],
  },
};

export default nextConfig;
