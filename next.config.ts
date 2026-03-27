import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: "c:/Users/user/Desktop/frontend_ontology/gie-frontend",
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
