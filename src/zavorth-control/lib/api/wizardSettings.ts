const SECRET_KEYS = new Set(["AISTUDIO_API_KEY", "GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN"]);
const ALLOWED_KEYS = new Set([...SECRET_KEYS, "TELEGRAM_DEFAULT_CHAT_ID"]);

export type WizardFieldState = {
  configured: boolean;
  masked: string | null;
};

export type WizardSettingsResponse = {
  fields: Record<string, WizardFieldState>;
};

export function describeWizardSecret(value: string | undefined): WizardFieldState {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return { configured: false, masked: null };
  }
  return {
    configured: true,
    masked: normalized.length <= 8 ? "***" : `***${normalized.slice(-4)}`,
  };
}

export function normalizeWizardUpdates(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throwInvalid("Invalid wizard payload.");
  }

  const input = body as Record<string, unknown>;
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throwInvalid(`Unsupported setting: ${key}.`);
    }
    if (typeof value !== "string") {
      throwInvalid(`Invalid value for ${key}.`);
    }
    const normalized = value.trim();
    if (SECRET_KEYS.has(key) && !normalized) {
      continue;
    }
    assertSafeEnvValue(key, normalized);
    updates[key] = normalized;
  }
  return updates;
}

export function serializeEnvValue(value: string): string {
  if (!value) {
    return "";
  }
  if (/^[A-Za-z0-9_./:@+=,\-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function assertSafeEnvValue(key: string, value: string): void {
  if (/[\r\n]/.test(value)) {
    throwInvalid(`${key} cannot contain line breaks.`);
  }
  if (value.length > 4096) {
    throwInvalid(`${key} is too long.`);
  }
  if (key === "TELEGRAM_DEFAULT_CHAT_ID" && value && !/^-?\d{1,32}$/.test(value)) {
    throwInvalid("TELEGRAM_DEFAULT_CHAT_ID must be a numeric chat id.");
  }
}

function throwInvalid(message: string): never {
  const error = new Error(message) as Error & { code?: string };
  error.code = "invalid_wizard_settings";
  throw error;
}
