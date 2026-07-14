import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';export type SecurityOperationalPresetId = 'personal' | 'professional' | 'enterprise';
export type PresetSecurityProfileId = 'personal' | 'professional' | 'enterprise';
export type PresetMcpProfile = 'safe' | 'trusted' | 'dangerous';
export type PresetSkillAllowMode = 'all' | 'explicit' | 'review' | 'none';
export type PresetSkillTrustPolicyDefault = 'allow' | 'deny';

export type SecurityOperationalPresetDefinition = {
  id: SecurityOperationalPresetId;
  aliases: string[];
  label: string;
  audience: string;
  summary: string;
  securityProfile: PresetSecurityProfileId;
  mcpPolicy: {
    profile: PresetMcpProfile;
    allowlist: string[];
  };
  skillPolicy: {
    defaultPolicy: PresetSkillTrustPolicyDefault;
    allowedSourceIds: string[];
    rules: Array<{
      sourceId: string;
      mode: PresetSkillAllowMode;
      skillNames?: string[];
      reason: string;
    }>;
  };
  continuousSecurity: {
    strictByDefault: boolean;
    requireBaseline: boolean;
  };
  operatorNotes: string[];
};

export type SecurityOperationalPresetState = {
  version: 1;
  activePreset: SecurityOperationalPresetId;
  appliedAt: string;
  appliedBy: string;
  securityProfile: PresetSecurityProfileId;
  mcpProfile: PresetMcpProfile;
  mcpAllowlist: string[];
  skillDefaultPolicy: PresetSkillTrustPolicyDefault;
  skillAllowedSourceIds: string[];
  continuousSecurity: {
    strictByDefault: boolean;
    requireBaseline: boolean;
  };
  receipt: {
    id: string;
    summary: string;
  };
};

export type SecurityOperationalPresetInspection = {
  status: 'ready' | 'attention';
  state: SecurityOperationalPresetState | null;
  preset: SecurityOperationalPresetDefinition | null;
  presetPath: string;
  summary: string;
  evidence: string[];
  recommendations: string[];
};

export type ApplySecurityOperationalPresetResult = {
  ok: true;
  preset: SecurityOperationalPresetDefinition;
  state: SecurityOperationalPresetState;
  files: {
    presetPath: string;
    mcpPolicyPath: string;
    skillPolicyPath: string;
  };
  summary: string;
};

type PresetRuntime = {
  projectRoot?: string | null;
  now?: () => Date;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
};

const LOCAL_SKILL_RULES = [
  {
    sourceId: 'zavorth-native',
    mode: 'all' as const,
    reason: 'Official Zavorth-owned native intelligence pack.',
  },
  {
    sourceId: 'workspace-agents',
    mode: 'all' as const,
    reason: 'Fonte principal de autoria local.',
  },
  {
    sourceId: 'workspace-library',
    mode: 'all' as const,
    reason: 'Biblioteca local curada e mantida no proprio workspace.',
  },
  {
    sourceId: 'workspace-imported-library',
    mode: 'review' as const,
    reason: 'Imports permanecem em revisao ate promocao explicita para uma fonte nativa ou curada.',
  },
];

const PRESETS: Record<SecurityOperationalPresetId, SecurityOperationalPresetDefinition> = {
  personal: {
    id: 'personal',
    aliases: ['home', 'casa', 'pessoal', 'dona-maria', 'dona_maria', 'comum'],
    label: 'Casa / uso pessoal',
    audience: 'Usuario comum em computador proprio',
    summary: 'Baixa friccao para tarefas do dia a dia, com bloqueio de MCP perigoso e confirmacao para acoes sensiveis.',
    securityProfile: 'personal',
    mcpPolicy: {
      profile: 'safe',
      allowlist: [],
    },
    skillPolicy: {
      defaultPolicy: 'deny',
      allowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      rules: LOCAL_SKILL_RULES,
    },
    continuousSecurity: {
      strictByDefault: false,
      requireBaseline: false,
    },
    operatorNotes: [
      'Ideal para uso cotidiano sem configurar variaveis de ambiente.',
      'MCP fica em safe; escrita e shell continuam exigindo caminhos supervisionados.',
    ],
  },
  professional: {
    id: 'professional',
    aliases: ['work', 'trabalho', 'dev', 'profissional', 'developer'],
    label: 'Profissional individual',
    audience: 'Desenvolvedor, operador ou power user em maquina propria/de trabalho',
    summary: 'Equilibra produtividade e seguranca: perfil profissional, MCP safe com create_file liberado explicitamente, skills locais e curadas.',
    securityProfile: 'professional',
    mcpPolicy: {
      profile: 'safe',
      allowlist: ['create_file'],
    },
    skillPolicy: {
      defaultPolicy: 'deny',
      allowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      rules: LOCAL_SKILL_RULES,
    },
    continuousSecurity: {
      strictByDefault: false,
      requireBaseline: true,
    },
    operatorNotes: [
      'Preset recomendado para desenvolvimento diario.',
      'MCP create_file e liberado por allowlist, mas ferramentas perigosas seguem bloqueadas.',
    ],
  },
  enterprise: {
    id: 'enterprise',
    aliases: ['corporate', 'corporativo', 'bigtech', 'managed', 'empresa'],
    label: 'Corporativo gerenciado',
    audience: 'Ambiente corporativo, maquina gerenciada ou uso com dados sensiveis',
    summary: 'Mais restritivo: perfil enterprise, MCP safe sem allowlist extra, skills por trust explicito e baseline obrigatoria.',
    securityProfile: 'enterprise',
    mcpPolicy: {
      profile: 'safe',
      allowlist: [],
    },
    skillPolicy: {
      defaultPolicy: 'deny',
      allowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      rules: LOCAL_SKILL_RULES,
    },
    continuousSecurity: {
      strictByDefault: true,
      requireBaseline: true,
    },
    operatorNotes: [
      'Indicado para ambientes com compliance ou dados sensiveis.',
      'Mudancas nos controles centrais devem passar por baseline e CI.',
    ],
  },
};

export function listSecurityOperationalPresets(): SecurityOperationalPresetDefinition[] {
  return Object.values(PRESETS).map(clonePreset);
}

export function normalizeSecurityOperationalPresetId(value: unknown): SecurityOperationalPresetId | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) {
    return null;
  }
  for (const preset of Object.values(PRESETS)) {
    if (preset.id === normalized || preset.aliases.includes(normalized)) {
      return preset.id;
    }
  }
  return null;
}

export function getSecurityOperationalPreset(
  value: unknown,
): SecurityOperationalPresetDefinition | null {
  const id = normalizeSecurityOperationalPresetId(value);
  return id ? clonePreset(PRESETS[id]) : null;
}

export function resolveSecurityOperationalPresetPath(projectRoot = config.projectRoot): string {
  return path.join(projectRoot, 'config', 'security-operational-preset.json');
}

export function readSecurityOperationalPresetState(
  runtime: PresetRuntime = {},
): SecurityOperationalPresetState | null {
  const projectRoot = resolveProjectRoot(runtime.projectRoot);
  const presetPath = resolveSecurityOperationalPresetPath(projectRoot);
  const existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
  const readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  try {
    if (!existsSyncImpl(presetPath)) {
      return null;
    }
    const parsed = JSON.parse(readFileSyncImpl(presetPath, 'utf8')) as Partial<SecurityOperationalPresetState>;
    const activePreset = normalizeSecurityOperationalPresetId(parsed.activePreset);
    if (!activePreset) {
      return null;
    }
    const preset = PRESETS[activePreset];
    return {
      version: 1,
      activePreset,
      appliedAt: typeof parsed.appliedAt === 'string' ? parsed.appliedAt : '',
      appliedBy: typeof parsed.appliedBy === 'string' ? parsed.appliedBy : 'zavorth',
      securityProfile: preset.securityProfile,
      mcpProfile: preset.mcpPolicy.profile,
      mcpAllowlist: [...preset.mcpPolicy.allowlist],
      skillDefaultPolicy: preset.skillPolicy.defaultPolicy,
      skillAllowedSourceIds: [...preset.skillPolicy.allowedSourceIds],
      continuousSecurity: { ...preset.continuousSecurity },
      receipt: {
        id: typeof parsed.receipt?.id === 'string' ? parsed.receipt.id : `preset:${activePreset}`,
        summary: typeof parsed.receipt?.summary === 'string' ? parsed.receipt.summary : preset.summary,
      },
    };
  } catch (error: unknown) {logger.warn('[Security Operational Preset] parsing failed', error); return null; }
}

export function inspectSecurityOperationalPreset(
  runtime: PresetRuntime = {},
): SecurityOperationalPresetInspection {
  const projectRoot = resolveProjectRoot(runtime.projectRoot);
  const presetPath = resolveSecurityOperationalPresetPath(projectRoot);
  const state = readSecurityOperationalPresetState(runtime);
  if (!state) {
    return {
      status: 'attention',
      state: null,
      preset: null,
      presetPath,
      summary: 'Nenhum preset operacional persistente foi aplicado.',
      evidence: [presetPath],
      recommendations: [
        'Rode zavorth security preset professional --apply para o padrao diario recomendado.',
      ],
    };
  }
  const preset = PRESETS[state.activePreset];
  const drift = inspectPresetPolicyDrift(projectRoot, preset, runtime);
  if (drift.length > 0) {
    return {
      status: 'attention',
      state,
      preset: clonePreset(preset),
      presetPath,
      summary: `Preset ativo ${preset.label}, mas os arquivos de politica nao batem com o preset.`,
      evidence: drift,
      recommendations: [
        `Rode zavorth security preset ${preset.id} --apply para restaurar as politicas do preset.`,
      ],
    };
  }
  return {
    status: 'ready',
    state,
    preset: clonePreset(preset),
    presetPath,
    summary: `Preset ativo: ${preset.label}.`,
    evidence: [
      `preset=${state.activePreset}`,
      `profile=${state.securityProfile}`,
      `mcp=${state.mcpProfile}`,
    ],
    recommendations: [],
  };
}

export function applySecurityOperationalPreset(input: {
  preset: unknown;
  projectRoot?: string | null;
  now?: () => Date;
  appliedBy?: string | null;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
}): ApplySecurityOperationalPresetResult {
  const preset = getSecurityOperationalPreset(input.preset);
  if (!preset) {
    throw new Error(`Preset de seguranca desconhecido: ${String(input.preset || 'n/d')}.`);
  }
  const projectRoot = resolveProjectRoot(input.projectRoot);
  const now = input.now || (() => new Date());
  const writeFileSyncImpl = input.writeFileSync || fs.writeFileSync.bind(fs);
  const mkdirSyncImpl = input.mkdirSync || fs.mkdirSync.bind(fs);
  const appliedAt = now().toISOString();
  const presetPath = resolveSecurityOperationalPresetPath(projectRoot);
  const mcpPolicyPath = path.join(projectRoot, 'config', 'mcp-tool-policy.json');
  const skillPolicyPath = path.join(projectRoot, 'config', 'skill-allowlist.json');
  const state: SecurityOperationalPresetState = {
    version: 1,
    activePreset: preset.id,
    appliedAt,
    appliedBy: String(input.appliedBy || 'zavorth-security-preset'),
    securityProfile: preset.securityProfile,
    mcpProfile: preset.mcpPolicy.profile,
    mcpAllowlist: [...preset.mcpPolicy.allowlist],
    skillDefaultPolicy: preset.skillPolicy.defaultPolicy,
    skillAllowedSourceIds: [...preset.skillPolicy.allowedSourceIds],
    continuousSecurity: { ...preset.continuousSecurity },
    receipt: {
      id: buildPresetReceiptId(preset.id, appliedAt),
      summary: `Preset ${preset.id} aplicado com perfil ${preset.securityProfile}, MCP ${preset.mcpPolicy.profile} e skills ${preset.skillPolicy.defaultPolicy}.`,
    },
  };

  mkdirSyncImpl(path.dirname(presetPath), { recursive: true });
  writeFileSyncImpl(presetPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  writeFileSyncImpl(mcpPolicyPath, `${JSON.stringify({
    version: 1,
    updatedAt: appliedAt,
    profile: preset.mcpPolicy.profile,
    allowlist: preset.mcpPolicy.allowlist,
  }, null, 2)}\n`, 'utf8');
  writeFileSyncImpl(skillPolicyPath, `${JSON.stringify({
    version: 1,
    updatedAt: appliedAt,
    defaultPolicy: preset.skillPolicy.defaultPolicy,
    allowedSourceIds: preset.skillPolicy.allowedSourceIds,
    rules: preset.skillPolicy.rules.map((rule) => ({
      sourceId: rule.sourceId,
      mode: rule.mode,
      ...(rule.skillNames ? { skillNames: rule.skillNames } : {}),
      reason: rule.reason,
    })),
  }, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    preset,
    state,
    files: {
      presetPath,
      mcpPolicyPath,
      skillPolicyPath,
    },
    summary: `Preset operacional "${preset.label}" aplicado.`,
  };
}

export function formatSecurityOperationalPresetInspection(
  inspection: SecurityOperationalPresetInspection,
): string {
  const lines = [
    '[zavorth-security] operational presets',
    `[zavorth-security] status: ${inspection.status === 'ready' ? 'pronto' : 'atencao'}`,
    `[zavorth-security] ${inspection.summary}`,
  ];
  if (inspection.preset) {
    lines.push(
      `[zavorth-security] perfil: ${inspection.preset.securityProfile} | MCP: ${inspection.preset.mcpPolicy.profile} | skills: ${inspection.preset.skillPolicy.defaultPolicy}`,
      `[zavorth-security] baseline: ${inspection.preset.continuousSecurity.requireBaseline ? 'obrigatoria' : 'recomendada'}`,
    );
  }
  if (inspection.recommendations.length > 0) {
    lines.push('', 'Proximos passos');
    for (const recommendation of inspection.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function formatSecurityOperationalPresetList(): string {
  const lines = [
    '[zavorth-security] presets operacionais',
    ...listSecurityOperationalPresets().map((preset) =>
      `- ${preset.id}: ${preset.label} | perfil ${preset.securityProfile} | MCP ${preset.mcpPolicy.profile} | ${preset.summary}`,
    ),
    '',
    'Aplicar: zavorth security preset professional --apply',
  ];
  return `${lines.join('\n')}\n`;
}

export function formatApplySecurityOperationalPresetResult(
  result: ApplySecurityOperationalPresetResult,
): string {
  return [
    '[zavorth-security] preset aplicado',
    `[zavorth-security] ${result.summary}`,
    `[zavorth-security] receipt: ${result.state.receipt.id}`,
    `[zavorth-security] perfil: ${result.state.securityProfile} | MCP: ${result.state.mcpProfile} | skills: ${result.state.skillDefaultPolicy}`,
    `[zavorth-security] arquivos: ${result.files.presetPath}; ${result.files.mcpPolicyPath}; ${result.files.skillPolicyPath}`,
  ].join('\n') + '\n';
}

function clonePreset(preset: SecurityOperationalPresetDefinition): SecurityOperationalPresetDefinition {
  return {
    ...preset,
    aliases: [...preset.aliases],
    mcpPolicy: {
      profile: preset.mcpPolicy.profile,
      allowlist: [...preset.mcpPolicy.allowlist],
    },
    skillPolicy: {
      defaultPolicy: preset.skillPolicy.defaultPolicy,
      allowedSourceIds: [...preset.skillPolicy.allowedSourceIds],
      rules: preset.skillPolicy.rules.map((rule) => ({
        ...rule,
        skillNames: rule.skillNames ? [...rule.skillNames] : undefined,
      })),
    },
    continuousSecurity: { ...preset.continuousSecurity },
    operatorNotes: [...preset.operatorNotes],
  };
}

function resolveProjectRoot(projectRoot: string | null | undefined): string {
  return path.resolve(projectRoot || config.projectRoot);
}

function buildPresetReceiptId(presetId: SecurityOperationalPresetId, appliedAt: string): string {
  return `security-preset:${presetId}:${appliedAt.replace(/[^0-9TZ]/g, '')}`;
}

function inspectPresetPolicyDrift(
  projectRoot: string,
  preset: SecurityOperationalPresetDefinition,
  runtime: PresetRuntime,
): string[] {
  const readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  const existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
  const mcpPolicyPath = path.join(projectRoot, 'config', 'mcp-tool-policy.json');
  const skillPolicyPath = path.join(projectRoot, 'config', 'skill-allowlist.json');
  const mcpPolicy = readJsonFile(mcpPolicyPath, existsSyncImpl, readFileSyncImpl);
  const skillPolicy = readJsonFile(skillPolicyPath, existsSyncImpl, readFileSyncImpl);
  const drift: string[] = [];

  if (!mcpPolicy) {
    drift.push(`missing=${mcpPolicyPath}`);
  } else {
    if (mcpPolicy.profile !== preset.mcpPolicy.profile) {
      drift.push(`mcp.profile=${String(mcpPolicy.profile || 'n/d')}`);
    }
    if (!sameStringSet(mcpPolicy.allowlist, preset.mcpPolicy.allowlist)) {
      drift.push('mcp.allowlist drift');
    }
  }

  if (!skillPolicy) {
    drift.push(`missing=${skillPolicyPath}`);
  } else {
    if (skillPolicy.defaultPolicy !== preset.skillPolicy.defaultPolicy) {
      drift.push(`skill.defaultPolicy=${String(skillPolicy.defaultPolicy || 'n/d')}`);
    }
    if (!sameStringSet(skillPolicy.allowedSourceIds, preset.skillPolicy.allowedSourceIds)) {
      drift.push('skill.allowedSourceIds drift');
    }
    if (!sameSkillRules(skillPolicy.rules, preset.skillPolicy.rules)) {
      drift.push('skill.rules drift');
    }
  }

  return drift;
}

function readJsonFile(
  filePath: string,
  existsSyncImpl: typeof fs.existsSync,
  readFileSyncImpl: typeof fs.readFileSync,
): Record<string, any> | null {
  try {
    if (!existsSyncImpl(filePath)) {
      return null;
    }
    const parsed = JSON.parse(readFileSyncImpl(filePath, 'utf8') as string);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error: unknown) {logger.warn('[Security Operational Preset] JSON parse failed', error); return null; }
}

function sameStringSet(actual: unknown, expected: string[]): boolean {
  if (!Array.isArray(actual)) {
    return expected.length === 0;
  }
  return JSON.stringify([...new Set(actual.map(String))].sort()) === JSON.stringify([...expected].sort());
}

function sameSkillRules(actual: unknown, expected: SecurityOperationalPresetDefinition['skillPolicy']['rules']): boolean {
  if (!Array.isArray(actual)) {
    return false;
  }
  const normalize = (rules: any[]) => rules.map((rule) => ({
    sourceId: String(rule.sourceId || ''),
    mode: String(rule.mode || ''),
    skillNames: Array.isArray(rule.skillNames) ? [...new Set(rule.skillNames.map(String))].sort() : [],
  })).sort((left, right) =>
    `${left.sourceId}:${left.mode}:${left.skillNames.join(',')}`.localeCompare(`${right.sourceId}:${right.mode}:${right.skillNames.join(',')}`),
  );
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected as any[]));
}
