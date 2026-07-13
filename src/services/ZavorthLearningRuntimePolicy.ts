import fs from 'node:fs';
import path from 'node:path';
import { resolveSecurityProfile } from '../security/SecurityProfile.js';
import { readSecurityOperationalPresetState } from '../security/SecurityOperationalPreset.js';

export type LearningRuntimeMode = 'governed' | 'autonomous';

export type LearningRuntimePolicySnapshot = {
  contractVersion: 'zavorth-learning-runtime-policy/1';
  mode: LearningRuntimeMode;
  source: 'explicit' | 'environment' | 'operational-preset' | 'security-profile' | 'default';
  securityProfileId: string;
  autoWriteGreenPreferences: boolean;
  autoMaterializeYellowSkillDrafts: boolean;
  autoInstallSkills: boolean;
  canModifySecurityPolicy: false;
  userConsentRequired: boolean;
  summary: string;
};

export type LearningRuntimePolicyInput = {
  projectRoot?: string | null;
  mode?: unknown;
  env?: Record<string, string | undefined>;
  stateFilePath?: string | null;
  userId?: string | null;
};

type PersistedLearningPolicy = {
  mode?: string;
  updatedAt?: string;
};

const MODE_ALIASES: Record<string, LearningRuntimeMode> = {
  autonomous: 'autonomous',
  auto: 'autonomous',
  free: 'autonomous',
  governed: 'governed',
  safe: 'governed',
  review: 'governed',
  candidate: 'governed',
  'candidate-after-success': 'governed',
};

export function normalizeLearningRuntimeMode(value: unknown): LearningRuntimeMode | null {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;
  return MODE_ALIASES[key] || null;
}

export function normalizeLearningPolicyUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  const safe = raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120);
  return safe || 'local-user';
}

/** Host-global legacy path (pre per-user policy). */
export function resolveLearningPolicyHostStatePath(projectRoot?: string | null): string {
  const root = path.resolve(String(projectRoot || process.cwd()));
  return path.join(root, 'data', 'runtime', 'learning', 'runtime-policy.json');
}

export function resolveLearningPolicyStatePath(
  projectRoot?: string | null,
  explicit?: string | null,
  userId?: string | null,
): string {
  if (explicit && String(explicit).trim()) return path.resolve(String(explicit).trim());
  const root = path.resolve(String(projectRoot || process.cwd()));
  const scopedUserId = normalizeLearningPolicyUserId(userId);
  return path.join(
    root,
    'data',
    'runtime',
    'learning',
    'users',
    scopedUserId,
    'runtime-policy.json',
  );
}

export function readLearningRuntimePolicyFile(stateFilePath: string): PersistedLearningPolicy | null {
  try {
    if (!fs.existsSync(stateFilePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(stateFilePath, 'utf8')) as PersistedLearningPolicy;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLearningRuntimePolicyFile(
  stateFilePath: string,
  mode: LearningRuntimeMode,
  now: () => Date = () => new Date(),
): void {
  const dir = path.dirname(stateFilePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload: PersistedLearningPolicy = {
    mode,
    updatedAt: now().toISOString(),
  };
  const temp = `${stateFilePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, stateFilePath);
}

export function resolveLearningRuntimePolicy(
  input: LearningRuntimePolicyInput = {},
): LearningRuntimePolicySnapshot {
  const env = input.env || process.env;
  const stateFilePath = resolveLearningPolicyStatePath(input.projectRoot, input.stateFilePath, input.userId);
  const explicit = normalizeLearningRuntimeMode(input.mode);
  const fromEnv = normalizeLearningRuntimeMode(env.ZAVORTH_LEARNING_MODE);
  const fromUserFile = normalizeLearningRuntimeMode(readLearningRuntimePolicyFile(stateFilePath)?.mode);
  // Fall back to host-global policy when per-user file is missing (migration).
  const hostPath = resolveLearningPolicyHostStatePath(input.projectRoot);
  const fromHostFile = fromUserFile
    ? null
    : normalizeLearningRuntimeMode(readLearningRuntimePolicyFile(hostPath)?.mode);
  const fromFile = fromUserFile || fromHostFile;
  const preset = readSecurityOperationalPresetState({ projectRoot: input.projectRoot || process.cwd() });
  const security = resolveSecurityProfile({
    projectRoot: input.projectRoot || process.cwd(),
    env,
  });

  let mode: LearningRuntimeMode = 'governed';
  let source: LearningRuntimePolicySnapshot['source'] = 'default';

  if (explicit) {
    mode = explicit;
    source = 'explicit';
  } else if (fromEnv) {
    mode = fromEnv;
    source = 'environment';
  } else if (fromFile) {
    mode = fromFile;
    source = 'explicit';
  } else if (preset?.activePreset === 'personal' || security.profile.id === 'personal') {
    mode = 'autonomous';
    source = preset?.activePreset === 'personal' ? 'operational-preset' : 'security-profile';
  } else {
    mode = 'governed';
    source = security.profile.id === 'enterprise' || security.profile.id === 'professional'
      ? 'security-profile'
      : 'default';
  }

  const autonomous = mode === 'autonomous';
  return {
    contractVersion: 'zavorth-learning-runtime-policy/1',
    mode,
    source,
    securityProfileId: security.profile.id,
    autoWriteGreenPreferences: autonomous,
    autoMaterializeYellowSkillDrafts: autonomous,
    autoInstallSkills: false,
    canModifySecurityPolicy: false,
    userConsentRequired: !autonomous,
    summary: autonomous
      ? 'Autonomous learning writes reversible green preferences and yellow skill drafts with receipts; security policy never auto-changes.'
      : 'Governed learning keeps candidates for review; no silent skill or preference install.',
  };
}

export function setLearningRuntimeMode(
  modeInput: unknown,
  options: {
    projectRoot?: string | null;
    stateFilePath?: string | null;
    now?: () => Date;
    userId?: string | null;
  } = {},
): LearningRuntimePolicySnapshot {
  const mode = normalizeLearningRuntimeMode(modeInput);
  if (!mode) {
    throw new Error('Learning mode must be "governed" or "autonomous".');
  }
  const stateFilePath = resolveLearningPolicyStatePath(
    options.projectRoot,
    options.stateFilePath,
    options.userId,
  );
  writeLearningRuntimePolicyFile(stateFilePath, mode, options.now || (() => new Date()));
  return resolveLearningRuntimePolicy({
    projectRoot: options.projectRoot,
    stateFilePath,
    mode,
    userId: options.userId,
  });
}
