import type { ZavorthEnsembleIsolationMode } from '../../../agents/ZavorthEnsembleTypes.js';

export type PersonaIsolationMode = ZavorthEnsembleIsolationMode;

export interface PersonaRoutine {
  id: string;
  name: string;
  cronExpression: string;
  taskPrompt: string;
  targetChannel?: string | null;
  enabled: boolean;
  lastRunAt?: string | null;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  systemPrompt: string;
  modelPreference?: string | null;
  allowedTools?: string[] | null;
  allowedDomains?: string[] | null;
  isolationMode: PersonaIsolationMode;
  passiveInspectionEnabled: boolean;
  scheduleRoutines?: PersonaRoutine[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaInput {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  systemPrompt: string;
  modelPreference?: string | null;
  allowedTools?: string[] | null;
  allowedDomains?: string[] | null;
  isolationMode?: PersonaIsolationMode;
  passiveInspectionEnabled?: boolean;
  scheduleRoutines?: PersonaRoutine[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePersonaInput {
  name?: string;
  role?: string;
  avatar?: string;
  systemPrompt?: string;
  modelPreference?: string | null;
  allowedTools?: string[] | null;
  allowedDomains?: string[] | null;
  isolationMode?: PersonaIsolationMode;
  passiveInspectionEnabled?: boolean;
  scheduleRoutines?: PersonaRoutine[];
  metadata?: Record<string, unknown>;
}

export function sanitizePersonaId(rawId: string): string {
  return String(rawId || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validatePersonaInput(input: CreatePersonaInput): { valid: boolean; error?: string } {
  const sanitizedId = sanitizePersonaId(input.id);
  if (!sanitizedId) {
    return { valid: false, error: 'Persona ID is required and must contain alphanumeric characters.' };
  }
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: 'Persona name is required.' };
  }
  if (!input.role || !input.role.trim()) {
    return { valid: false, error: 'Persona role is required.' };
  }
  if (!input.systemPrompt || !input.systemPrompt.trim()) {
    return { valid: false, error: 'Persona systemPrompt is required.' };
  }

  const validIsolationModes: PersonaIsolationMode[] = [
    'direct',
    'temp-worktree',
    'docker',
    'wsl',
    'external-sandbox',
  ];

  if (input.isolationMode && !validIsolationModes.includes(input.isolationMode)) {
    return {
      valid: false,
      error: `Invalid isolationMode '${input.isolationMode}'. Valid modes: ${validIsolationModes.join(', ')}`,
    };
  }

  return { valid: true };
}
