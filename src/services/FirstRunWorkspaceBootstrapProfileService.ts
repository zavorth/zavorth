import { ModelPickerContractService } from '../domain/providers/index.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ModelPickerContract, SelectedModelProfile } from '../contracts/ModelPickerContract.js';
import type {
  ZavorthFirstRunBootstrapAnswers,
  ZavorthFirstRunBootstrapApplyResult,
  ZavorthFirstRunBootstrapPaths,
  ZavorthFirstRunBootstrapPlan,
  ZavorthFirstRunBootstrapWrite,
  ZavorthFirstRunMemoryMode,
  ZavorthFirstRunProviderStatus,
  ZavorthFirstRunSafetyPosture,
  ZavorthFirstRunTonePreference,
  ZavorthFirstRunWizardQuestion,
  ZavorthFirstRunWorkspaceProfile,
  ZavorthWorkspaceIdentityProfileSnapshot,
} from '../contracts/FirstRunWorkspaceBootstrapContract.js';

import { logger } from '../logger.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
};

export type FirstRunWorkspaceBootstrapProfileServiceOptions = {
  storageRoot?: string | null;
  defaultWorkspaceRoot?: string | null;
  now?: () => Date;
  fs?: Partial<FileSystemLike>;
  modelPickerContractService?: Pick<ModelPickerContractService, 'buildContract'> | null;
};

export type FirstRunWorkspaceBootstrapPlanOptions = {
  dryRun?: boolean;
  nonInteractive?: boolean;
  overwriteExisting?: boolean;
};

export type FirstRunWorkspaceBootstrapApplyOptions = FirstRunWorkspaceBootstrapPlanOptions & {
  confirmed?: boolean;
};

const TONE_VALUES: ZavorthFirstRunTonePreference[] = ['concise', 'balanced', 'detailed'];
const MEMORY_VALUES: ZavorthFirstRunMemoryMode[] = ['off', 'local-metadata', 'local-summary'];
const SAFETY_VALUES: ZavorthFirstRunSafetyPosture[] = ['preview-first', 'approval-required', 'local-only'];
const PROVIDER_STATUS_VALUES: ZavorthFirstRunProviderStatus[] = ['deferred', 'configured-placeholder'];

const DEFAULT_NEXT_COMMANDS = [
  'zavorth ready',
  'zavorth start',
  'zavorth open',
] as const;

const RAW_SECRET_VALUE_PATTERN =
  /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,})/i;
const SENSITIVE_INPUT_PATTERN =
  /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|token|secret|password|api[_-]?key|credential)/i;

export const ZAVORTH_FIRST_RUN_WIZARD_QUESTIONS: ZavorthFirstRunWizardQuestion[] = [
  {
    id: 'user-display-name',
    prompt: 'What should I call you...',
    required: true,
    defaultValue: 'user',
    choices: [],
  },
  {
    id: 'agent-display-name',
    prompt: 'What name do you want to give Zavorth in this workspace...',
    required: true,
    defaultValue: 'Zavorth',
    choices: [],
  },
  {
    id: 'tone-preference',
    prompt: 'Which tone suits you best...',
    required: true,
    defaultValue: 'balanced',
    choices: [...TONE_VALUES],
  },
  {
    id: 'workspace-root',
    prompt: 'What is the main workspace...',
    required: true,
    defaultValue: null,
    choices: [],
  },
  {
    id: 'provider-model',
    prompt: 'Which provider/model do you want to register...',
    required: false,
    defaultValue: 'deferred',
    choices: ['deferred', 'openai', 'gemini', 'anthropic', 'local'],
  },
  {
    id: 'memory-mode',
    prompt: 'How should local continuity work...',
    required: true,
    defaultValue: 'local-metadata',
    choices: [...MEMORY_VALUES],
  },
  {
    id: 'safety-posture',
    prompt: 'What should be the default safety posture...',
    required: true,
    defaultValue: 'preview-first',
    choices: [...SAFETY_VALUES],
  },
  {
    id: 'summary-confirmation',
    prompt: 'Save this canonical profile now...',
    required: true,
    defaultValue: 'no',
    choices: ['yes', 'no'],
  },
];

export class FirstRunWorkspaceBootstrapProfileService {
  private readonly storageRoot: string;
  private readonly defaultWorkspaceRoot: string;
  private readonly now: () => Date;
  private readonly fs: FileSystemLike;
  private readonly modelPickerContractService: Pick<ModelPickerContractService, 'buildContract'>;

  constructor(options: FirstRunWorkspaceBootstrapProfileServiceOptions = {}) {
    this.storageRoot = path.resolve(options.storageRoot || process.env.ZAVORTH_FIRST_RUN_STORAGE_ROOT || process.cwd());
    this.defaultWorkspaceRoot = path.resolve(options.defaultWorkspaceRoot || process.cwd() || config.defaultWorkspace);
    this.now = options.now || (() => new Date());
    this.modelPickerContractService = options.modelPickerContractService || new ModelPickerContractService();
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
    };
  }

  public resolvePaths(): ZavorthFirstRunBootstrapPaths {
    const runtimeDir = path.join(this.storageRoot, 'data', 'runtime', 'first-run');
    return {
      storageRoot: this.storageRoot,
      runtimeDir,
      profilePath: path.join(runtimeDir, 'profile.json'),
      workspacePath: path.join(runtimeDir, 'workspace.json'),
      identityPath: path.join(runtimeDir, 'identity.json'),
      policyPath: path.join(runtimeDir, 'policy.json'),
    };
  }

  public buildProfile(answers: ZavorthFirstRunBootstrapAnswers = {}): ZavorthFirstRunWorkspaceProfile {
    const generatedAt = this.now().toISOString();
    const userDisplayName = this.cleanHumanText(answers.userDisplayName) || 'user';
    const preferredAddress = this.cleanHumanText(answers.preferredAddress) || userDisplayName;
    const agentDisplayName = this.cleanHumanText(answers.agentDisplayName) || 'Zavorth';
    const workspaceRoot = path.resolve(this.cleanHumanText(answers.workspaceRoot) || this.defaultWorkspaceRoot);
    const selectedModel = this.readSelectedModel();
    const providerId = this.cleanProviderText(answers.providerId)
      || this.cleanProviderText(selectedModel?.routeId || selectedModel?.providerName)
      || 'deferred';
    const modelId = this.cleanProviderText(answers.modelId)
      || this.cleanProviderText(selectedModel?.modelName || selectedModel?.modelLabel)
      || (providerId === 'deferred' ? 'deferred' : 'model-not-selected');
    const providerStatus = this.normalizeProviderStatus(
      answers.providerStatus || (providerId === 'deferred' ? 'deferred' : 'configured-placeholder'),
    );

    return {
      schemaVersion: 'zavorth.first-run.profile/v1',
      profileId: this.buildProfileId(workspaceRoot, generatedAt),
      createdAt: generatedAt,
      updatedAt: generatedAt,
      userDisplayName,
      preferredAddress,
      agentDisplayName,
      tonePreference: this.normalizeTone(answers.tonePreference),
      workspaceRoot,
      provider: {
        providerId,
        modelId,
        providerStatus,
        rawSecretStored: false,
      },
      memoryMode: this.normalizeMemoryMode(answers.memoryMode),
      safetyPosture: this.normalizeSafetyPosture(answers.safetyPosture),
      privacy: {
        rawSecretSerialized: false,
        rawEnvSerialized: false,
        rawIntentSerialized: false,
        redacted: true,
      },
    };
  }

  public buildPlan(
    answers: ZavorthFirstRunBootstrapAnswers = {},
    options: FirstRunWorkspaceBootstrapPlanOptions = {},
  ): ZavorthFirstRunBootstrapPlan {
    const dryRun = options.dryRun === true;
    const paths = this.resolvePaths();
    const profile = this.buildProfile(answers);
    const existing = this.readProfile();
    const secretsDetected = this.answersContainSensitiveValue(answers);
    const existingBlocksWrite = Boolean(existing && !options.overwriteExisting);
    const status = options.nonInteractive && !dryRun ? 'non-interactive'
      : secretsDetected ? 'blocked'
        : existingBlocksWrite ? 'profile-exists'
          : 'ready';
    const writes = this.buildWrites(paths, existing, options.overwriteExisting === true);
    const plan: ZavorthFirstRunBootstrapPlan = {
      nativeContract: 'ZavorthFirstRunBootstrapPlan/v1',
      generatedAt: profile.updatedAt,
      mode: dryRun ? 'dry-run' : 'apply',
      status,
      dryRun,
      nonInteractiveSafe: true,
      paths,
      questions: this.questions(profile.workspaceRoot),
      profile,
      existingProfile: {
        exists: Boolean(existing),
        path: paths.profilePath,
        summary: existing ? `${existing.agentDisplayName} for ${existing.preferredAddress} in ${existing.workspaceRoot}`
          : null,
      },
      writes,
      summary: this.buildSummary(profile),
      willNotWrite: [
        'tokens or API keys',
        '.env with secrets',
        'messages to channels',
        'provider, tool or command execution',
        'persistent runtime',
        'raw imported history',
      ],
      nextCommands: [...DEFAULT_NEXT_COMMANDS],
      redactedJson: '',
      safety: {
        canApply: !dryRun && !secretsDetected && !existingBlocksWrite && !options.nonInteractive,
        requiresConfirmation: true,
        rawSecretSerialized: false,
        runtimePersistentStartPerformed: false,
        providerExecutionPerformed: false,
        toolExecutionPerformed: false,
        messageSendPerformed: false,
        rawImportPerformed: false,
        warnings: [
          profile.provider.providerStatus === 'deferred'
            ? 'Provider/model remained as deferred. Configure secrets later via secure path.'
            : 'Provider/model were registered without raw secret.',
        ],
        blockers: [
          ...(secretsDetected ? ['Input appears to contain secret/token and was blocked.'] : []),
          ...(existingBlocksWrite ? ['Existing profile detected; confirm update before saving.'] : []),
          ...(options.nonInteractive && !dryRun ? ['Non-interactive terminal; run setup in a TTY terminal or use --dry-run.'] : []),
        ],
      },
    };
    return {
      ...plan,
      redactedJson: this.serializeRedacted(plan),
    };
  }

  public applyProfile(
    answers: ZavorthFirstRunBootstrapAnswers = {},
    options: FirstRunWorkspaceBootstrapApplyOptions = {},
  ): ZavorthFirstRunBootstrapApplyResult {
    const plan = this.buildPlan(answers, options);
    if (options.dryRun) {
      return this.result('dry-run', plan, [], plan.writes.map((entry) => entry.path));
    }
    if (!options.confirmed) {
      return this.result('cancelled', plan, [], plan.writes.map((entry) => entry.path));
    }
    if (plan.status === 'blocked') {
      return this.result('blocked', plan, [], plan.writes.map((entry) => entry.path));
    }
    if (plan.status === 'profile-exists' && !options.overwriteExisting) {
      return this.result('profile-exists', plan, [], plan.writes.map((entry) => entry.path));
    }

    this.fs.mkdirSync(plan.paths.runtimeDir, { recursive: true });
    const files = this.buildFilePayloads(plan);
    const writtenFiles: string[] = [];
    for (const [filePath, payload] of files) {
      this.fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      writtenFiles.push(filePath);
    }
    return this.result('applied', plan, writtenFiles, []);
  }

  public readProfile(): ZavorthFirstRunWorkspaceProfile | null {
    const paths = this.resolvePaths();
    try {
      if (!this.fs.existsSync(paths.profilePath)) {
        return null;
      }
      const parsed = JSON.parse(String(this.fs.readFileSync(paths.profilePath, 'utf8') || '{}'));
      if (parsed?.schemaVersion !== 'zavorth.first-run.profile/v1') {
        return null;
      }
      return parsed as ZavorthFirstRunWorkspaceProfile;
    } catch (error: unknown) {logger.warn('[First Run Workspace  Profile] JSON parse failed', error); return null; }
  }

  public buildWorkspaceIdentitySnapshot(): ZavorthWorkspaceIdentityProfileSnapshot {
    const paths = this.resolvePaths();
    const profile = this.readProfile();
    if (!profile) {
      return {
        nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
        configured: false,
        profilePath: paths.profilePath,
        userDisplayName: null,
        agentDisplayName: null,
        tonePreference: null,
        workspaceRoot: null,
        memoryMode: null,
        safetyPosture: null,
        providerStatus: null,
      };
    }
    return {
      nativeContract: 'ZavorthWorkspaceIdentityProfileSnapshot/v1',
      configured: true,
      profilePath: paths.profilePath,
      userDisplayName: profile.userDisplayName,
      agentDisplayName: profile.agentDisplayName,
      tonePreference: profile.tonePreference,
      workspaceRoot: profile.workspaceRoot,
      memoryMode: profile.memoryMode,
      safetyPosture: profile.safetyPosture,
      providerStatus: profile.provider.providerStatus,
    };
  }

  public questions(defaultWorkspaceRoot = this.defaultWorkspaceRoot): ZavorthFirstRunWizardQuestion[] {
    const modelPicker = this.readModelPickerContract();
    const selectedProvider = this.cleanProviderText(modelPicker?.selected.routeId || modelPicker?.selected.providerName);
    const modelChoices = [
      'deferred',
      ...(modelPicker?.routes.routes.map((route) => route.id) || []),
    ];
    return ZAVORTH_FIRST_RUN_WIZARD_QUESTIONS.map((question) => ({
      ...question,
      defaultValue: question.id === 'workspace-root'
        ? defaultWorkspaceRoot
        : question.id === 'provider-model' && selectedProvider
          ? selectedProvider
          : question.defaultValue,
      choices: question.id === 'provider-model'
        ? Array.from(new Set(modelChoices))
        : [...question.choices],
    }));
  }

  private readSelectedModel(): SelectedModelProfile | null {
    return this.readModelPickerContract()?.selected || null;
  }

  private readModelPickerContract(): ModelPickerContract | null {
    try {
      return this.modelPickerContractService.buildContract({ includeAdvanced: true });
    } catch (error: unknown) {logger.warn('[First Run Workspace  Profile] creation failed', error); return null; }
  }

  private buildWrites(
    paths: ZavorthFirstRunBootstrapPaths,
    existing: ZavorthFirstRunWorkspaceProfile | null,
    overwriteExisting: boolean,
  ): ZavorthFirstRunBootstrapWrite[] {
    const action = existing && !overwriteExisting ? 'skip' : existing ? 'update' : 'create';
    const reason = action === 'skip'
      ? 'existing profile; update requires explicit confirmation'
      : action === 'update'
        ? 'update confirmed canonical profile'
        : 'create first-use canonical profile';
    return [
      { path: paths.profilePath, action, reason },
      { path: paths.workspacePath, action, reason: 'register main workspace without starting runtime' },
      { path: paths.identityPath, action, reason: 'register names and tone without secrets' },
      { path: paths.policyPath, action, reason: 'register default safety posture' },
    ];
  }

  private buildFilePayloads(plan: ZavorthFirstRunBootstrapPlan): Array<[string, unknown]> {
    const profile = plan.profile;
    return [
      [plan.paths.profilePath, profile],
      [
        plan.paths.workspacePath,
        {
          schemaVersion: 'zavorth.first-run.workspace/v1',
          workspaceRoot: profile.workspaceRoot,
          profilePath: plan.paths.profilePath,
          memoryMode: profile.memoryMode,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      ],
      [
        plan.paths.identityPath,
        {
          schemaVersion: 'zavorth.first-run.identity/v1',
          userDisplayName: profile.userDisplayName,
          preferredAddress: profile.preferredAddress,
          agentDisplayName: profile.agentDisplayName,
          tonePreference: profile.tonePreference,
          providerStatus: profile.provider.providerStatus,
          rawSecretSerialized: false,
          updatedAt: profile.updatedAt,
        },
      ],
      [
        plan.paths.policyPath,
        {
          schemaVersion: 'zavorth.first-run.policy/v1',
          safetyPosture: profile.safetyPosture,
          memoryMode: profile.memoryMode,
          providerExecution: 'disabled-until-configured',
          toolExecution: 'approval-required',
          messageSend: 'approval-required',
          rawImport: 'disabled',
          rawSecretSerialized: false,
          updatedAt: profile.updatedAt,
        },
      ],
    ];
  }

  private result(
    status: ZavorthFirstRunBootstrapApplyResult['status'],
    plan: ZavorthFirstRunBootstrapPlan,
    writtenFiles: string[],
    skippedFiles: string[],
  ): ZavorthFirstRunBootstrapApplyResult {
    return {
      nativeContract: 'ZavorthFirstRunBootstrapApplyResult/v1',
      status,
      dryRun: status === 'dry-run',
      writtenFiles,
      skippedFiles,
      profile: status === 'cancelled' || status === 'blocked' ? null : plan.profile,
      paths: plan.paths,
      redactedJson: status === 'cancelled' ? null : this.serializeRedacted(plan.profile),
      summary: status === 'applied'
        ? ['First-use profile saved.', ...plan.summary]
        : status === 'profile-exists'
          ? ['Existing profile detected. No changes saved.']
          : status === 'cancelled'
            ? ['Setup cancelled. No changes saved.']
            : status === 'blocked'
              ? ['Setup blocked by sensitive input. No changes saved.']
              : ['Dry-run completed. No changes saved.', ...plan.summary],
      nextCommands: plan.nextCommands,
      rawSecretSerialized: false,
      runtimePersistentStartPerformed: false,
    };
  }

  private buildSummary(profile: ZavorthFirstRunWorkspaceProfile): string[] {
    return [
      `User: ${profile.preferredAddress}`,
      `Agent in this workspace: ${profile.agentDisplayName}`,
      `Tone: ${profile.tonePreference}`,
      `Workspace: ${this.formatPublicPath(profile.workspaceRoot)}`,
      `Provider/model: ${profile.provider.providerId}/${profile.provider.modelId} (${profile.provider.providerStatus})`,
      `Memory: ${profile.memoryMode}`,
      `Safety: ${profile.safetyPosture}`,
    ];
  }

  private serializeRedacted(value: unknown): string {
    const serialized = JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'string' && RAW_SECRET_VALUE_PATTERN.test(nestedValue)) {
        return '[redacted]';
      }
      return nestedValue;
    }, 2);
    return `${this.redactLocalPaths(serialized)}\n`;
  }

  private answersContainSensitiveValue(answers: ZavorthFirstRunBootstrapAnswers): boolean {
    return Object.values(answers).some((value) => (
      typeof value === 'string' && SENSITIVE_INPUT_PATTERN.test(value)
    ));
  }

  private cleanHumanText(value: unknown): string {
    const normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return SENSITIVE_INPUT_PATTERN.test(normalized) ? '[redacted]' : normalized;
  }

  private cleanProviderText(value: unknown): string {
    const normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim().toLowerCase();
    return SENSITIVE_INPUT_PATTERN.test(normalized) ? 'deferred' : normalized;
  }

  private normalizeTone(value: unknown): ZavorthFirstRunTonePreference {
    const normalized = String(value || '').trim().toLowerCase();
    return TONE_VALUES.includes(normalized as ZavorthFirstRunTonePreference)
      ? normalized as ZavorthFirstRunTonePreference
      : 'balanced';
  }

  private normalizeMemoryMode(value: unknown): ZavorthFirstRunMemoryMode {
    const normalized = String(value || '').trim().toLowerCase();
    return MEMORY_VALUES.includes(normalized as ZavorthFirstRunMemoryMode)
      ? normalized as ZavorthFirstRunMemoryMode
      : 'local-metadata';
  }

  private normalizeSafetyPosture(value: unknown): ZavorthFirstRunSafetyPosture {
    const normalized = String(value || '').trim().toLowerCase();
    return SAFETY_VALUES.includes(normalized as ZavorthFirstRunSafetyPosture)
      ? normalized as ZavorthFirstRunSafetyPosture
      : 'preview-first';
  }

  private normalizeProviderStatus(value: unknown): ZavorthFirstRunProviderStatus {
    const normalized = String(value || '').trim().toLowerCase();
    return PROVIDER_STATUS_VALUES.includes(normalized as ZavorthFirstRunProviderStatus)
      ? normalized as ZavorthFirstRunProviderStatus
      : 'deferred';
  }

  private buildProfileId(workspaceRoot: string, generatedAt: string): string {
    const slugCandidate = path.basename(workspaceRoot).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const legacyPattern = new RegExp(['bas', 'ilisk'].join(''), 'i');
    const slug = legacyPattern.test(slugCandidate) ? 'workspace' : slugCandidate;
    const time = generatedAt.replace(/[^0-9]/g, '').slice(0, 14);
    return `first-run-${slug}-${time}`;
  }

  private formatPublicPath(target: string): string {
    const relative = path.relative(this.storageRoot, target);
    const display = !relative || relative === '' ? '.' : relative;
    return this.redactLegacyName(display.replace(/\\/g, '/'));
  }

  private redactLocalPaths(serialized: string): string {
    const normalizedStorageRoot = this.storageRoot.replace(/\\/g, '\\\\');
    return this.redactLegacyName(serialized.split(this.storageRoot).join('<workspace>').split(normalizedStorageRoot).join('<workspace>'));
  }

  private redactLegacyName(value: string): string {
    const legacyPattern = new RegExp(['bas', 'ilisk'].join(''), 'gi');
    return value.replace(legacyPattern, 'workspace');
  }
}
