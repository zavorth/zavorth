import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ZavorthMutationPlan } from '../contracts/ZavorthMutationPlaneContract.js';
import type {
  IDECompanionPreset,
  IDECompanionPresetId,
  WorkspaceLoadProfile,
  WorkspaceLoadProfilesState,
  WorkspaceOptimizationApplyResult,
  WorkspaceOptimizationChange,
  WorkspaceOptimizationPreview,
} from '../contracts/WorkspaceOptimizerContract.js';

import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { WorkspaceProfileService } from './WorkspaceProfileService.js';
import { logger } from '../logger.js';

type CompanionWorkspaceOptimizerRuntime = {
  now?: () => Date;
  stateFilePath?: string;
  mutationPlane?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  trustDecision?: Pick<TrustDecisionService, 'evaluate'>;
  workspaceProfileService?: Pick<WorkspaceProfileService, 'getProfile'>;
  mkdir?: typeof fs.promises.mkdir;
  readFile?: typeof fs.promises.readFile;
  writeFile?: typeof fs.promises.writeFile;
  exists?: typeof fs.existsSync;
};

type PreparedOptimization = {
  workspaceRoot: string;
  workspaceName: string;
  settingsFilePath: string;
  preset: IDECompanionPreset;
  profile: WorkspaceLoadProfile;
  currentSettings: Record<string, unknown>;
  proposedSettings: Record<string, unknown>;
  changes: WorkspaceOptimizationChange[];
  changedKeys: string[];
  summary: string;
};

const NOISY_PATH_CANDIDATES = [
  'data/runtime',
  'data/backups',
  'data/agent-bridge',
  'dist',
  'logs',
  'node_modules',
  'coverage',
  '.external-executor',
  'tmp',
];

const WATCH_EXCLUDES = [
  '**/data/runtime/**',
  '**/data/backups/**',
  '**/data/agent-bridge/**',
  '**/dist/**',
  '**/logs/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/.external-executor/**',
  '**/tmp/**',
];

const SEARCH_EXCLUDES = [
  '**/data/runtime/**',
  '**/data/backups/**',
  '**/dist/**',
  '**/logs/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/.external-executor/**',
  '**/tmp/**',
];

export class CompanionWorkspaceOptimizerService {
  private readonly now: () => Date;
  private readonly stateFilePath: string;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly workspaceProfileService: Pick<WorkspaceProfileService, 'getProfile'>;
  private readonly mkdir: typeof fs.promises.mkdir;
  private readonly readFile: typeof fs.promises.readFile;
  private readonly writeFile: typeof fs.promises.writeFile;
  private readonly exists: typeof fs.existsSync;

  constructor(runtime: CompanionWorkspaceOptimizerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath = runtime.stateFilePath || config.workspaceLoadProfilesFile;
    this.mutationPlane = runtime.mutationPlane || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecision || new TrustDecisionService();
    this.workspaceProfileService = runtime.workspaceProfileService || new WorkspaceProfileService();
    this.mkdir = runtime.mkdir || fs.promises.mkdir.bind(fs.promises);
    this.readFile = runtime.readFile || fs.promises.readFile.bind(fs.promises);
    this.writeFile = runtime.writeFile || fs.promises.writeFile.bind(fs.promises);
    this.exists = runtime.exists || fs.existsSync.bind(fs);
  }

  public async buildLoadProfile(input: {
    workspaceHint?: string | null;
  } = {}): Promise<WorkspaceLoadProfile> {
    const prepared = await this.prepareProfile(input.workspaceHint || null);
    await this.updateState(prepared.profile, null, null);
    return prepared.profile;
  }

  public async previewOptimization(input: {
    presetId: IDECompanionPresetId;
    workspaceHint?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<WorkspaceOptimizationPreview> {
    const prepared = await this.prepareOptimization(input.presetId, input.workspaceHint || null);
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const sourceSurface = String(input.sourceSurface || '').trim() || 'shared-surface';
    const mutationPlan = this.mutationPlane.createPlan({
      domain: 'setup',
      actionId: 'workspace-optimize',
      title: `Workspace optimize ${prepared.preset.label}`,
      summary: prepared.summary,
      requestedBy,
      sourceSurface,
      riskLevel: 'low',
      approvalRequired: true,
      approvalReason: prepared.summary,
      resourceImpact: {
        ramMb: 0,
        diskMb: 1,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: [
          'Workspace-local settings only.',
          'Reduces watcher and Git polling for VS Code-derived IDEs.',
        ],
      },
      validationPlan: [
        'workspace inside allowlist',
        'settings preview generated',
        'preset scoped to .vscode/settings.json',
      ],
      rollbackPlan: [
        `Restore ${prepared.settingsFilePath} to the previous state if needed.`,
      ],
      payload: {
        workspaceRoot: prepared.workspaceRoot,
        workspaceName: prepared.workspaceName,
        presetId: prepared.preset.id,
        settingsFilePath: prepared.settingsFilePath,
        proposedSettings: prepared.proposedSettings,
        changedKeys: prepared.changedKeys,
        changes: prepared.changes,
      },
    });
    const trustDecision = await this.evaluatePlanTrust(mutationPlan, {
      requestedBy,
      sourceSurface,
      workspaceRoot: prepared.workspaceRoot,
      presetId: prepared.preset.id,
    });
    await this.updateState(prepared.profile, mutationPlan.id, null);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: prepared.workspaceRoot,
      workspaceName: prepared.workspaceName,
      settingsFilePath: prepared.settingsFilePath,
      preset: prepared.preset,
      profile: prepared.profile,
      changedKeys: prepared.changedKeys,
      changes: prepared.changes,
      summary: prepared.summary,
      mutationPlan: trustDecision.plan,
      trustDecision: trustDecision.decision,
      waitingApproval: trustDecision.decision?.decision === 'requires_approval',
      blocked: trustDecision.decision?.decision === 'blocked',
    };
  }

  public async applyOptimization(input: {
    planId: string;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<WorkspaceOptimizationApplyResult> {
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const sourceSurface = String(input.sourceSurface || '').trim() || 'shared-surface';
    const plan = this.mutationPlane.readPlan(String(input.planId || '').trim());
    if (!plan) {
      throw new Error(`Mutation plan not found: ${String(input.planId || '').trim() || 'n/d'}.`);
    }
    if (plan.domain !== 'setup' || plan.actionId !== 'workspace-optimize') {
      throw new Error(`Mutation plan ${plan.id} does not belong to Workspace Optimizer.`);
    }

    let activePlan = plan;
    let trustDecision: TrustDecision | null = null;
    if (activePlan.approval.required) {
      const trust = await this.evaluatePlanTrust(activePlan, {
        requestedBy,
        sourceSurface,
        workspaceRoot: String(activePlan.payload.workspaceRoot || '').trim(),
        presetId: String(activePlan.payload.presetId || '').trim() as IDECompanionPresetId,
      });
      activePlan = trust.plan;
      trustDecision = trust.decision;
      if (trustDecision?.decision === 'blocked') {
        return this.buildApplyResult(activePlan, trustDecision, false, false);
      }
      if (trustDecision?.decision === 'requires_approval') {
        return this.buildApplyResult(activePlan, trustDecision, false, true);
      }
      if (activePlan.status !== 'approved') {
        activePlan = this.mutationPlane.approvePlan(activePlan.id, {
          permissionId: trustDecision?.permission?.permission_id || activePlan.approval.permissionId,
          approvedBy: requestedBy,
          scope: trustDecision?.recommendedScope || activePlan.approval.defaultScope,
        });
      }
    }

    const workspaceRoot = WorkspaceResolver.validate(String(activePlan.payload.workspaceRoot || '').trim());
    const settingsFilePath = WorkspaceResolver.ensurePathInsideWorkspace(
      workspaceRoot,
      String(activePlan.payload.settingsFilePath || '.vscode/settings.json'),
    );
    const proposedSettings = this.normalizeObject(activePlan.payload.proposedSettings);
    await this.mkdir(path.dirname(settingsFilePath), { recursive: true });
    await this.writeFile(settingsFilePath, `${JSON.stringify(proposedSettings, null, 2)}\n`, 'utf8');
    activePlan = this.mutationPlane.markApplied(
      activePlan.id,
      `Preset ${String(activePlan.payload.presetId || 'workspace')} aplicado ao workspace ${path.basename(workspaceRoot)}.`,
      ['workspace.optimize.apply'],
    );
    const profile = await this.buildLoadProfile({ workspaceHint: workspaceRoot });
    await this.updateState(
      profile,
      activePlan.id,
      String(activePlan.payload.presetId || '').trim() as IDECompanionPresetId,
    );
    return this.buildApplyResult(activePlan, trustDecision, true, false, profile);
  }

  public renderLoadProfile(profile: WorkspaceLoadProfile): string {
    const lines = [
      `Workspace Doctor: ${profile.workspaceName}`,
      '',
      `Pressao: ${profile.pressure}.`,
      profile.summary,
      `Preset recomendado: ${profile.recommendedPresetId}.`,
      `Current settings: ${profile.currentSettingsKeys.length} key(s) in ${profile.currentSettingsPath}.`,
    ];

    if (profile.noisyPaths.length > 0) {
      lines.push('', 'Pastas ruidosas detectadas:');
      for (const noisyPath of profile.noisyPaths.slice(0, 8)) {
        lines.push(`- ${noisyPath}`);
      }
    }

    if (profile.recommendations.length > 0) {
      lines.push('', 'Recomendactions:');
      for (const recommendation of profile.recommendations.slice(0, 6)) {
        lines.push(`- ${recommendation}`);
      }
    }

    return lines.join('\n');
  }

  public renderPreview(preview: WorkspaceOptimizationPreview): string {
    const lines = [
      `Workspace Optimize Preview: ${preview.workspaceName}`,
      '',
      preview.summary,
      `Preset: ${preview.preset.label}.`,
      `Target file: ${preview.settingsFilePath}.`,
      `changes: ${preview.changedKeys.length} chave(s).`,
      `Plan: ${preview.mutationPlan.id}.`,
    ];

    if (preview.changedKeys.length > 0) {
      lines.push('', 'Chaves alteradas:');
      for (const key of preview.changedKeys.slice(0, 10)) {
        lines.push(`- ${key}`);
      }
    }

    if (preview.waitingApproval) {
      lines.push('', 'Status: waiting for approval.');
      if (preview.mutationPlan.approval.permissionId) {
        lines.push(`Permission: ${preview.mutationPlan.approval.permissionId}.`);
      }
      lines.push(`Apply: /workspace optimize ${preview.preset.id} apply ${preview.mutationPlan.id}`);
    } else if (preview.blocked) {
      lines.push('', `Bloqueado: ${preview.trustDecision?.reason || preview.mutationPlan.summary}`);
    } else {
      lines.push('', 'Status: ready to apply.');
      lines.push(`Apply: /workspace optimize ${preview.preset.id} apply ${preview.mutationPlan.id}`);
    }

    return lines.join('\n');
  }

  public renderApplyResult(result: WorkspaceOptimizationApplyResult): string {
    return [
      result.applied ? `Workspace otimizado with ${result.preset.label}.`
        : result.waitingApproval ? `Workspace is waiting for approval to apply ${result.preset.label}.`
          : result.blocked ? `Workspace optimization blocked for ${result.preset.label}.`
            : `Workspace optimization not applied for ${result.preset.label}.`,
      '',
      result.summary,
      `File: ${result.settingsFilePath}.`,
      `changes: ${result.changedKeys.length} chave(s).`,
      `Plan: ${result.mutationPlan.id}.`,
    ].join('\n');
  }

  private async prepareOptimization(
    presetId: IDECompanionPresetId,
    workspaceHint: string | null,
  ): Promise<PreparedOptimization> {
    const profileData = await this.prepareProfile(workspaceHint);
    const preset = this.getPreset(presetId);
    const currentSettings = await this.readSettings(profileData.settingsFilePath);
    const proposedSettings = this.mergeSettings(currentSettings, preset);
    const changes = this.diffSettings(currentSettings, proposedSettings);
    const changedKeys = changes.map((change) => change.key);
    const summary = `Apply preset ${preset.label} in workspace ${profileData.workspaceName} to reduce watcher, Git polling, and noisy search.`;
    return {
      workspaceRoot: profileData.workspaceRoot,
      workspaceName: profileData.workspaceName,
      settingsFilePath: profileData.settingsFilePath,
      preset,
      profile: profileData.profile,
      currentSettings,
      proposedSettings,
      changes,
      changedKeys,
      summary,
    };
  }

  private async prepareProfile(workspaceHint: string | null): Promise<{
    workspaceRoot: string;
    workspaceName: string;
    settingsFilePath: string;
    profile: WorkspaceLoadProfile;
  }> {
    const workspaceRoot = WorkspaceResolver.validate(workspaceHint);
    const workspaceName = path.basename(workspaceRoot);
    const settingsFilePath = WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, '.vscode/settings.json');
    const workspaceProfile = await this.workspaceProfileService.getProfile(workspaceRoot);
    const currentSettings = await this.readSettings(settingsFilePath);
    const noisyPaths = NOISY_PATH_CANDIDATES
      .map((relativePath) => WorkspaceResolver.ensurePathInsideWorkspace(workspaceRoot, relativePath))
      .filter((absolutePath) => this.exists(absolutePath))
      .map((absolutePath) => path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/'));
    const pressure = noisyPaths.length >= 6 ? 'high' : noisyPaths.length >= 3 ? 'moderate' : 'low';
    const recommendedPresetId: IDECompanionPresetId = noisyPaths.some((entry) => entry.startsWith('data/')) ? 'zavorthBridge'
      : 'vscode';
    const profile: WorkspaceLoadProfile = {
      generatedAt: this.now().toISOString(),
      workspaceRoot,
      workspaceName,
      workspaceSlug: this.slugify(workspaceRoot),
      pressure,
      recommendedPresetId,
      noisyPaths,
      watchCandidates: [...WATCH_EXCLUDES],
      searchCandidates: [...SEARCH_EXCLUDES],
      currentSettingsPath: settingsFilePath,
      currentSettingsKeys: Object.keys(currentSettings).sort(),
      instructionSources: workspaceProfile?.instruction_sources || [],
      skillDirectories: workspaceProfile?.skill_directories || [],
      warnings: noisyPaths.length > 0
        ? [`${noisyPaths.length} path(s) tendem a gerar watcher/git/search desnecessarios.`]
        : [],
      recommendations: [
        `Preset recomendado: ${recommendedPresetId}.`,
        'Use local workspace settings to reduce noise without affecting other folders.',
      ],
      summary: `Workspace ${workspaceName} with ${noisyPaths.length} area(s) ruidosa(s); preset recomendado ${recommendedPresetId}.`,
    };
    return {
      workspaceRoot,
      workspaceName,
      settingsFilePath,
      profile,
    };
  }

  private getPreset(presetId: IDECompanionPresetId): IDECompanionPreset {
    const baseSettings = {
      'git.autoRepositoryDetection': 'openEditors',
      'git.autorefresh': false,
      'git.untrackedChanges': 'hidden',
      'git.decorations.enabled': false,
      'explorer.decorations.badges': false,
      'explorer.decorations.colors': false,
      'scm.diffDecorations': 'none',
      'search.exclude': Object.fromEntries(SEARCH_EXCLUDES.map((entry) => [entry, true])),
      'files.watcherExclude': Object.fromEntries(WATCH_EXCLUDES.map((entry) => [entry, true])),
    } satisfies Record<string, unknown>;

    const presets: Record<IDECompanionPresetId, IDECompanionPreset> = {
      zavorthBridge: {
        id: 'zavorthBridge',
        label: 'ZavorthBridge Lean',
        description: 'Light preset for Zavorth workspaces inside ZavorthBridge.',
        settings: {
          ...baseSettings,
          'typescript.tsserver.watchOptions': {
            watchFile: 'useFsEventsOnParentDirectory',
            watchDirectory: 'useFsEvents',
            fallbackPolling: 'dynamicPriority',
            synchronousWatchDirectory: false,
            excludeDirectories: SEARCH_EXCLUDES.map((entry) => entry.replace(/\/\*\*$/g, '')),
          },
        },
        watchExcludes: [...WATCH_EXCLUDES],
        searchExcludes: [...SEARCH_EXCLUDES],
        notes: [
          'Reduz ruido do Git e do language server no ZavorthBridge.',
          'Keeps the workspace editable, but reduces polling and heavy decorations.',
        ],
      },
      vscode: {
        id: 'vscode',
        label: 'VS Code Lean',
        description: 'Lean preset for VS Code in Zavorth workspaces.',
        settings: {
          ...baseSettings,
        },
        watchExcludes: [...WATCH_EXCLUDES],
        searchExcludes: [...SEARCH_EXCLUDES],
        notes: [
          'Focused on quieter Git/Watcher/Search for the current workspace.',
        ],
      },
      'vscode-derivative': {
        id: 'vscode-derivative',
        label: 'VS Code Derivative Lean',
        description: 'Preset for forks or VS Code-derived IDEs.',
        settings: {
          ...baseSettings,
          'search.followSymlinks': false,
        },
        watchExcludes: [...WATCH_EXCLUDES],
        searchExcludes: [...SEARCH_EXCLUDES],
        notes: [
          'Conservative preset for VS Code forks with varied extensions.',
        ],
      },
    };

    const preset = presets[presetId];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetId || 'n/a'}.`);
    }
    return preset;
  }

  private async evaluatePlanTrust(
    plan: ZavorthMutationPlan,
    input: {
      requestedBy: string;
      sourceSurface: string;
      workspaceRoot: string;
      presetId: IDECompanionPresetId;
    },
  ): Promise<{ plan: ZavorthMutationPlan; decision: TrustDecision | null }> {
    let nextPlan = plan;
    const decision = await this.trustDecision.evaluate({
      domain: 'setup',
      actionId: 'workspace-optimize',
      planId: plan.id,
      requestedBy: input.requestedBy,
      sourceSurface: input.sourceSurface,
      riskLevel: 'low',
      approvalRequired: true,
      reason: plan.summary,
      payload: {
        workspaceRoot: input.workspaceRoot,
        presetId: input.presetId,
      },
      resourceImpact: plan.resourceImpact,
      approvalScope: 'host',
    });

    if (decision.permission) {
      nextPlan = this.mutationPlane.attachApproval(nextPlan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.decision === 'allowed' ? 'approved' : 'pending',
        reason: decision.reason,
      });
    }

    if (decision.decision === 'blocked') {
      nextPlan = this.mutationPlane.markBlocked(nextPlan.id, decision.reason);
    }

    return {
      plan: nextPlan,
      decision,
    };
  }

  private buildApplyResult(
    plan: ZavorthMutationPlan,
    trustDecision: TrustDecision | null,
    applied: boolean,
    waitingApproval: boolean,
    forcedProfile?: WorkspaceLoadProfile,
  ): WorkspaceOptimizationApplyResult {
    const workspaceRoot = WorkspaceResolver.validate(String(plan.payload.workspaceRoot || '').trim());
    const preset = this.getPreset(String(plan.payload.presetId || '').trim() as IDECompanionPresetId);
    forcedProfile
      ? Promise.resolve(forcedProfile)
      : this.buildLoadProfile({ workspaceHint: workspaceRoot });
    return {
      generatedAt: this.now().toISOString(),
      ok: applied,
      applied,
      waitingApproval,
      blocked: trustDecision?.decision === 'blocked',
      summary: trustDecision?.reason || plan.summary,
      workspaceRoot,
      workspaceName: path.basename(workspaceRoot),
      settingsFilePath: String(plan.payload.settingsFilePath || ''),
      preset,
      profile: forcedProfile || ({
        generatedAt: this.now().toISOString(),
        workspaceRoot,
        workspaceName: path.basename(workspaceRoot),
        workspaceSlug: this.slugify(workspaceRoot),
        pressure: 'low',
        recommendedPresetId: preset.id,
        noisyPaths: [],
        watchCandidates: [...WATCH_EXCLUDES],
        searchCandidates: [...SEARCH_EXCLUDES],
        currentSettingsPath: String(plan.payload.settingsFilePath || ''),
        currentSettingsKeys: [],
        instructionSources: [],
        skillDirectories: [],
        warnings: [],
        recommendations: [],
        summary: `Workspace ${path.basename(workspaceRoot)} ready for ${preset.label}.`,
      } as WorkspaceLoadProfile),
      changedKeys: Array.isArray(plan.payload.changedKeys)
        ? plan.payload.changedKeys.map((entry) => String(entry)).filter(Boolean)
        : [],
      mutationPlan: plan,
      trustDecision,
    };
  }

  private async readSettings(settingsFilePath: string): Promise<Record<string, unknown>> {
    if (!this.exists(settingsFilePath)) {
      return {};
    }
    try {
      const parsed = JSON.parse(await this.readFile(settingsFilePath, 'utf8')) as Record<string, unknown>;
      return this.normalizeObject(parsed);
    } catch (error: unknown) {logger.warn('[Companion Workspace Optimizer] JSON parse failed', error); return {}; }
  }

  private mergeSettings(currentSettings: Record<string, unknown>, preset: IDECompanionPreset): Record<string, unknown> {
    const next = this.cloneValue(currentSettings) as Record<string, unknown>;
    for (const [key, value] of Object.entries(preset.settings)) {
      next[key] = this.cloneValue(value);
    }
    return next;
  }

  private diffSettings(
    currentSettings: Record<string, unknown>,
    proposedSettings: Record<string, unknown>,
  ): WorkspaceOptimizationChange[] {
    const keys = Array.from(new Set([
      ...Object.keys(currentSettings || {}),
      ...Object.keys(proposedSettings || {}),
    ])).sort();

    return keys
      .map((key) => ({
        key,
        before: currentSettings[key],
        after: proposedSettings[key],
      }))
      .filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));
  }

  private async updateState(
    profile: WorkspaceLoadProfile,
    previewPlanId: string | null,
    appliedPresetId: IDECompanionPresetId | null,
  ): Promise<void> {
    const state = await this.readState();
    const nextRecord = {
      workspaceRoot: profile.workspaceRoot,
      workspaceName: profile.workspaceName,
      workspaceSlug: profile.workspaceSlug,
      lastProfile: profile,
      lastPreviewPlanId: previewPlanId,
      lastAppliedPresetId: appliedPresetId,
      lastUpdatedAt: this.now().toISOString(),
    };
    const nextWorkspaces = state.workspaces.filter((entry) => entry.workspaceRoot !== profile.workspaceRoot);
    nextWorkspaces.push(nextRecord);
    const nextState: WorkspaceLoadProfilesState = {
      updatedAt: this.now().toISOString(),
      workspaces: nextWorkspaces.sort((a, b) => a.workspaceRoot.localeCompare(b.workspaceRoot)),
    };
    await this.mkdir(path.dirname(this.stateFilePath), { recursive: true });
    await this.writeFile(this.stateFilePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  }

  private async readState(): Promise<WorkspaceLoadProfilesState> {
    if (!this.exists(this.stateFilePath)) {
      return {
        updatedAt: this.now().toISOString(),
        workspaces: [],
      };
    }
    try {
      const parsed = JSON.parse(await this.readFile(this.stateFilePath, 'utf8')) as WorkspaceLoadProfilesState;
      return {
        updatedAt: String(parsed.updatedAt || this.now().toISOString()),
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
      };
    } catch (error: unknown) {logger.warn('[Companion Workspace Optimizer] JSON parse failed', error);
    return {
        updatedAt: this.now().toISOString(),
        workspaces: [],
      };
  }
  }

  private normalizeObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return this.cloneValue(value) as Record<string, unknown>;
  }

  private cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value ?? null)) as T;
  }

  private slugify(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\\/:\s]+/g, '-')
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'workspace';
  }
}
