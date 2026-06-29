import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingIncludes: {
    "/*": ["./src/server/schema.sql"],
  },
};

export default nextConfig;
