import * as Sentry from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  /* config options here */
};

// CJS / ESM interop 対策: モジュール構造に応じて関数を取得
const withSentryConfig =
  typeof Sentry.withSentryConfig === "function"
    ? Sentry.withSentryConfig
    : (Sentry as unknown as { default: { withSentryConfig: typeof Sentry.withSentryConfig } }).default?.withSentryConfig;

export default withSentryConfig(nextConfig, {
  org: "minerva-juppiter",
  project: "aidentity",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
});
