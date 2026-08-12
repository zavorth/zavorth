import { ZAVORTH_STORAGE_PLANE } from "./storagePlane";

export interface ZavorthSettingsBackup {
  providerConnections?: Record<string, unknown>[];
  providerNodes?: Record<string, unknown>[];
  combos?: Record<string, unknown>[];
  apiKeys?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
  modelAliases?: Record<string, unknown>;
  mitmAlias?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  customModels?: Record<string, unknown>;
  proxyConfig?: {
    global?: unknown;
    providers?: unknown;
    combos?: unknown;
    keys?: unknown;
  } | null;
  _meta?: {
    exportedAt?: string;
    version?: string;
    storagePlane?: string;
    sourceVersion?: string;
  };
}

export type LegacySettingsBackup = ZavorthSettingsBackup;

export const SUPPORTED_LEGACY_SETTINGS_EXPORT_VERSIONS = [
  "ZavorthGateway-v3-settings-export",
] as const;

export const SUPPORTED_SETTINGS_EXPORT_VERSIONS = [
  ZAVORTH_STORAGE_PLANE.settingsExportVersion,
  ...SUPPORTED_LEGACY_SETTINGS_EXPORT_VERSIONS,
] as const;

export type SettingsBackupCompatibilityMode = "zavorth" | "legacy" | "unversioned";

export type SettingsBackupValidation =
  | {
      ok: true;
      data: ZavorthSettingsBackup;
      mode: SettingsBackupCompatibilityMode;
      version: string | null;
    }
  | {
      ok: false;
      error: string;
    };

const settingsBackupDataKeys: Array<keyof Omit<ZavorthSettingsBackup, "_meta">> = [
  "providerConnections",
  "providerNodes",
  "combos",
  "apiKeys",
  "settings",
  "modelAliases",
  "mitmAlias",
  "pricing",
  "customModels",
  "proxyConfig",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasBackupPayload(data: ZavorthSettingsBackup): boolean {
  return settingsBackupDataKeys.some((key) => {
    const value = data[key];
    if (Array.isArray(value)) return value.length > 0;
    if (isPlainObject(value)) return Object.keys(value).length > 0;
    return value !== undefined && value !== null;
  });
}

export function asZavorthSettingsBackup(value: unknown): ZavorthSettingsBackup {
  if (!isPlainObject(value)) {
    return {};
  }

  return value as ZavorthSettingsBackup;
}

export function validateZavorthSettingsBackup(value: unknown): SettingsBackupValidation {
  if (!isPlainObject(value)) {
    return { ok: false, error: "Settings backup must be a JSON object." };
  }

  const data = asZavorthSettingsBackup(value);
  const version = typeof data._meta?.version === "string" ? data._meta.version : null;

  if (version) {
    if (version === ZAVORTH_STORAGE_PLANE.settingsExportVersion) {
      return { ok: true, data, mode: "zavorth", version };
    }
    if (SUPPORTED_LEGACY_SETTINGS_EXPORT_VERSIONS.includes(version as any)) {
      return { ok: true, data, mode: "legacy", version };
    }

    return {
      ok: false,
      error: `Unsupported settings backup version: ${version}`,
    };
  }

  if (hasBackupPayload(data)) {
    return { ok: true, data, mode: "unversioned", version: null };
  }

  return {
    ok: false,
    error: "The JSON file does not look like a Zavorth settings backup.",
  };
}

export function stripUnsafeAuthSettings(data: ZavorthSettingsBackup): ZavorthSettingsBackup {
  if (!isPlainObject(data.settings)) {
    return data;
  }

  const { password: _password, requireLogin: _requireLogin, ...safeSettings } = data.settings;
  return { ...data, settings: safeSettings };
}

const SENSITIVE_BACKUP_KEY_PATTERN =
  /apiKey|accessToken|refreshToken|idToken|clientSecret|privateKey|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret|password|private[_-]?key|authorization|bearer|credential/i;

function redactSensitiveBackupValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_BACKUP_KEY_PATTERN.test(key)) {
    if (value === null || value === undefined || value === "") {
      return value;
    }
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveBackupValue(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveBackupValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function redactApiKeyRows(rows: unknown): unknown {
  if (!Array.isArray(rows)) {
    return rows;
  }
  return rows.map((entry) => {
    if (!isPlainObject(entry)) {
      return entry;
    }
    return {
      ...(redactSensitiveBackupValue(entry) as Record<string, unknown>),
      key: typeof entry.key === "string" ? `${entry.key.slice(0, 8)}****${entry.key.slice(-4)}` : entry.key,
    };
  });
}

export function redactZavorthSettingsBackupSecrets(data: ZavorthSettingsBackup): ZavorthSettingsBackup {
  return {
    ...data,
    providerConnections: redactSensitiveBackupValue(data.providerConnections) as Record<string, unknown>[] | undefined,
    apiKeys: redactApiKeyRows(data.apiKeys) as Record<string, unknown>[] | undefined,
    settings: redactSensitiveBackupValue(data.settings) as Record<string, unknown> | undefined,
    proxyConfig: redactSensitiveBackupValue(data.proxyConfig) as ZavorthSettingsBackup["proxyConfig"],
  };
}

export function createZavorthSettingsBackup(
  data: Omit<ZavorthSettingsBackup, "_meta">
): ZavorthSettingsBackup {
  return {
    ...data,
    _meta: {
      exportedAt: new Date().toISOString(),
      version: ZAVORTH_STORAGE_PLANE.settingsExportVersion,
      storagePlane: ZAVORTH_STORAGE_PLANE.id,
    },
  };
}

export function createZavorthSettingsBackupFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `${ZAVORTH_STORAGE_PLANE.settingsBackupFilePrefix}-${timestamp}.json`;
}
