import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Security headers on every response. The Content-Security-Policy is per-request (it carries a
 * nonce) and is set in src/proxy.ts.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera + location for the driver app (proof of delivery photos, GPS); everything else off
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./src/lib/pdf/fonts/**"],
  },
  // next/image is not used: allow no remote hosts (prevents the optimiser acting as an open proxy)
  images: { remotePatterns: [] },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
