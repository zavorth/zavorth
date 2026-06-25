import fsSync from "fs";
import {
  CLOUDFLARED_SAFE_ENV_KEYS,
  DEFAULT_CERT_DIR_CANDIDATES,
  DEFAULT_CERT_FILE_CANDIDATES,
  GENERIC_EXIT_ERROR_PREFIX,
  NON_ACTIONABLE_CLOUDFLARED_WARNING_PATTERNS,
  type CloudflaredRuntimeDirs,
} from "./cloudflaredTunnelTypes";
import { getCloudflaredRuntimeDirs } from "./cloudflaredTunnelPaths";

export function extractTryCloudflareUrl(text: string) {
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
  if (!match) return null;

  try {
    const hostname = new URL(match[0]).hostname.toLowerCase();
    if (hostname === "api.trycloudflare.com") return null;
  } catch {
    return null;
  }

  return match[0];
}

function normalizeCloudflaredLogLine(line: string) {
  return line
    .trim()
    .replace(/^\d{4}-\d{2}-\d{2}T\S+\s+(?:INF|WRN|ERR)\s+/i, "")
    .trim();
}

export function extractCloudflaredErrorMessage(text: string) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(normalizeCloudflaredLogLine)
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    if (NON_ACTIONABLE_CLOUDFLARED_WARNING_PATTERNS.some((pattern) => pattern.test(lines[i]))) {
      continue;
    }
    if (/(?:\berror\b|\bfailed\b|\btls:\b|\bx509\b|\bcertificate\b)/i.test(lines[i])) {
      return lines[i];
    }
  }

  return null;
}

export function isSpecificCloudflaredError(error: string | null | undefined) {
  return !!error && !error.startsWith(GENERIC_EXIT_ERROR_PREFIX);
}

export function getGenericExitError(code: number | null, signal: NodeJS.Signals | null) {
  return `cloudflared exited unexpectedly (${code ?? "signal"}${signal ? `/${signal}` : ""})`;
}

export function getDefaultCloudflaredCertEnv(
  existsSync: (candidate: string) => boolean = fsSync.existsSync,
  certFileCandidates: readonly string[] = DEFAULT_CERT_FILE_CANDIDATES,
  certDirCandidates: readonly string[] = DEFAULT_CERT_DIR_CANDIDATES
) {
  const certEnv: NodeJS.ProcessEnv = {};
  const certFile = certFileCandidates.find((candidate) => existsSync(candidate));
  const certDir = certDirCandidates.find((candidate) => existsSync(candidate));

  if (certFile) certEnv.SSL_CERT_FILE = certFile;
  if (certDir) certEnv.SSL_CERT_DIR = certDir;

  return certEnv;
}

export function buildCloudflaredChildEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  runtimeDirs: CloudflaredRuntimeDirs = getCloudflaredRuntimeDirs(),
  defaultCertEnv: NodeJS.ProcessEnv = getDefaultCloudflaredCertEnv()
): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {};

  for (const key of CLOUDFLARED_SAFE_ENV_KEYS) {
    const value = sourceEnv[key];
    if (typeof value === "string" && value.length > 0) {
      childEnv[key] = value;
    }
  }

  childEnv.HOME = runtimeDirs.homeDir;
  childEnv.XDG_CONFIG_HOME = runtimeDirs.configDir;
  childEnv.XDG_CACHE_HOME = runtimeDirs.cacheDir;
  childEnv.XDG_DATA_HOME = runtimeDirs.dataDir;
  childEnv.USERPROFILE = runtimeDirs.userProfileDir;
  childEnv.APPDATA = runtimeDirs.appDataDir;
  childEnv.LOCALAPPDATA = runtimeDirs.localAppDataDir;

  if (!childEnv.TMPDIR) childEnv.TMPDIR = runtimeDirs.tempDir;
  if (!childEnv.TMP) childEnv.TMP = runtimeDirs.tempDir;
  if (!childEnv.TEMP) childEnv.TEMP = runtimeDirs.tempDir;
  if (!childEnv.SSL_CERT_FILE && defaultCertEnv.SSL_CERT_FILE) {
    childEnv.SSL_CERT_FILE = defaultCertEnv.SSL_CERT_FILE;
  }
  if (!childEnv.SSL_CERT_DIR && defaultCertEnv.SSL_CERT_DIR) {
    childEnv.SSL_CERT_DIR = defaultCertEnv.SSL_CERT_DIR;
  }

  const requestedProtocol = String(
    sourceEnv.CLOUDFLARED_PROTOCOL || sourceEnv.TUNNEL_TRANSPORT_PROTOCOL || "http2"
  )
    .trim()
    .toLowerCase();
  const protocol =
    requestedProtocol === "quic" || requestedProtocol === "auto" ? requestedProtocol : "http2";

  if (protocol !== "auto") {
    childEnv.TUNNEL_TRANSPORT_PROTOCOL = protocol;
  }

  return childEnv;
}

export function getCloudflaredStartArgs(targetUrl: string) {
  return ["tunnel", "--url", targetUrl, "--no-autoupdate"];
}
