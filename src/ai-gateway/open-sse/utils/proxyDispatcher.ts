import type { Dispatcher } from "undici";

export interface ProxyConfig {
  type: string;
  host: string;
  port: string | number;
  username?: string;
  password?: string;
}

export interface ProxyDispatchEntry {
  proxy: string;
  assignedAt: number;
}

const dispatcherCache = new Map<string, ProxyDispatchEntry>();

export function clearDispatcherCache(): void {
  dispatcherCache.clear();
}

export function getDispatcherEntry(key: string): ProxyDispatchEntry | undefined {
  return dispatcherCache.get(key);
}

export function setDispatcherEntry(key: string, proxy: string): void {
  dispatcherCache.set(key, { proxy, assignedAt: Date.now() });
}

export function isSocks5ProxyEnabled(): boolean {
  const raw = process.env.ENABLE_SOCKS5_PROXY;
  if (!raw) return false;
  return new Set(["1", "true", "yes", "on"]).has(raw.trim().toLowerCase());
}

export function proxyConfigToUrl(
  config: ProxyConfig,
  options?: { allowSocks5?: boolean }
): string | null {
  if (!config || !config.host || config.port === undefined || config.port === null || config.port === "") {
    return null;
  }
  const type = String(config.type || "http").toLowerCase();
  if (type.startsWith("socks") && type !== "socks5") return null;
  if (type === "socks5" && !options?.allowSocks5 && !isSocks5ProxyEnabled()) return null;
  if (type !== "http" && type !== "https" && type !== "socks5") return null;

  const credentials =
    config.username || config.password
      ? `${encodeURIComponent(config.username || "")}:${encodeURIComponent(config.password || "")}@`
      : "";
  return `${type}://${credentials}${config.host}:${config.port}`;
}

export function proxyUrlForLogs(proxyUrl: string): string {
  try {
    const url = new URL(proxyUrl);
    if (url.username || url.password) {
      url.username = "***";
      url.password = "***";
    }
    return url.toString();
  } catch {
    const at = proxyUrl.lastIndexOf("@");
    return at >= 0 ? `***@${proxyUrl.slice(at + 1)}` : proxyUrl;
  }
}

export function createProxyDispatcher(proxyUrl: string): Dispatcher | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProxyAgent } = require("undici") as { ProxyAgent: new (url: string) => Dispatcher };
    return new ProxyAgent(proxyUrl);
  } catch {
    return null;
  }
}
