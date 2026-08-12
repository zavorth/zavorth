export interface IPFilterConfig {
  whitelist: string[];
  blacklist: string[];
  tempBans: Map<string, { until: number; reason?: string }>;
}

export interface IPFilterSnapshot {
  whitelist: string[];
  blacklist: string[];
  tempBans: Array<{ ip: string; until: number; reason?: string }>;
}

const config: IPFilterConfig = {
  whitelist: [],
  blacklist: [],
  tempBans: new Map(),
};

export function configureIPFilter(cfg: { whitelist?: string[]; blacklist?: string[] }): void {
  if (cfg.whitelist) config.whitelist = cfg.whitelist;
  if (cfg.blacklist) config.blacklist = cfg.blacklist;
}

export function addToWhitelist(ip: string): void {
  if (!config.whitelist.includes(ip)) config.whitelist.push(ip);
}

export function removeFromWhitelist(ip: string): void {
  const idx = config.whitelist.indexOf(ip);
  if (idx >= 0) config.whitelist.splice(idx, 1);
}

export function addToBlacklist(ip: string): void {
  if (!config.blacklist.includes(ip)) config.blacklist.push(ip);
}

export function removeFromBlacklist(ip: string): void {
  const idx = config.blacklist.indexOf(ip);
  if (idx >= 0) config.blacklist.splice(idx, 1);
}

export function getIPFilterConfig(): IPFilterSnapshot {
  return {
    whitelist: [...config.whitelist],
    blacklist: [...config.blacklist],
    tempBans: [...config.tempBans.entries()].map(([ip, entry]) => ({
      ip,
      until: entry.until,
      ...(entry.reason ? { reason: entry.reason } : {}),
    })),
  };
}

export function tempBanIP(ip: string, durationMs: number, reason?: string): void {
  config.tempBans.set(ip, { until: Date.now() + durationMs, ...(reason ? { reason } : {}) });
}

export function removeTempBan(ip: string): void {
  config.tempBans.delete(ip);
}

export function checkIPAllowed(ip: string): boolean {
  if (config.whitelist.includes(ip)) return true;
  if (config.blacklist.includes(ip)) return false;
  const ban = config.tempBans.get(ip);
  if (ban && ban.until > Date.now()) return false;
  if (ban && ban.until <= Date.now()) config.tempBans.delete(ip);
  return true;
}
