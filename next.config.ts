import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The redesign lived at /osho while it was being built; it is now the
      // main page. Keeps older links working.
      { source: '/osho', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
