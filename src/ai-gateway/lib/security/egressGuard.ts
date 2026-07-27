import { lookup } from "dns/promises";
import { isIP } from "net";export interface EgressGuardOptions {
  allowHttp?: boolean;
  allowPrivateEnvVar?: string;
  serviceName?: string;
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  );
}

function isPrivateIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1]) {
    return isPrivateIPv4(mapped[1]);
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("ff")
  );
}

export function isPrivateNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

function privateTargetsAllowed(envVar?: string): boolean {
  if (process.env.ALLOW_PRIVATE_EGRESS_TARGETS === "true") {
    return true;
  }
  return Boolean(envVar && process.env[envVar] === "true");
}

export async function assertPublicHttpTargetAllowed(
  rawUrl: string,
  options: EgressGuardOptions = {}
): Promise<URL> {
  const serviceName = options.serviceName || "Outbound request";
  const allowHttp = options.allowHttp !== false;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error: unknown) {throw new Error(`${serviceName} URL is invalid`);
  }

  if (parsed.protocol !== "https:" && (!allowHttp || parsed.protocol !== "http:")) {
    throw new Error(`${serviceName} URL must use ${allowHttp ? "http or https" : "https"}`);
  }

  if (privateTargetsAllowed(options.allowPrivateEnvVar)) {
    return parsed;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`${serviceName} URL must not target localhost`);
  }

  if (isIP(hostname) && isPrivateNetworkAddress(hostname)) {
    throw new Error(`${serviceName} URL must not target private or loopback addresses`);
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch (error: unknown) {throw new Error(`${serviceName} hostname could not be resolved`);
  }

  if (resolved.length === 0 || resolved.some((entry) => isPrivateNetworkAddress(entry.address))) {
    throw new Error(`${serviceName} URL resolved to a private or loopback address`);
  }

  return parsed;
}

export async function assertProviderValidationTargetAllowed(rawUrl: string): Promise<URL> {
  return assertPublicHttpTargetAllowed(rawUrl, {
    allowPrivateEnvVar: "ALLOW_PRIVATE_PROVIDER_VALIDATION_TARGETS",
    serviceName: "Provider validation",
  });
}

export async function assertProviderRequestTargetAllowed(rawUrl: string): Promise<URL> {
  return assertPublicHttpTargetAllowed(rawUrl, {
    allowPrivateEnvVar: "ALLOW_PRIVATE_PROVIDER_TARGETS",
    serviceName: "Provider request",
  });
}
