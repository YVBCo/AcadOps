import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ['lucide-react'] },
  compiler: { removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false },

  // Remove X-Powered-By header
  poweredByHeader: false,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ── Content Security Policy ──────────────────────────────
          // Strict CSP to prevent XSS, code injection, and data exfiltration.
          // - default-src 'self': only allow resources from same origin
          // - script-src 'self' 'unsafe-inline' 'unsafe-eval': required by Next.js
          // - style-src 'self' 'unsafe-inline': required for styled-jsx and inline styles
          // - img-src 'self' data: blob: https:: allow images from HTTPS sources
          // - font-src 'self' https://fonts.gstatic.com: Google Fonts
          // - connect-src: API server + analytics
          // - frame-ancestors 'none': prevent framing (clickjacking)
          // - object-src 'none': block Flash/Java plugins
          // - base-uri 'self': prevent base tag hijacking
          // - form-action 'self': restrict form submissions
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' http://localhost:4000 https://*.onrender.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // ── Clickjacking Protection ──────────────────────────────
          { key: 'X-Frame-Options', value: 'DENY' },
          // ── MIME Sniffing Protection ──────────────────────────────
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // ── Referrer Policy ──────────────────────────────────────
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // ── Permissions Policy ───────────────────────────────────
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // ── Cross-Origin Opener Policy ───────────────────────────
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // ── DNS Prefetch Control ─────────────────────────────────
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
