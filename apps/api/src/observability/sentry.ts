/**
 * Lightweight Sentry bridge — activates only when SENTRY_DSN is set.
 * Avoids hard dependency on @sentry/node for local/dev.
 */
export function initSentryFromEnv() {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  process.on("uncaughtException", (err) => {
    // eslint-disable-next-line no-console
    console.error("[sentry-bridge] uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.error("[sentry-bridge] unhandledRejection", reason);
  });

  // eslint-disable-next-line no-console
  console.log(
    `[sentry-bridge] SENTRY_DSN configured (env=${process.env.SENTRY_ENVIRONMENT ?? "development"}). Install @sentry/node for full SDK.`,
  );
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN?.trim()) return;
  // eslint-disable-next-line no-console
  console.error("[sentry-bridge] captureException", error, context ?? {});
}
