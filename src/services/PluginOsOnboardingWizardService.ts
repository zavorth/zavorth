import path from 'node:path';

import {
  PluginOsOnboardingService,
  type PluginOsOnboardingApplyResult,
  type PluginOsOnboardingPlan,
  type PluginOsOnboardingProfile,
} from './PluginOsOnboardingService.js';
import { PluginCuratedMarketplaceService } from './PluginCuratedMarketplaceService.js';

export type PluginOsWizardStepId =
  | 'welcome'
  | 'profile'
  | 'optionals'
  | 'inject'
  | 'review'
  | 'done';

export type PluginOsWizardOptionalChoice = {
  id: string;
  name: string;
  summary: string;
  selected: boolean;
  available: boolean;
  reason?: string;
};

export type PluginOsWizardState = {
  step: PluginOsWizardStepId;
  stepIndex: number;
  steps: PluginOsWizardStepId[];
  profile: string;
  optionalIds: string[];
  injectMode: 'off' | 'compact' | 'standard' | 'full' | 'ab';
  injectSamplePercent: number;
  completed: boolean;
  plan: PluginOsOnboardingPlan | null;
  optionals: PluginOsWizardOptionalChoice[];
  profiles: PluginOsOnboardingProfile[];
  findings: string[];
  formatText(): string;
};

export type PluginOsWizardRuntime = {
  now?: () => Date;
  projectRoot?: string;
  onboarding?: PluginOsOnboardingService;
  curated?: PluginCuratedMarketplaceService;
};

const WIZARD_STEPS: PluginOsWizardStepId[] = [
  'welcome',
  'profile',
  'optionals',
  'inject',
  'review',
  'done',
];

/**
 * Multi-step Plugin OS onboarding wizard (state machine).
 * Desktop/CLI drive steps; apply only on explicit finish.
 */
export class PluginOsOnboardingWizardService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly onboarding: PluginOsOnboardingService;
  private readonly curated: PluginCuratedMarketplaceService;

  constructor(runtime: PluginOsWizardRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.onboarding = runtime.onboarding || new PluginOsOnboardingService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.curated = runtime.curated || new PluginCuratedMarketplaceService({
      projectRoot: this.projectRoot,
    });
  }

  public start(options: {
    root?: string;
    profile?: string;
    optionalIds?: string[];
  } = {}): PluginOsWizardState {
    const root = path.resolve(options.root || this.projectRoot);
    const status = this.onboarding.status(root);
    const profile = options.profile || status.defaultProfile || 'recommended';
    const optionalIds = options.optionalIds || status.optionalSelected || [];
    return this.buildState({
      root,
      step: 'welcome',
      profile,
      optionalIds,
      injectMode: status.injectAgentSurface === false ? 'off' : 'compact',
      injectSamplePercent: 100,
    });
  }

  public next(state: PluginOsWizardState, options: { root?: string } = {}): PluginOsWizardState {
    const idx = Math.min(state.stepIndex + 1, state.steps.length - 1);
    return this.buildState({
      root: options.root || this.projectRoot,
      step: state.steps[idx],
      profile: state.profile,
      optionalIds: state.optionalIds,
      injectMode: state.injectMode,
      injectSamplePercent: state.injectSamplePercent,
    });
  }

  public back(state: PluginOsWizardState, options: { root?: string } = {}): PluginOsWizardState {
    const idx = Math.max(state.stepIndex - 1, 0);
    return this.buildState({
      root: options.root || this.projectRoot,
      step: state.steps[idx],
      profile: state.profile,
      optionalIds: state.optionalIds,
      injectMode: state.injectMode,
      injectSamplePercent: state.injectSamplePercent,
    });
  }

  public setProfile(
    state: PluginOsWizardState,
    profile: string,
    options: { root?: string } = {},
  ): PluginOsWizardState {
    return this.buildState({
      root: options.root || this.projectRoot,
      step: state.step,
      profile,
      optionalIds: state.optionalIds,
      injectMode: state.injectMode,
      injectSamplePercent: state.injectSamplePercent,
    });
  }

  public setOptional(
    state: PluginOsWizardState,
    pluginId: string,
    selected: boolean,
    options: { root?: string } = {},
  ): PluginOsWizardState {
    const id = String(pluginId || '').trim().toLowerCase();
    const set = new Set(state.optionalIds.map((item) => item.toLowerCase()));
    if (selected) set.add(id);
    else set.delete(id);
    return this.buildState({
      root: options.root || this.projectRoot,
      step: state.step,
      profile: state.profile,
      optionalIds: Array.from(set),
      injectMode: state.injectMode,
      injectSamplePercent: state.injectSamplePercent,
    });
  }

  public setInject(
    state: PluginOsWizardState,
    injectMode: PluginOsWizardState['injectMode'],
    injectSamplePercent = 100,
    options: { root?: string } = {},
  ): PluginOsWizardState {
    return this.buildState({
      root: options.root || this.projectRoot,
      step: state.step,
      profile: state.profile,
      optionalIds: state.optionalIds,
      injectMode,
      injectSamplePercent: Math.max(0, Math.min(100, Number(injectSamplePercent) || 0)),
    });
  }

  public apply(
    state: PluginOsWizardState,
    options: { root?: string; approved?: boolean; force?: boolean } = {},
  ): {
    state: PluginOsWizardState;
    result: PluginOsOnboardingApplyResult;
  } {
    const root = path.resolve(options.root || this.projectRoot);
    const result = this.onboarding.apply(state.profile, {
      root,
      optionalIds: state.optionalIds,
      approved: options.approved === true,
      force: options.force === true,
    });

    // Persist inject preferences alongside onboarding state (best-effort).
    try {
      this.persistInjectPrefs(root, state.injectMode, state.injectSamplePercent);
    } catch {
      /* soft */
    }

    const next = this.buildState({
      root,
      step: result.ok ? 'done' : state.step,
      profile: state.profile,
      optionalIds: state.optionalIds,
      injectMode: state.injectMode,
      injectSamplePercent: state.injectSamplePercent,
      extraFindings: result.findings,
    });

    return { state: next, result };
  }

  private buildState(input: {
    root: string;
    step: PluginOsWizardStepId;
    profile: string;
    optionalIds: string[];
    injectMode: PluginOsWizardState['injectMode'];
    injectSamplePercent: number;
    extraFindings?: string[];
  }): PluginOsWizardState {
    const root = path.resolve(input.root);
    const status = this.onboarding.status(root);
    const plan = this.onboarding.plan(input.profile, {
      root,
      optionalIds: input.optionalIds,
    });
    const catalog = this.curated.list({ root });
    const byId = new Map(catalog.entries.map((entry) => [String(entry.id).toLowerCase(), entry]));
    const optionals: PluginOsWizardOptionalChoice[] = (status.optionalIds || []).map((id) => {
      const entry = byId.get(id.toLowerCase());
      const selected = input.optionalIds.map((x) => x.toLowerCase()).includes(id.toLowerCase());
      const available = Boolean(entry) || plan.missing.indexOf(id) < 0;
      return {
        id,
        name: entry?.name || id,
        summary: entry?.summary || 'Optional Plugin OS package (may need credentials).',
        selected,
        available: available || plan.targetIds.includes(id) || plan.missing.includes(id) === false,
        reason: plan.missing.includes(id) ? 'package not found on disk' : undefined,
      };
    });

    const stepIndex = Math.max(0, WIZARD_STEPS.indexOf(input.step));
    const findings = [
      ...plan.findings,
      ...(input.extraFindings || []),
      `step=${input.step}`,
      `inject=${input.injectMode}@${input.injectSamplePercent}%`,
    ];

    return {
      step: input.step,
      stepIndex,
      steps: [...WIZARD_STEPS],
      profile: input.profile,
      optionalIds: [...input.optionalIds],
      injectMode: input.injectMode,
      injectSamplePercent: input.injectSamplePercent,
      completed: input.step === 'done' || status.completed,
      plan,
      optionals,
      profiles: status.profiles,
      findings,
      formatText() {
        const lines = [
          'Plugin OS onboarding wizard',
          `step ${stepIndex + 1}/${WIZARD_STEPS.length}: ${input.step}`,
          `profile=${input.profile}`,
          `optionals=${input.optionalIds.join(', ') || '(none)'}`,
          `inject=${input.injectMode} sample=${input.injectSamplePercent}%`,
          '',
          plan.formatText(),
          '',
          'Optional packages:',
          ...optionals.map((item) => (
            `  [${item.selected ? 'x' : ' '}] ${item.id} — ${item.summary}${item.reason ? ` (${item.reason})` : ''}`
          )),
          '',
          'Profiles:',
          ...status.profiles.map((p) => ` ? ${p.id}: ${p.label}`),
        ];
        return lines.join('\n');
      },
    };
  }

  private persistInjectPrefs(
    root: string,
    injectMode: PluginOsWizardState['injectMode'],
    injectSamplePercent: number,
  ): void {
    const fs = require('node:fs') as typeof import('node:fs');
    const statePath = path.join(root, '.zavorth', 'plugin-os-prompt.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      `${JSON.stringify({
        injectMode,
        injectSamplePercent,
        updatedAt: this.now().toISOString(),
      }, null, 2)}\n`,
      'utf8',
    );
  }
}
