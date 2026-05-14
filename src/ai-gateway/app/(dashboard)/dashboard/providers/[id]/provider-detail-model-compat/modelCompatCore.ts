"use client";

import {
  MODEL_COMPAT_PROTOCOL_KEYS,
  type ModelCompatProtocolKey,
} from "@/shared/constants/modelCompat";

export type CompatByProtocolMap = Partial<
  Record<
    ModelCompatProtocolKey,
    {
      normalizeToolCallId?: boolean;
      preserveOpenAIDeveloperRole?: boolean;
      upstreamHeaders?: Record<string, string>;
    }
  >
>;

export type ModelCompatSavePatch = {
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  upstreamHeaders?: Record<string, string>;
  compatByProtocol?: CompatByProtocolMap;
  isHidden?: boolean;
};

export type CompatModelRow = {
  id?: string;
  name?: string;
  source?: string;
  apiFormat?: string;
  supportedEndpoints?: string[];
  normalizeToolCallId?: boolean;
  preserveOpenAIDeveloperRole?: boolean;
  isHidden?: boolean;
  upstreamHeaders?: Record<string, string>;
  compatByProtocol?: CompatByProtocolMap;
};

export type CompatModelMap = Map<string, CompatModelRow>;

export function buildCompatMap(rows: CompatModelRow[]): CompatModelMap {
  const mappedRows = new Map<string, CompatModelRow>();
  for (const row of rows) {
    if (row.id) mappedRows.set(row.id, row);
  }
  return mappedRows;
}

function getProtoSlice(
  customModel: CompatModelRow | undefined,
  overrideModel: CompatModelRow | undefined,
  protocol: string
) {
  return customModel?.compatByProtocol?.[protocol] ?? overrideModel?.compatByProtocol?.[protocol];
}

export function isModelHidden(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  if (customModel && Object.prototype.hasOwnProperty.call(customModel, "isHidden")) {
    return Boolean(customModel.isHidden);
  }
  const overrideModel = overrideMap.get(modelId);
  if (overrideModel && Object.prototype.hasOwnProperty.call(overrideModel, "isHidden")) {
    return Boolean(overrideModel.isHidden);
  }
  return false;
}

export function providerText(
  t: ((key: string, values?: Record<string, unknown>) => string) & {
    has?: (key: string) => boolean;
  },
  key: string,
  fallback: string,
  values?: Record<string, unknown>
): string {
  if (typeof t.has === "function" && t.has(key)) {
    return t(key, values);
  }
  if (values) {
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      fallback
    );
  }
  return fallback;
}

export function effectiveNormalizeForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
  if (protocolCompat && Object.prototype.hasOwnProperty.call(protocolCompat, "normalizeToolCallId")) {
    return Boolean(protocolCompat.normalizeToolCallId);
  }
  if (customModel?.normalizeToolCallId) return true;
  return Boolean(overrideModel?.normalizeToolCallId);
}

export function effectivePreserveForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
  if (protocolCompat && Object.prototype.hasOwnProperty.call(protocolCompat, "preserveOpenAIDeveloperRole")) {
    return Boolean(protocolCompat.preserveOpenAIDeveloperRole);
  }
  if (
    customModel &&
    Object.prototype.hasOwnProperty.call(customModel, "preserveOpenAIDeveloperRole")
  ) {
    return Boolean(customModel.preserveOpenAIDeveloperRole);
  }
  if (
    overrideModel &&
    Object.prototype.hasOwnProperty.call(overrideModel, "preserveOpenAIDeveloperRole")
  ) {
    return Boolean(overrideModel.preserveOpenAIDeveloperRole);
  }
  return true;
}

export function anyNormalizeCompatBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  if (customModel?.normalizeToolCallId || overrideModel?.normalizeToolCallId) return true;
  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
    if (protocolCompat?.normalizeToolCallId) return true;
  }
  return false;
}

export function anyNoPreserveCompatBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  if (
    customModel &&
    Object.prototype.hasOwnProperty.call(customModel, "preserveOpenAIDeveloperRole") &&
    customModel.preserveOpenAIDeveloperRole === false
  ) {
    return true;
  }
  if (
    overrideModel &&
    Object.prototype.hasOwnProperty.call(overrideModel, "preserveOpenAIDeveloperRole") &&
    overrideModel.preserveOpenAIDeveloperRole === false
  ) {
    return true;
  }
  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
    if (
      protocolCompat &&
      Object.prototype.hasOwnProperty.call(protocolCompat, "preserveOpenAIDeveloperRole") &&
      protocolCompat.preserveOpenAIDeveloperRole === false
    ) {
      return true;
    }
  }
  return false;
}

type ProviderModelsApiErrorBody = {
  error?: {
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
};

export async function formatProviderModelsErrorResponse(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ProviderModelsApiErrorBody;
    const error = data?.error;
    if (Array.isArray(error?.details) && error.details.length > 0) {
      return error.details
        .map((detail) => {
          const field = typeof detail.field === "string" && detail.field ? detail.field : "?";
          const message = typeof detail.message === "string" ? detail.message : "";
          return message ? `${field}: ${message}` : field;
        })
        .join("; ");
    }
    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
  } catch {
    // Ignore JSON parse issues and fallback to HTTP status below.
  }
  const statusText = res.statusText?.trim();
  return statusText || `HTTP ${res.status}`;
}

export function effectiveUpstreamHeadersForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): Record<string, string> {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  const base: Record<string, string> = {};
  if (customModel?.upstreamHeaders && typeof customModel.upstreamHeaders === "object") {
    Object.assign(base, customModel.upstreamHeaders);
  } else if (overrideModel?.upstreamHeaders && typeof overrideModel.upstreamHeaders === "object") {
    Object.assign(base, overrideModel.upstreamHeaders);
  }
  const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
  if (protocolCompat?.upstreamHeaders && typeof protocolCompat.upstreamHeaders === "object") {
    Object.assign(base, protocolCompat.upstreamHeaders);
  }
  return base;
}

export function anyUpstreamHeadersBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const customModel = customMap.get(modelId);
  const overrideModel = overrideMap.get(modelId);
  const nonempty = (headers: unknown) =>
    headers && typeof headers === "object" && !Array.isArray(headers) && Object.keys(headers as object).length > 0;
  if (nonempty(customModel?.upstreamHeaders) || nonempty(overrideModel?.upstreamHeaders)) {
    return true;
  }
  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protocolCompat = getProtoSlice(customModel, overrideModel, protocol);
    if (nonempty(protocolCompat?.upstreamHeaders)) return true;
  }
  return false;
}

export type HeaderDraftRow = { id: string; name: string; value: string };

export const UPSTREAM_HEADERS_UI_MAX = 16;

export function upstreamHeadersRecordsEqual(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

export function recordToHeaderRows(
  record: Record<string, string>,
  genId: () => string
): HeaderDraftRow[] {
  const entries = Object.entries(record).filter(([key]) => key.trim());
  if (entries.length === 0) return [{ id: genId(), name: "", value: "" }];
  return entries.map(([name, value]) => ({ id: genId(), name, value }));
}

export function headerRowsToRecord(rows: HeaderDraftRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.name.trim();
    if (!key) continue;
    out[key] = row.value;
  }
  return out;
}

export const CC_COMPATIBLE_LABEL = "CC Compatible";
export const CC_COMPATIBLE_DETAILS_TITLE = "CC Compatible Details";
export const CC_COMPATIBLE_DEFAULT_CHAT_PATH = "/v1/messages?beta=true";

export function normalizeCodexLimitPolicy(policy: unknown): { use5h: boolean; useWeekly: boolean } {
  const record =
    policy && typeof policy === "object" && !Array.isArray(policy)
      ? (policy as Record<string, unknown>)
      : {};
  return {
    use5h: typeof record.use5h === "boolean" ? record.use5h : true,
    useWeekly: typeof record.useWeekly === "boolean" ? record.useWeekly : true,
  };
}
