import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Integration tests may run while the developer server owns `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
