import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      // /home was a near-duplicate of the homepage — same H1, same meta, no
      // inbound links from the site itself. Two URLs competing for the same
      // query is a self-inflicted ranking split, so it 301s into '/'.
      { source: "/home", destination: "/", permanent: true },
      // Single-character paths are HeyCatch short links; the query string is
      // the channel attribution, so it must survive the redirect. No real
      // route on the site is one character long.
      {
        source: "/:l([a-z0-9])",
        destination: "/?utm_source=heycatch&utm_campaign=:l",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
