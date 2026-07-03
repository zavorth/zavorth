import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [
      {
        source: '/zavorthControl',
        destination: '/control',
        permanent: true,
      },
      {
        source: '/zavorthControl/:path*',
        destination: '/control/:path*',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
