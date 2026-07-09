export type WizardSecretState = {
  configured: boolean;
  masked: string | null;
};

const SECRET_KEYS = new Set([
  'AISTUDIO_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'DISCORD_BOT_TOKEN',
  'XAI_API_KEY',
]);

export function describeWizardSecret(value: string | null | undefined): WizardSecretState {
  const raw = String(value || '').trim();
  if (!raw) {
    return { configured: false, masked: null };
  }
  const tail = raw.length <= 4 ? raw : raw.slice(-4);
  return {
    configured: true,
    masked: `***${tail}`,
  };
}

export function serializeEnvValue(value: string): string {
  const text = String(value ?? '');
  if (/[\s"'\\#]/.test(text) || text.length === 0) {
    return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return text;
}

export function normalizeWizardUpdates(
  updates: Record<string, string | null | undefined>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(updates || {})) {
    const value = rawValue == null ? '' : String(rawValue);
    if (value.includes('\n') || value.includes('\r')) {
      throw new Error(`Env value for ${key} cannot contain line breaks`);
    }
    const trimmed = value.trim();
    // Blank secret fields are ignored so empty UI inputs do not wipe existing secrets.
    if (SECRET_KEYS.has(key) && trimmed.length === 0) {
      continue;
    }
    if (trimmed.length === 0 && !SECRET_KEYS.has(key)) {
      // Non-secret empty fields are also ignored for safety.
      continue;
    }
    next[key] = value;
  }
  return next;
}
