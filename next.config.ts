import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    // Ensure Turbopack uses the current folder as the workspace root
    root: '.',
  },
};

export default nextConfig;
