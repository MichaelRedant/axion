import nextPwa from "next-pwa";
import runtimeCaching from "next-pwa/cache.js";

const withPWA = nextPwa({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching,
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    unoptimized: true,
  },
};

export default withPWA(nextConfig);
