import { backupDbFile } from "../backup";
import { getDbInstance } from "../core";
import {
  MODEL_COMPAT_PROTOCOL_KEYS,
  type ModelCompatProtocolKey,
} from "@/shared/constants/modelCompat";
import { isForbiddenUpstreamHeaderName } from "@/shared/constants/upstreamHeaders";
import { getKeyValue } from "./modelRowUtils";

const MODEL_COMPAT_NAMESPACE = "modelCompatOverrides";

export { MODEL_COMPAT_PROTOCOL_KEYS, type ModelCompatProtocolKey };

export type ModelCompatPerProtocol = {
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  upstreamHeaders?: Record<string, string>;
};

export type CompatByProtocolMap = Partial<Record<ModelCompatProtocolKey, ModelCompatPerProtocol>>;

export function isCompatProtocolKey(p: string): p is ModelCompatProtocolKey {
  return (MODEL_COMPAT_PROTOCOL_KEYS as readonly string[]).includes(p);
}

const UPSTREAM_HEADERS_MAX = 16;
const UPSTREAM_HEADER_NAME_MAX = 128;
const UPSTREAM_HEADER_VALUE_MAX = 4096;

function isValidUpstreamHeaderName(k: string): boolean {
  if (!k || k.length > UPSTREAM_HEADER_NAME_MAX) return false;
  if (isForbiddenUpstreamHeaderName(k)) return false;
  if (/[\r\n\0]/.test(k)) return false;
  if (/\s/.test(k)) return false;
  if (k.includes(":")) return false;
  return true;
}

export function sanitizeUpstreamHeadersMap(
  raw: Record<string, unknown> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k0, v0] of Object.entries(raw)) {
    const k = String(k0).trim();
    if (!k || !isValidUpstreamHeaderName(k)) {
      continue;
    }
    const v =
      typeof v0 === "string"
        ? v0.trim().slice(0, UPSTREAM_HEADER_VALUE_MAX)
        : String(v0 ?? "")
            .trim()
            .slice(0, UPSTREAM_HEADER_VALUE_MAX);
    if (v.includes("\r") || v.includes("\n")) continue;
    out[k] = v;
    if (Object.keys(out).length >= UPSTREAM_HEADERS_MAX) break;
  }
  return out;
}

export function deepMergeCompatByProtocol(
  prev: CompatByProtocolMap | undefined,
  patch: Partial<Record<ModelCompatProtocolKey, Partial<ModelCompatPerProtocol>>>
): CompatByProtocolMap {
  const out: CompatByProtocolMap = { ...(prev || {}) };
  for (const key of Object.keys(patch) as ModelCompatProtocolKey[]) {
    if (!isCompatProtocolKey(key)) continue;
    const deltas = patch[key];
    if (!deltas || typeof deltas !== "object") continue;
    const hasDelta =
      Object.prototype.hasOwnProperty.call(deltas, "normalizeToolCallId") ||
      Object.prototype.hasOwnProperty.call(deltas, "preserveOpenAIDeveloperRole") ||
      Object.prototype.hasOwnProperty.call(deltas, "upstreamHeaders");
    if (!hasDelta) continue;
    const cur: ModelCompatPerProtocol = { ...(out[key] || {}) };
    if ("normalizeToolCallId" in deltas) {
      cur.normalizeToolCallId = Boolean(deltas.normalizeToolCallId);
    }
    if ("preserveOpenAIDeveloperRole" in deltas) {
      cur.preserveOpenAIDeveloperRole = Boolean(deltas.preserveOpenAIDeveloperRole);
    }
    if ("upstreamHeaders" in deltas) {
      const uh = deltas.upstreamHeaders;
      if (uh === undefined) {
        /* skip */
      } else {
        const s = sanitizeUpstreamHeadersMap(uh as Record<string, unknown>);
        if (Object.keys(s).length === 0) delete cur.upstreamHeaders;
        else cur.upstreamHeaders = s;
      }
    }
    if (Object.keys(cur).length === 0) delete out[key];
    else out[key] = cur;
  }
  return out;
}

export type ModelCompatOverride = {
  id: string;
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  compatByProtocol?: CompatByProtocolMap;
  upstreamHeaders?: Record<string, string>;
  isHidden?: boolean;
};

export function readCompatList(providerId: string): ModelCompatOverride[] {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT value FROM key_value WHERE namespace = ? AND key = ?")
    .get(MODEL_COMPAT_NAMESPACE, providerId);
  const value = getKeyValue(row).value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCompatList(providerId: string, list: ModelCompatOverride[]) {
  const db = getDbInstance();
  if (list.length === 0) {
    db.prepare("DELETE FROM key_value WHERE namespace = ? AND key = ?").run(
      MODEL_COMPAT_NAMESPACE,
      providerId
    );
  } else {
    db.prepare("INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES (?, ?, ?)").run(
      MODEL_COMPAT_NAMESPACE,
      providerId,
      JSON.stringify(list)
    );
  }
  backupDbFile("pre-write");
}

export function getModelCompatOverrides(providerId: string): ModelCompatOverride[] {
  return readCompatList(providerId);
}

export type ModelCompatPatch = {
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean | null;
  compatByProtocol?: CompatByProtocolMap;
  upstreamHeaders?: Record<string, string> | null;
  isHidden?: boolean | null;
};

export function compatByProtocolHasEntries(map: CompatByProtocolMap | undefined): boolean {
  if (!map || typeof map !== "object") return false;
  return Object.keys(map).some((k) => {
    const v = map[k as ModelCompatProtocolKey];
    return v && typeof v === "object" && Object.keys(v).length > 0;
  });
}

export function mergeModelCompatOverride(
  providerId: string,
  modelId: string,
  patch: ModelCompatPatch
) {
  const list = readCompatList(providerId);
  const idx = list.findIndex((e) => e.id === modelId);
  const prev = idx >= 0 ? { ...list[idx] } : { id: modelId };
  const next: ModelCompatOverride = { ...prev, id: modelId };
  if ("normalizeToolCallId" in patch) {
    if (patch.normalizeToolCallId) next.normalizeToolCallId = true;
    else delete next.normalizeToolCallId;
  }
  if ("preserveOpenAIDeveloperRole" in patch) {
    if (patch.preserveOpenAIDeveloperRole === null) {
      delete next.preserveOpenAIDeveloperRole;
    } else {
      next.preserveOpenAIDeveloperRole = Boolean(patch.preserveOpenAIDeveloperRole);
    }
  }
  if (patch.compatByProtocol && Object.keys(patch.compatByProtocol).length > 0) {
    const merged = deepMergeCompatByProtocol(next.compatByProtocol, patch.compatByProtocol);
    if (compatByProtocolHasEntries(merged)) next.compatByProtocol = merged;
    else delete next.compatByProtocol;
  }
  if ("upstreamHeaders" in patch) {
    if (patch.upstreamHeaders === null) {
      delete next.upstreamHeaders;
    } else if (patch.upstreamHeaders && typeof patch.upstreamHeaders === "object") {
      const s = sanitizeUpstreamHeadersMap(patch.upstreamHeaders as Record<string, unknown>);
      if (Object.keys(s).length === 0) delete next.upstreamHeaders;
      else next.upstreamHeaders = s;
    }
  }
  const filtered = list.filter((e) => e.id !== modelId);
  const hasPreserveFlag = Object.prototype.hasOwnProperty.call(next, "preserveOpenAIDeveloperRole");
  const hasTopUpstream = next.upstreamHeaders && Object.keys(next.upstreamHeaders).length > 0;
  if ("isHidden" in patch) {
    if (patch.isHidden === null) {
      delete next.isHidden;
    } else {
      next.isHidden = Boolean(patch.isHidden);
    }
  }
  const hasHiddenFlag = Object.prototype.hasOwnProperty.call(next, "isHidden");
  if (
    next.normalizeToolCallId ||
    hasPreserveFlag ||
    hasHiddenFlag ||
    compatByProtocolHasEntries(next.compatByProtocol) ||
    hasTopUpstream
  ) {
    filtered.push(next);
  }
  writeCompatList(providerId, filtered);
}

export function removeModelCompatOverride(providerId: string, modelId: string) {
  const list = readCompatList(providerId);
  const filtered = list.filter((e) => e.id !== modelId);
  if (filtered.length === list.length) return;
  writeCompatList(providerId, filtered);
}
