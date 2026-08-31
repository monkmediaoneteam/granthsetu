import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // Book files live outside /public so they are never statically served.
  // They still must be bundled into the serverless function that reads them.
  outputFileTracingIncludes: {
    "/api/download": ["./private/books/**"],
  },
  async headers() {
    return [
      {
        source: "/api/download",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default config;
