export const CLOUDFLARED_RELEASE_BASE =
  "https://github.com/cloudflare/cloudflared/releases/latest/download";
export const START_TIMEOUT_MS = 30000;
export const STOP_TIMEOUT_MS = 5000;
export const GENERIC_EXIT_ERROR_PREFIX = "cloudflared exited";
export const DEFAULT_CERT_FILE_CANDIDATES = [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
  "/etc/ssl/cert.pem",
  "/private/etc/ssl/cert.pem",
] as const;
export const DEFAULT_CERT_DIR_CANDIDATES = [
  "/etc/ssl/certs",
  "/etc/pki/tls/certs",
  "/system/etc/security/cacerts",
] as const;

export type CloudflaredInstallSource = "managed" | "path" | "env";
export type TunnelPhase =
  | "unsupported"
  | "not_installed"
  | "stopped"
  | "starting"
  | "running"
  | "error";

export type AssetSpec = {
  assetName: string;
  binaryName: string;
  archive: "none" | "tgz";
  downloadUrl: string;
};

export type CloudflaredRuntimeDirs = {
  runtimeRoot: string;
  homeDir: string;
  configDir: string;
  cacheDir: string;
  dataDir: string;
  tempDir: string;
  userProfileDir: string;
  appDataDir: string;
  localAppDataDir: string;
};

export type BinaryResolution = {
  binaryPath: string | null;
  source: CloudflaredInstallSource | null;
  managed: boolean;
};

export type PersistedTunnelState = {
  binaryPath?: string | null;
  installSource?: CloudflaredInstallSource | null;
  ownerPid?: number | null;
  pid?: number | null;
  publicUrl?: string | null;
  apiUrl?: string | null;
  targetUrl?: string | null;
  status?: TunnelPhase;
  lastError?: string | null;
  startedAt?: string | null;
  installedAt?: string | null;
};

export type CloudflaredTunnelStatus = {
  supported: boolean;
  installed: boolean;
  managedInstall: boolean;
  installSource: CloudflaredInstallSource | null;
  binaryPath: string | null;
  running: boolean;
  pid: number | null;
  publicUrl: string | null;
  apiUrl: string | null;
  targetUrl: string;
  stage: TunnelPhase;
  lastError: string | null;
  logPath: string;
};

export const CLOUDFLARED_SAFE_ENV_KEYS = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "ProgramData",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "COMSPEC",
  "PATHEXT",
  "TMPDIR",
  "TMP",
  "TEMP",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
] as const;

export const NON_ACTIONABLE_CLOUDFLARED_WARNING_PATTERNS = [
  /failed to sufficiently increase receive buffer size/i,
] as const;
