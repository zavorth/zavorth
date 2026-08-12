import { asErrorLike } from '../utils/errorLike';
// Server startup script
import initializeCloudSync from "./shared/services/initializeCloudSync";
import { enforceSecrets } from "./shared/utils/secretsValidator";
import { initAuditLog, cleanupExpiredLogs, logAuditEvent } from "./lib/compliance/index";
import { initConsoleInterceptor } from "./lib/consoleInterceptor";
import { logger } from "@/shared/utils/logger";

async function startServer() {
  // Trigger request-log layout migration during startup, before serving requests.
  await import("./lib/usage/migrations");

  // Console interceptor: capture all console output to log file (must be first)
  initConsoleInterceptor();// Validate required secrets before anything else (fail-fast)
  enforceSecrets();

  // Compliance: Initialize audit_log table
  try {
    initAuditLog();
    logger.info("[COMPLIANCE] Audit log table initialized");
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[COMPLIANCE] Could not initialize audit log:", err.message);
  }

  // Compliance: One-time cleanup of expired logs
  try {
    const cleanup = cleanupExpiredLogs();
    if (
      cleanup.deletedUsage ||
      cleanup.deletedCallLogs ||
      cleanup.deletedProxyLogs ||
      cleanup.deletedRequestDetailLogs ||
      cleanup.deletedAuditLogs ||
      cleanup.deletedMcpAuditLogs
    ) {
      logger.info("[COMPLIANCE] Expired log cleanup:", cleanup);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[COMPLIANCE] Log cleanup failed:", err.message);
  }

  logger.info("Starting server with cloud sync...");

  try {
    // Initialize cloud sync
    await initializeCloudSync();
    logger.info("Server started with cloud sync initialized");

    // Log server start event to audit log
    logAuditEvent({ action: "server.start", details: { timestamp: new Date().toISOString() } });
  } catch (error: unknown) {logger.error("[FATAL] Error initializing cloud sync:", error);
    process.exit(1);
  }

  // Pricing sync: opt-in external pricing data (non-blocking, never fatal)
  if (process.env.PRICING_SYNC_ENABLED === "true") {
    try {
      const { initPricingSync } = await import("./lib/pricingSync");
      await initPricingSync();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn(
        "[PRICING_SYNC] Could not initialize:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

// Start the server initialization
startServer().catch((err) => {
  logger.error("[FATAL] Server initialization failed:", err);
  process.exit(1);
});

// Export for use as module if needed
export default startServer;
