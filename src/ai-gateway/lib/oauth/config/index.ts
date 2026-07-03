/**
 * OAuth CLI Configuration
 *
 * Provides server credentials for OAuth CLI services to communicate
 * with the running Zavorth gateway when saving tokens.
 */

import { getRuntimePorts } from "@/lib/runtime/ports";
import { getZavorthOAuthServerCredentials } from "../authPlane";

interface ServerCredentials {
  server: string;
  token: string;
  userId: string;
}

function getDefaultApiServer() {
  const { zavorthControlPort } = getRuntimePorts();
  return `http://localhost:${zavorthControlPort}`;
}

/**
 * Get server credentials from environment variables.
 * Used by OAuth CLI services to save tokens to the running server.
 */
export function getServerCredentials(): ServerCredentials {
  return getZavorthOAuthServerCredentials(getDefaultApiServer());
}
