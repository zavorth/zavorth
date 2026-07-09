import fs from 'fs';
import { readZavorthEnv } from '../config/configHelpers.js';
import { config } from '../config/index.js';
import type { ZavorthProfile } from './RuntimeProfileService.js';
import { normalizeZavorthProfile } from './RuntimeProfileService.js';
import { logger } from '../logger.js';

export type ZavorthProductMode = 'chat' | 'assistant' | 'builder' | 'operator';

export type ZavorthProductModeSnapshot = {
  id: ZavorthProductMode;
  label: string;
  summary: string;
  description: string;
  defaultRuntimeProfile: ZavorthProfile;
  runtimeProfile: ZavorthProfile;
  profileAligned: boolean;
  visibleSurfaces: string[];
  hiddenByDefault: string[];
  escalationTargets: ZavorthProductMode[];
  commands: {
    show: string;
    set: string;
    cliStatus: string;
    cliSet: string;
  };
};

type ProductModeMeta = Omit<ZavorthProductModeSnapshot, 'runtimeProfile' | 'profileAligned' | 'commands'>;

const PRODUCT_MODE_ORDER: ZavorthProductMode[] = ['chat', 'assistant', 'builder', 'operator'];

const PRODUCT_MODE_META: Record<ZavorthProductMode, ProductModeMeta> = {
  chat: {
    id: 'chat',
    label: 'Zavorth Chat',
    summary: 'Conversar e responder por web ou Telegram, sem expor shell e diffs por padrao.',
    description: 'Modo mais simples para quem so quer falar com a IA por onde ja usa no dia a dia.',
    defaultRuntimeProfile: 'core',
    visibleSurfaces: ['chat', 'approvals', 'artifacts-basicos', 'status-enxuto'],
    hiddenByDefault: ['tool-cards', 'diffs', 'companions', 'mesh', 'observability'],
    escalationTargets: ['assistant', 'builder', 'operator'],
  },
  assistant: {
    id: 'assistant',
    label: 'Zavorth Assistant',
    summary: 'Conversa, arquivos leves e approvals simples com runtime ainda leve.',
    description: 'Modo para ajudar com arquivos e tarefas do workspace sem abrir tudo de uma vez.',
    defaultRuntimeProfile: 'core',
    visibleSurfaces: ['chat', 'artifacts', 'approvals', 'recomendacoes'],
    hiddenByDefault: ['tool-cards-avancados', 'diffs', 'companions', 'mesh'],
    escalationTargets: ['builder', 'operator'],
  },
  builder: {
    id: 'builder',
    label: 'Zavorth Builder',
    summary: 'Codigo, diffs, tools e selfmod preview com capabilities sob demanda.',
    description: 'Modo voltado a construcao e iteracao tecnica, mantendo o host em core por padrao.',
    defaultRuntimeProfile: 'core',
    visibleSurfaces: ['chat', 'tool-cards', 'diffs', 'artifacts', 'selfmod-preview', 'resources'],
    hiddenByDefault: ['mesh-avancada', 'companions-pesados', 'observability-profunda'],
    escalationTargets: ['operator'],
  },
  operator: {
    id: 'operator',
    label: 'Zavorth Operator',
    summary: 'Runtime, companions, observability e governanca amplos para operacao supervisionada.',
    description: 'Modo para dono do runtime e operador que quer controlar host, mesh, companions e rollout.',
    defaultRuntimeProfile: 'ops',
    visibleSurfaces: ['chat', 'tool-cards', 'diffs', 'artifacts', 'resources', 'companions', 'health', 'mesh'],
    hiddenByDefault: [],
    escalationTargets: [],
  },
};

export function isZavorthProductMode(value: string | null | undefined): value is ZavorthProductMode {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'chat'
    || normalized === 'assistant'
    || normalized === 'builder'
    || normalized === 'operator';
}

export function inferZavorthProductModeFromProfile(profile: string | null | undefined): ZavorthProductMode {
  const normalizedProfile = normalizeZavorthProfile(profile);
  if (normalizedProfile === 'ops' || normalizedProfile === 'full') {
    return 'operator';
  }
  return 'builder';
}

export function normalizeZavorthProductMode(
  rawValue: string | null | undefined,
  fallbackProfile: string | null | undefined = 'core',
): ZavorthProductMode {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (isZavorthProductMode(normalized)) {
    return normalized;
  }
  return inferZavorthProductModeFromProfile(fallbackProfile);
}

export function resolveDefaultRuntimeProfileForProductMode(mode: string | null | undefined): ZavorthProfile {
  const normalized = normalizeZavorthProductMode(mode);
  return PRODUCT_MODE_META[normalized].defaultRuntimeProfile;
}

export function resolvePersistedProductMode(stateFilePath?: string | null): ZavorthProductMode | null {
  const resolvedStateFilePath =
    String(stateFilePath || '').trim()
    || String(process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE || '').trim()
    || config.capabilityLifecycleStateFile;
  try {
    if (!resolvedStateFilePath || !fs.existsSync(resolvedStateFilePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(resolvedStateFilePath, 'utf8')) as {
      productMode?: string | null;
      profile?: string | null;
    };
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return normalizeZavorthProductMode(parsed.productMode, parsed.profile);
  } catch (error: unknown) {logger.warn('[Product Mode] JSON parse failed', error); return null; }
}

export function resolveBootstrapProductMode(
  explicitMode?: string | null,
  runtimeProfile?: string | null,
  options: { stateFilePath?: string | null } = {},
): ZavorthProductMode {
  const explicit = String(explicitMode || '').trim();
  if (explicit) {
    return normalizeZavorthProductMode(explicit, runtimeProfile);
  }

  const envMode = String(process.env.ZAVORTH_PRODUCT_MODE || '').trim();
  const envProfile = readZavorthEnv('ZAVORTH_PROFILE');
  if (envMode) {
    return normalizeZavorthProductMode(envMode, runtimeProfile || envProfile || config.zavorthProfile);
  }

  const persisted = resolvePersistedProductMode(options.stateFilePath);
  if (persisted) {
    return persisted;
  }

  return normalizeZavorthProductMode(
    config.zavorthProductMode,
    runtimeProfile || envProfile || config.zavorthProfile,
  );
}

export function buildZavorthProductModeSnapshot(
  mode: string | null | undefined,
  runtimeProfile: string | null | undefined,
): ZavorthProductModeSnapshot {
  const normalizedRuntimeProfile = normalizeZavorthProfile(runtimeProfile);
  const normalizedMode = normalizeZavorthProductMode(mode, normalizedRuntimeProfile);
  const meta = PRODUCT_MODE_META[normalizedMode];
  return {
    ...meta,
    runtimeProfile: normalizedRuntimeProfile,
    profileAligned: meta.defaultRuntimeProfile === normalizedRuntimeProfile,
    visibleSurfaces: [...meta.visibleSurfaces],
    hiddenByDefault: [...meta.hiddenByDefault],
    escalationTargets: [...meta.escalationTargets],
    commands: {
      show: '/mode',
      set: '/mode <chat|assistant|builder|operator>',
      cliStatus: 'npm run mode:status',
      cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
    },
  };
}

export function listZavorthProductModeSnapshots(
  runtimeProfile: string | null | undefined,
): ZavorthProductModeSnapshot[] {
  return PRODUCT_MODE_ORDER.map((mode) => buildZavorthProductModeSnapshot(mode, runtimeProfile));
}
