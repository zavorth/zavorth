import fs from 'node:fs';
import path from 'node:path';
import {
  resolveLearningRuntimePolicy,
  setLearningRuntimeMode,
  type LearningRuntimePolicySnapshot,
} from './ZavorthLearningRuntimePolicy.js';
import { ZavorthAutonomousLearningWriteService } from './ZavorthAutonomousLearningWriteService.js';

export type AnyonePathAreaId = 'learning' | 'first-run' | 'superpowers' | 'reach';

export type AnyonePathOnboardingState = {
  version: 1;
  completed: boolean;
  step: 1 | 2 | 3 | 4;
  language: string | null;
  surface: 'desktop' | 'telegram' | 'web' | 'cli' | null;
  allowLearning: boolean | null;
  completedAt: string | null;
  updatedAt: string;
};

export type AnyoneLearnedItem = {
  id: string;
  kind: 'preference' | 'skill-draft';
  title: string;
  summary: string;
  reversible: boolean;
  createdAt: string;
  humanAction: string;
};

export type AnyoneSuperpower = {
  id: string;
  title: string;
  summary: string;
  howToUse: string;
  trust: 'built-in' | 'learned-draft' | 'optional-install';
};

export type AnyoneReachChannel = {
  id: string;
  title: string;
  status: 'ready-hint' | 'needs-setup' | 'experimental' | 'optional';
  summary: string;
  nextStep: string | null;
};

export type AnyoneAgentPathSnapshot = {
  contractVersion: 'zavorth-anyone-agent-path/1';
  generatedAt: string;
  headline: string;
  promise: string;
  areas: Array<{
    id: AnyonePathAreaId;
    title: string;
    status: 'ready' | 'attention' | 'blocked' | 'pending';
    summary: string;
    humanNext: string | null;
  }>;
  onboarding: AnyonePathOnboardingState;
  learning: {
    policy: LearningRuntimePolicySnapshot;
    learned: AnyoneLearnedItem[];
    digestLines: string[];
  };
  superpowers: AnyoneSuperpower[];
  reach: AnyoneReachChannel[];
  commands: {
    status: string;
    onboard: string;
    digest: string;
    undo: string;
    enableLearning: string;
  };
};

type PathDeps = {
  projectRoot?: string | null;
  now?: () => Date;
  env?: Record<string, string | undefined>;
  userId?: string | null;
};

function normalizeAnyoneUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  const safe = raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120);
  return safe || 'local-user';
}

const DEFAULT_SUPERPOWERS: AnyoneSuperpower[] = [
  {
    id: 'chat-help',
    title: 'Chat and ask for help',
    summary: 'Ask in natural language. The agent answers and, when possible, performs the task.',
    howToUse: 'Open chat and say what you need as you would to a person.',
    trust: 'built-in',
  },
  {
    id: 'remember-prefs',
    title: 'Remember your style',
    summary: 'In personal mode, stores reversible preferences after explicit agreement.',
    howToUse: 'Tell the agent your response style, then run: zavorth anyone digest.',
    trust: 'built-in',
  },
  {
    id: 'learn-routines',
    title: 'Learn routines',
    summary: 'Repeated workflows can become reversible skill drafts for later use.',
    howToUse: 'Ask for the same routine a few times, then review it in the digest and undo if needed.',
    trust: 'learned-draft',
  },
  {
    id: 'safe-files',
    title: 'Handle files safely',
    summary: 'Reads and organizes files. Sensitive changes require explicit confirmation.',
    howToUse: 'Ask the agent to explain or organize a file. Important changes require approval.',
    trust: 'built-in',
  },
  {
    id: 'web-lookup',
    title: 'Search the web',
    summary: 'Searches and summarizes information when a search provider is configured.',
    howToUse: 'Ask for a search topic and the summary shape you want.',
    trust: 'built-in',
  },
  {
    id: 'telegram',
    title: 'Use Telegram',
    summary: 'Stable mobile channel for using the agent from a phone.',
    howToUse: 'Configure the Telegram bot and send a message.',
    trust: 'optional-install',
  },
];

export class ZavorthAnyoneAgentPathService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly userId: string;

  public constructor(deps: PathDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.userId = normalizeAnyoneUserId(deps.userId);
  }

  public get scopedUserId(): string {
    return this.userId;
  }

  public get statePath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'anyone-agent-path.json');
  }

  public buildSnapshot(): AnyoneAgentPathSnapshot {
    const generatedAt = this.now().toISOString();
    const onboarding = this.readOnboarding();
    const policy = resolveLearningRuntimePolicy({
      projectRoot: this.projectRoot,
      env: this.env,
      userId: this.userId,
    });
    const learned = this.listLearnedItems();
    const superpowers = this.listSuperpowers(learned);
    const reach = this.listReach();
    const areas = this.buildAreas(onboarding, policy, learned, reach);

    return {
      contractVersion: 'zavorth-anyone-agent-path/1',
      generatedAt,
      headline: onboarding.completed ? 'Your agent is ready for everyday use and can improve with you.'
        : 'Three setup choices make the agent usable by anyone.',
      promise: 'Learns with you, safely and with undo. Useful in chat, without engineering jargon.',
      areas,
      onboarding,
      learning: {
        policy,
        learned,
        digestLines: this.buildDigestLines(policy, learned),
      },
      superpowers,
      reach,
      commands: {
        status: 'zavorth anyone',
        onboard: 'zavorth anyone onboard',
        digest: 'zavorth anyone digest',
        undo: 'zavorth anyone undo <id>',
        enableLearning: 'zavorth anyone learn-on',
      },
    };
  }

  public onboard(input: {
    language?: string | null;
    surface?: AnyonePathOnboardingState['surface'] | string | null;
    allowLearning?: boolean | null;
    applyPersonalPreset?: boolean;
  } = {}): AnyoneAgentPathSnapshot {
    const { ZavorthFirstRunHumanOnboardingService } = require('./ZavorthFirstRunHumanOnboardingService.js') as typeof import('./ZavorthFirstRunHumanOnboardingService.js');
    const firstRun = new ZavorthFirstRunHumanOnboardingService({
      projectRoot: this.projectRoot,
      now: this.now,
      userId: this.userId,
    });
    firstRun.complete({
      language: clean(input.language) || 'pt',
      surface: (normalizeSurface(input.surface) || 'desktop') as 'desktop' | 'telegram' | 'web' | 'cli',
      allowLearning: input.allowLearning == null ? true : Boolean(input.allowLearning),
      applyPersonalPreset: input.applyPersonalPreset !== false,
    });
    return this.buildSnapshot();
  }

  public enableLearning(enabled = true): AnyoneAgentPathSnapshot {
    setLearningRuntimeMode(enabled ? 'autonomous' : 'governed', {
      projectRoot: this.projectRoot,
      now: this.now,
      userId: this.userId,
    });
    const current = this.readOnboarding();
    this.writeOnboarding({
      ...current,
      allowLearning: enabled,
      updatedAt: this.now().toISOString(),
    });
    return this.buildSnapshot();
  }

  public undoLearned(id: string, userId?: string | null): { ok: boolean; summary: string; snapshot: AnyoneAgentPathSnapshot } {
    const { ZavorthLearningRuntimeHubService } = require('./ZavorthLearningRuntimeHubService.js') as typeof import('./ZavorthLearningRuntimeHubService.js');
    const result = new ZavorthLearningRuntimeHubService({
      projectRoot: this.projectRoot,
      now: this.now,
      userId: userId != null ? userId : this.userId,
    }).undo(id);
    return { ...result, snapshot: this.buildSnapshot() };
  }

  private buildAreas(
    onboarding: AnyonePathOnboardingState,
    policy: LearningRuntimePolicySnapshot,
    learned: AnyoneLearnedItem[],
    reach: AnyoneReachChannel[],
  ): AnyoneAgentPathSnapshot['areas'] {
    const learningStatus = policy.mode === 'autonomous' || learned.length > 0 ? 'ready' : onboarding.allowLearning === false ? 'attention' : 'pending';
    const firstRunStatus = onboarding.completed ? 'ready' : 'pending';
    const superpowersStatus = 'ready';
    const stableReach = reach.filter((entry) => entry.status === 'ready-hint' || entry.status === 'needs-setup');
    const reachStatus = stableReach.some((entry) => entry.status === 'ready-hint') ? 'ready' : 'attention';

    return [
      {
        id: 'learning',
        title: 'Learns with me',
        status: learningStatus,
        summary: policy.mode === 'autonomous'
          ? `Learning is active. ${learned.length} reversible item(s) stored.`
          : 'Learning is in governed review mode. Enable personal mode to learn from receipts.',
        humanNext: policy.mode === 'autonomous' ? 'zavorth anyone digest' : 'zavorth anyone learn-on',
      },
      {
        id: 'first-run',
        title: 'Anyone can open and use it',
        status: firstRunStatus,
        summary: onboarding.completed ? `Onboarding complete (language=${onboarding.language}, surface=${onboarding.surface}).`
          : 'Missing setup choices: language, surface, and learning permission.',
        humanNext: onboarding.completed ? null : 'zavorth anyone onboard',
      },
      {
        id: 'superpowers',
        title: 'Everyday capabilities',
        status: superpowersStatus,
        summary: `${DEFAULT_SUPERPOWERS.length} clear capabilities plus learned drafts.`,
        humanNext: 'zavorth anyone powers',
      },
      {
        id: 'reach',
        title: 'Where to find me',
        status: reachStatus,
        summary: 'Telegram and WhatsApp Cloud are stable paths. Baileys remains experimental.',
        humanNext: 'zavorth anyone reach',
      },
    ];
  }

  private listLearnedItems(): AnyoneLearnedItem[] {
    const writer = new ZavorthAutonomousLearningWriteService({
      projectRoot: this.projectRoot,
      userId: this.userId,
    });
    const prefs = writer.listTrustedPreferences().map((entry) => ({
      id: entry.id,
      kind: 'preference' as const,
      title: 'Preference',
      summary: entry.summary,
      reversible: true,
      createdAt: entry.createdAt,
      humanAction: `zavorth anyone undo ${entry.id}`,
    }));

    const drafts: AnyoneLearnedItem[] = [];
    const draftRoot = writer.skillDraftRoot;
    if (fs.existsSync(draftRoot)) {
      for (const name of fs.readdirSync(draftRoot)) {
        const full = path.join(draftRoot, name);
        try {
          if (!fs.statSync(full).isDirectory()) continue;
          const metaPath = path.join(full, 'draft.meta.json');
          const meta = fs.existsSync(metaPath)
            ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { title?: string; createdAt?: string; candidateId?: string }
            : {};
          drafts.push({
            id: meta.candidateId || name,
            kind: 'skill-draft',
            title: meta.title || name,
            summary: 'Learned routine draft, not installed as a final skill yet.',
            reversible: true,
            createdAt: meta.createdAt || '',
            humanAction: `zavorth anyone undo ${meta.candidateId || name}`,
          });
        } catch {
          // skip broken draft dirs
        }
      }
    }
    return [...prefs, ...drafts].slice(0, 50);
  }

  private listSuperpowers(_learned: AnyoneLearnedItem[]): AnyoneSuperpower[] {
    try {
      const { ZavorthHumanSuperpowersService } = require('./ZavorthHumanSuperpowersService.js') as typeof import('./ZavorthHumanSuperpowersService.js');
      return new ZavorthHumanSuperpowersService({ projectRoot: this.projectRoot }).listPowers().map((power) => ({
        id: power.id,
        title: power.title,
        summary: power.summary,
        howToUse: power.howToAsk,
        trust: power.trust === 'learned'
          ? 'learned-draft'
          : power.trust === 'needs-setup'
            ? 'optional-install'
            : 'built-in',
      }));
    } catch {
      return DEFAULT_SUPERPOWERS.slice();
    }
  }

  private listReach(): AnyoneReachChannel[] {
    try {
      const { ZavorthHumanReachService } = require('./ZavorthHumanReachService.js') as typeof import('./ZavorthHumanReachService.js');
      return new ZavorthHumanReachService({ projectRoot: this.projectRoot, env: this.env }).listPaths().map((pathItem) => ({
        id: pathItem.id,
        title: pathItem.title,
        status: pathItem.ready ? 'ready-hint' as const
          : pathItem.status === 'experimental'
            ? 'experimental' as const
            : pathItem.status === 'optional'
              ? 'optional' as const
              : 'needs-setup' as const,
        summary: pathItem.summary,
        nextStep: pathItem.nextStep,
      }));
    } catch {
      return [{
        id: 'desktop',
        title: 'App / Desktop',
        status: 'ready-hint',
        summary: 'Best local desktop path.',
        nextStep: 'zavorth open',
      }];
    }
  }

  private buildDigestLines(policy: LearningRuntimePolicySnapshot, learned: AnyoneLearnedItem[]): string[] {
    const lines = [
      `Learning mode: ${policy.mode === 'autonomous' ? 'active from receipts' : 'reviewed and not writing alone'}`,
    ];
    if (!learned.length) {
      lines.push('No preferences or routines are stored yet. Keep using the agent normally; active learning can record what works.');
      return lines;
    }
    lines.push(`Learned items: ${learned.length}`);
    for (const item of learned.slice(0, 12)) {
      lines.push(`- [${item.kind}] ${item.id}: ${item.summary}`);
    }
    lines.push('Undo with: zavorth anyone undo <id>');
    return lines;
  }

  private readOnboarding(): AnyonePathOnboardingState {
    const fallback: AnyonePathOnboardingState = {
      version: 1,
      completed: false,
      step: 1,
      language: null,
      surface: null,
      allowLearning: null,
      completedAt: null,
      updatedAt: this.now().toISOString(),
    };
    try {
      if (!fs.existsSync(this.statePath)) return fallback;
      const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as Partial<AnyonePathOnboardingState>;
      if (!parsed || parsed.version !== 1) return fallback;
      return {
        version: 1,
        completed: Boolean(parsed.completed),
        step: (parsed.step === 2 || parsed.step === 3 || parsed.step === 4) ? parsed.step : 1,
        language: parsed.language || null,
        surface: normalizeSurface(parsed.surface),
        allowLearning: typeof parsed.allowLearning === 'boolean' ? parsed.allowLearning : null,
        completedAt: parsed.completedAt || null,
        updatedAt: parsed.updatedAt || this.now().toISOString(),
      };
    } catch {
      return fallback;
    }
  }

  private writeOnboarding(state: AnyonePathOnboardingState): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    const temp = `${this.statePath}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, this.statePath);
  }
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function normalizeSurface(value: unknown): AnyonePathOnboardingState['surface'] {
  const key = clean(value).toLowerCase();
  if (key === 'desktop' || key === 'app' || key === 'casa') return 'desktop';
  if (key === 'telegram' || key === 'tg') return 'telegram';
  if (key === 'web' || key === 'browser') return 'web';
  if (key === 'cli' || key === 'terminal') return 'cli';
  return null;
}
