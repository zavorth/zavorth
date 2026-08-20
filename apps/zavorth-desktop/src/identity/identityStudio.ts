export type IdentityMemoryMode = 'off' | 'session' | 'balanced' | 'long-term';
export type IdentitySessionPreset = 'default' | 'developer' | 'creator' | 'business' | 'research';

export type IdentityStudioProfile = {
  agentName: string;
  voice: string;
  userProfile: string;
  rules: string[];
  memoryMode: IdentityMemoryMode;
  sessionPreset: IdentitySessionPreset;
};

type IdentityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DEFAULT_IDENTITY_STUDIO_PROFILE: IdentityStudioProfile = {
  agentName: 'Zavorth',
  voice: 'Calm, direct, elegant and careful.',
  userProfile: '',
  rules: [
    'Confirm risks before running destructive actions.',
    'Keep answers concise when the user asks for execution.',
  ],
  memoryMode: 'balanced',
  sessionPreset: 'default',
};

const memoryModes: IdentityMemoryMode[] = ['off', 'session', 'balanced', 'long-term'];
const sessionPresets: IdentitySessionPreset[] = ['default', 'developer', 'creator', 'business', 'research'];

export function identityStudioStorageKey(sessionId?: string | null): string {
  return `zvd:identity-studio:${sessionId?.trim() || 'global'}`;
}

export function sanitizeIdentityStudioProfile(value: Partial<IdentityStudioProfile> | null | undefined): IdentityStudioProfile {
  const agentName = cleanText(value?.agentName) || DEFAULT_IDENTITY_STUDIO_PROFILE.agentName;
  const voice = cleanText(value?.voice) || DEFAULT_IDENTITY_STUDIO_PROFILE.voice;
  const userProfile = cleanText(value?.userProfile);
  const rules = Array.isArray(value?.rules)
    ? value.rules.map(cleanText).filter(Boolean)
    : DEFAULT_IDENTITY_STUDIO_PROFILE.rules;
  const memoryMode = memoryModes.includes(value?.memoryMode as IdentityMemoryMode)
    ? value?.memoryMode as IdentityMemoryMode
    : DEFAULT_IDENTITY_STUDIO_PROFILE.memoryMode;
  const sessionPreset = sessionPresets.includes(value?.sessionPreset as IdentitySessionPreset)
    ? value?.sessionPreset as IdentitySessionPreset
    : DEFAULT_IDENTITY_STUDIO_PROFILE.sessionPreset;

  return {
    agentName,
    voice,
    userProfile,
    rules: rules.length > 0 ? rules : DEFAULT_IDENTITY_STUDIO_PROFILE.rules,
    memoryMode,
    sessionPreset,
  };
}

export function loadIdentityStudioProfile(
  storage: IdentityStorage | undefined = currentStorage(),
  sessionId?: string | null,
): IdentityStudioProfile {
  if (!storage) {
    return DEFAULT_IDENTITY_STUDIO_PROFILE;
  }

  const saved = storage.getItem(identityStudioStorageKey(sessionId));
  if (!saved) {
    return DEFAULT_IDENTITY_STUDIO_PROFILE;
  }

  try {
    return sanitizeIdentityStudioProfile(JSON.parse(saved));
  } catch {
    return DEFAULT_IDENTITY_STUDIO_PROFILE;
  }
}

export function saveIdentityStudioProfile(
  profile: Partial<IdentityStudioProfile>,
  storage: IdentityStorage | undefined = currentStorage(),
  sessionId?: string | null,
): IdentityStudioProfile {
  const sanitized = sanitizeIdentityStudioProfile(profile);
  storage?.setItem(identityStudioStorageKey(sessionId), JSON.stringify(sanitized));
  return sanitized;
}

export function resetIdentityStudioProfile(
  storage: IdentityStorage | undefined = currentStorage(),
  sessionId?: string | null,
): IdentityStudioProfile {
  storage?.removeItem(identityStudioStorageKey(sessionId));
  return DEFAULT_IDENTITY_STUDIO_PROFILE;
}

export function buildIdentityStudioPrompt(profile: IdentityStudioProfile): string {
  const sanitized = sanitizeIdentityStudioProfile(profile);
  const rules = sanitized.rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
  return [
    `Agent identity: ${sanitized.agentName}`,
    `Voice: ${sanitized.voice}`,
    sanitized.userProfile ? `User profile: ${sanitized.userProfile}` : 'User profile: Not specified',
    `Memory mode: ${sanitized.memoryMode}`,
    `Session preset: ${sanitized.sessionPreset}`,
    'Rules:',
    rules,
  ].join('\n');
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function currentStorage(): IdentityStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
