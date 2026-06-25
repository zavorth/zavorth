/**
 * Kiro IDE MITM Configuration (#336)
 *
 * Kiro IDE removed the Base URL / API Key configuration UI.
 * To route Kiro traffic through Zavorth, we intercept it using MITM,
 * similar to the existing ZavorthBridge/Claude Code implementation.
 *
 * Kiro IDE uses the Anthropic API at https://api.anthropic.com:
 * - Main endpoint: POST /v1/messages
 * - Auth header: x-api-key: <key>
 * - User-Agent contains: "kiro" or "Kiro"
 *
 * To use: install Zavorth's MITM certificate, then run:
 *   zavorth mitm start --targets kiro
 *
 * The MITM server intercepts requests to api.anthropic.com and forwards
 * them to the Zavorth proxy (localhost:20128) instead.
 */

export interface MitmTarget {
  id: string;
  name: string;
  description: string;
  targetHost: string;
  targetPort: number;
  localPort: number;
  userAgentPattern: string | null;
  apiEndpoints: string[];
  authHeader: string;
  instructions: string[];
  referenceIde?: string;
}

/** Kiro IDE MITM profile */
export const KIRO_MITM_PROFILE: MitmTarget = {
  id: "kiro",
  name: "Kiro IDE",
  description: "Intercepts Kiro IDE requests to api.anthropic.com and routes them through Zavorth.",
  targetHost: "api.anthropic.com",
  targetPort: 443,
  localPort: 20130,
  userAgentPattern: null,
  apiEndpoints: ["/v1/messages"],
  authHeader: "x-api-key",
  instructions: [
    "1. Install Zavorth's root certificate: run `zavorth cert install` or go to Settings -> MITM Certificates",
    "2. Start the MITM proxy: `zavorth mitm start --target kiro`",
    "3. Set your system HTTP proxy to 127.0.0.1:20130 (or use transparent MITM via DNS override)",
    "4. Open Kiro IDE - API calls will be automatically routed through Zavorth.",
    "5. Verify: check the Proxy Logs in the Zavorth dashboard and look for provider=anthropic source=mitm",
  ],
  referenceIde: "zavorthBridge",
};
