export interface AgentProfile {
  id: string;
  name: string;
  systemPrompt: string;
  effort: 'low' | 'medium' | 'high' | 'ultra';
  costLimit: number;
  isCustom: boolean;
}

export const CUSTOM_PROFILES_STORAGE_KEY = 'zvd:custom-profiles';

export const defaultProfiles: AgentProfile[] = [
  {
    id: 'personal',
    name: 'Personal',
    systemPrompt: 'Short, friendly tone tailored for personal assistance.',
    effort: 'medium',
    costLimit: 5,
    isCustom: false,
  },
  {
    id: 'creator',
    name: 'Creator',
    systemPrompt: 'Creative, imaginative responses tailored for writing and content creation.',
    effort: 'high',
    costLimit: 10,
    isCustom: false,
  },
  {
    id: 'developer',
    name: 'Developer',
    systemPrompt: 'Highly technical code analysis, bug fixing, and detailed system prompt.',
    effort: 'high',
    costLimit: 20,
    isCustom: false,
  },
  {
    id: 'business',
    name: 'Business',
    systemPrompt: 'Concise, professional tone oriented for business planning and emails.',
    effort: 'medium',
    costLimit: 5,
    isCustom: false,
  },
  {
    id: 'power',
    name: 'Power User',
    systemPrompt: 'Deep systematic reasoning, multi-step analysis, and highly detailed output.',
    effort: 'ultra',
    costLimit: 50,
    isCustom: false,
  },
];

type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

function fallbackStorage(): ProfileStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function sanitizeCustomProfile(value: unknown): AgentProfile | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AgentProfile>;
  const effort = raw.effort === 'low' || raw.effort === 'medium' || raw.effort === 'high' || raw.effort === 'ultra'
    ? raw.effort
    : 'medium';
  const id = String(raw.id || '').trim();
  const name = String(raw.name || '').trim();
  const systemPrompt = String(raw.systemPrompt || '').trim();
  if (!id || !name || !systemPrompt) return null;
  return {
    id,
    name,
    systemPrompt,
    effort,
    costLimit: Number.isFinite(Number(raw.costLimit)) ? Number(raw.costLimit) : 5,
    isCustom: true,
  };
}

export function loadCustomProfiles(storage: ProfileStorage | null = fallbackStorage()): AgentProfile[] {
  if (!storage) return [];
  try {
    const stored = storage.getItem(CUSTOM_PROFILES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.map(sanitizeCustomProfile).filter((item): item is AgentProfile => Boolean(item))
      : [];
  } catch {
    return [];
  }
}

export function persistCustomProfiles(profiles: AgentProfile[], storage: ProfileStorage | null = fallbackStorage()): AgentProfile[] {
  const customProfiles = profiles.filter(profile => profile.isCustom);
  storage?.setItem(CUSTOM_PROFILES_STORAGE_KEY, JSON.stringify(customProfiles));
  return customProfiles;
}

export function createCustomProfile(
  input: {
    name: string;
    systemPrompt: string;
    effort: AgentProfile['effort'];
    costLimit: number;
  },
  idFactory: () => string = () => `profile_${Date.now()}`,
): AgentProfile {
  return {
    id: idFactory(),
    name: input.name.trim() || 'Custom profile',
    systemPrompt: input.systemPrompt.trim() || 'Custom Zavorth desktop profile.',
    effort: input.effort,
    costLimit: Number.isFinite(input.costLimit) ? input.costLimit : 5,
    isCustom: true,
  };
}

export function addCustomProfile(current: AgentProfile[], profile: AgentProfile): AgentProfile[] {
  return [...current.filter(item => item.id !== profile.id), { ...profile, isCustom: true }];
}

export function deleteCustomProfile(current: AgentProfile[], id: string): AgentProfile[] {
  return current.filter(profile => profile.id !== id);
}

export function mergeProfiles(customProfiles: AgentProfile[]): AgentProfile[] {
  return [...defaultProfiles, ...customProfiles.filter(profile => profile.isCustom)];
}
