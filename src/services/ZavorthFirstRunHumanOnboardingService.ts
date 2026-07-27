import fs from 'node:fs';
import path from 'node:path';
import { applySecurityOperationalPreset } from '../security/SecurityOperationalPreset.js';
import { setLearningRuntimeMode } from './ZavorthLearningRuntimePolicy.js';
import { ZavorthLearningRuntimeHubService } from './ZavorthLearningRuntimeHubService.js';

export type FirstRunSurface = 'desktop' | 'telegram' | 'web' | 'cli';

export type FirstRunHumanState = {
  version: 1;
  completed: boolean;
  step: 1 | 2 | 3 | 4;
  language: string | null;
  surface: FirstRunSurface | null;
  allowLearning: boolean | null;
  completedAt: string | null;
  updatedAt: string;
  startedAt: string;
};

export type FirstRunStepView = {
  id: 1 | 2 | 3;
  key: 'language' | 'surface' | 'learning';
  title: string;
  prompt: string;
  examples: string[];
  done: boolean;
  value: string | null;
};

export type FirstRunHumanSnapshot = {
  contractVersion: 'zavorth-first-run-human/1';
  generatedAt: string;
  required: boolean;
  completed: boolean;
  currentStep: 1 | 2 | 3 | 4;
  headline: string;
  summary: string;
  steps: FirstRunStepView[];
  nextPrompt: string | null;
  welcomeLines: string[];
  state: FirstRunHumanState;
};

type ServiceDeps = {
  projectRoot?: string | null;
  now?: () => Date;
  stateFilePath?: string | null;
  userId?: string | null;
};

function normalizeFirstRunUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  const safe = Array.from(raw).map((char) => isSafeUserIdChar(char) ? char : '_').join('').slice(0, 120);
  return safe || 'local-user';
}

export class ZavorthFirstRunHumanOnboardingService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly userId: string;
  private readonly stateFilePath: string;
  private readonly legacyHostStatePath: string;

  public constructor(deps: ServiceDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.now = deps.now || (() => new Date());
    this.userId = normalizeFirstRunUserId(deps.userId);
    this.legacyHostStatePath = path.join(this.projectRoot, 'data', 'runtime', 'first-run-human.json');
    this.stateFilePath = deps.stateFilePath
      ? path.resolve(deps.stateFilePath)
      : path.join(
        this.projectRoot,
        'data',
        'runtime',
        'learning',
        'users',
        this.userId,
        'first-run-human.json',
      );
  }

  public get scopedUserId(): string {
    return this.userId;
  }

  public buildSnapshot(): FirstRunHumanSnapshot {
    const state = this.readState();
    const steps = this.buildSteps(state);
    const currentStep = state.completed ? 4 : state.step <= 3 ? state.step : 1;
    const next = steps.find((step) => !step.done) || null;
    return {
      contractVersion: 'zavorth-first-run-human/1',
      generatedAt: this.now().toISOString(),
      required: !state.completed,
      completed: state.completed,
      currentStep: state.completed ? 4 : currentStep,
      headline: state.completed ? 'Ready. You can use Zavorth normally.'
        : 'Let us set up Zavorth in 3 simple steps.',
      summary: state.completed
        ? `Language ${state.language || 'en'} ? talk via ${state.surface || 'desktop'} ? learning ${state.allowLearning ? 'on' : 'reviewed'}.`
        : 'No jargon: language, where you talk to me, and whether I may learn with you.',
      steps,
      nextPrompt: next?.prompt || null,
      welcomeLines: this.buildWelcomeLines(state, next),
      state,
    };
  }

  public needsOnboarding(): boolean {
    return !this.readState().completed;
  }

  public answer(rawText: string): {
    ok: boolean;
    handled: boolean;
    summary: string;
    snapshot: FirstRunHumanSnapshot;
    completedNow: boolean;
  } {
    const state = this.readState();
    if (state.completed) {
      return {
        ok: true,
        handled: false,
        summary: 'Onboarding already completed.',
        snapshot: this.buildSnapshot(),
        completedNow: false,
      };
    }

    // Prefer applyStep / slash+button paths. answer() remains for structured
    // API payloads, not free-text NLU interception.
    const text = String(rawText || '').trim();
    if (!text) {
      return {
        ok: false,
        handled: true,
        summary: this.buildSnapshot().nextPrompt || 'Use /start buttons or /start skip.',
        snapshot: this.buildSnapshot(),
        completedNow: false,
      };
    }

    if (text === 'skip' || text === 'later') {
      return this.complete({
        language: state.language || 'en',
        surface: state.surface || 'desktop',
        allowLearning: state.allowLearning ?? true,
      });
    }

    if (state.step === 1) {
      const language = normalizeLanguage(text);
      if (!language) {
        return {
          ok: false,
          handled: true,
          summary: 'Which language tag should I use... Send a BCP-47 tag such as lang:en or use /start buttons.',
          snapshot: this.buildSnapshot(),
          completedNow: false,
        };
      }
      this.writeState({
        ...state,
        language,
        step: 2,
        updatedAt: this.now().toISOString(),
      });
      return {
        ok: true,
        handled: true,
        summary: `Language set: ${language}.\n\n${this.buildSnapshot().nextPrompt}`,
        snapshot: this.buildSnapshot(),
        completedNow: false,
      };
    }

    if (state.step === 2) {
      const surface = normalizeSurface(text);
      if (!surface) {
        return {
          ok: false,
          handled: true,
          summary: 'Where will you talk to me... Send surface:desktop, surface:telegram, surface:web, or surface:cli.',
          snapshot: this.buildSnapshot(),
          completedNow: false,
        };
      }
      this.writeState({
        ...state,
        surface,
        step: 3,
        updatedAt: this.now().toISOString(),
      });
      return {
        ok: true,
        handled: true,
        summary: `We will talk via ${surface}.\n\n${this.buildSnapshot().nextPrompt}`,
        snapshot: this.buildSnapshot(),
        completedNow: false,
      };
    }

    if (state.step === 3) {
      const allow = normalizeYesNo(text);
      if (allow === null) {
        return {
          ok: false,
          handled: true,
          summary: 'May I learn with you... Send learning:on or learning:off, or use /start buttons.',
          snapshot: this.buildSnapshot(),
          completedNow: false,
        };
      }
      return this.complete({
        language: state.language || 'en',
        surface: state.surface || 'desktop',
        allowLearning: allow,
      });
    }

    return this.complete({
      language: state.language || 'en',
      surface: state.surface || 'desktop',
      allowLearning: state.allowLearning ?? true,
    });
  }

  public applyStep(input: {
    language?: string | null;
    surface?: string | null;
    allowLearning?: boolean | null;
  }): FirstRunHumanSnapshot {
    const state = this.readState();
    let next = { ...state };
    if (input.language != null) {
      next.language = normalizeLanguage(String(input.language)) || next.language;
      if (next.step === 1) next.step = 2;
    }
    if (input.surface != null) {
      next.surface = normalizeSurface(String(input.surface)) || next.surface;
      if (next.step <= 2) next.step = 3;
    }
    if (input.allowLearning != null) {
      next.allowLearning = Boolean(input.allowLearning);
    }
    next.updatedAt = this.now().toISOString();
    this.writeState(next);

    if (next.language && next.surface && typeof next.allowLearning === 'boolean') {
      return this.complete({
        language: next.language,
        surface: next.surface,
        allowLearning: next.allowLearning,
      }).snapshot;
    }
    return this.buildSnapshot();
  }

  public complete(input: {
    language: string;
    surface: FirstRunSurface;
    allowLearning: boolean;
    applyPersonalPreset?: boolean;
  }): {
    ok: boolean;
    handled: true;
    summary: string;
    snapshot: FirstRunHumanSnapshot;
    completedNow: boolean;
  } {
    const now = this.now().toISOString();
    if (input.applyPersonalPreset !== false) {
      try {
        applySecurityOperationalPreset({
          preset: 'personal',
          projectRoot: this.projectRoot,
          appliedBy: 'first-run-human',
          now: this.now,
        });
      } catch {
      }
    }

    setLearningRuntimeMode(input.allowLearning ? 'autonomous' : 'governed', {
      projectRoot: this.projectRoot,
      now: this.now,
      userId: this.userId,
    });

    const previous = this.readState();
    this.writeState({
      version: 1,
      completed: true,
      step: 4,
      language: input.language,
      surface: input.surface,
      allowLearning: input.allowLearning,
      completedAt: now,
      updatedAt: now,
      startedAt: previous.startedAt || now,
    });

    try {
      const anyonePath = path.join(this.projectRoot, 'data', 'runtime', 'anyone-agent-path.json');
      fs.mkdirSync(path.dirname(anyonePath), { recursive: true });
      fs.writeFileSync(anyonePath, `${JSON.stringify({
        version: 1,
        completed: true,
        step: 4,
        language: input.language,
        surface: input.surface,
        allowLearning: input.allowLearning,
        completedAt: now,
        updatedAt: now,
      }, null, 2)}\n`, 'utf8');
    } catch {
    }

    const snapshot = this.buildSnapshot();
    const learningHint = input.allowLearning ? 'I will remember useful preferences and you can undo anytime.'
      : 'I will not store preferences alone; learning stays in reviewed mode.';
    return {
      ok: true,
      handled: true,
      summary: [
        'Ready.',
        `Language: ${input.language}.`,
        `Where to talk: ${input.surface}.`,
        learningHint,
        'You can ask anything now. Free text goes to the agent; use slash commands for ops.',
      ].join('\n'),
      snapshot,
      completedNow: true,
    };
  }

  public reset(): FirstRunHumanSnapshot {
    const now = this.now().toISOString();
    this.writeState({
      version: 1,
      completed: false,
      step: 1,
      language: null,
      surface: null,
      allowLearning: null,
      completedAt: null,
      updatedAt: now,
      startedAt: now,
    });
    return this.buildSnapshot();
  }

  /**
   * Free-text NLU packs removed; free text goes to the agent.
   * Surfaces use /start + buttons; applyStep for structured API.
   */
  public matchNaturalCommand(_text: string): null | { kind: 'status' | 'restart' | 'skip' } {
    return null;
  }

  private buildSteps(state: FirstRunHumanState): FirstRunStepView[] {
    return [
      {
        id: 1,
        key: 'language',
        title: 'Language',
        prompt: 'Which language tag should I reply in...',
        examples: ['lang:en', 'lang:es', 'lang:pt-BR'],
        done: Boolean(state.language),
        value: state.language,
      },
      {
        id: 2,
        key: 'surface',
        title: 'Where to talk',
        prompt: 'Where will you talk to me most...',
        examples: ['surface:desktop', 'surface:telegram', 'surface:web', 'surface:cli'],
        done: Boolean(state.surface),
        value: state.surface,
      },
      {
        id: 3,
        key: 'learning',
        title: 'Learning',
        prompt: 'May I learn with you and improve over time...',
        examples: ['learning:on', 'learning:off'],
        done: typeof state.allowLearning === 'boolean',
        value: typeof state.allowLearning === 'boolean' ? (state.allowLearning ? 'learning:on' : 'learning:off') : null,
      },
    ];
  }

  private buildWelcomeLines(state: FirstRunHumanState, next: FirstRunStepView | null): string[] {
    if (state.completed) {
      return [
        'Your Zavorth is ready for day-to-day use.',
        'Say what you need. Use slash commands or ask the agent in plain language.',
      ];
    }
    return [
      'Hi - I am Zavorth.',
      'In 3 quick steps I make the agent useful for anyone.',
      next?.prompt || "Let's start.",
    ];
  }

  private readState(): FirstRunHumanState {
    const now = this.now().toISOString();
    const fallback: FirstRunHumanState = {
      version: 1,
      completed: false,
      step: 1,
      language: null,
      surface: null,
      allowLearning: null,
      completedAt: null,
      updatedAt: now,
      startedAt: now,
    };
    try {
      const pathToRead = fs.existsSync(this.stateFilePath)
        ? this.stateFilePath
        // Migrate: only local-user inherits the host-global first-run file.
        : this.userId === 'local-user' && fs.existsSync(this.legacyHostStatePath)
          ? this.legacyHostStatePath
          : null;
      if (!pathToRead) return fallback;
      const parsed = JSON.parse(fs.readFileSync(pathToRead, 'utf8')) as Partial<FirstRunHumanState>;
      if (!parsed || parsed.version !== 1) return fallback;
      const step = parsed.step === 2 || parsed.step === 3 || parsed.step === 4 ? parsed.step : 1;
      return {
        version: 1,
        completed: Boolean(parsed.completed),
        step,
        language: parsed.language || null,
        surface: normalizeSurface(parsed.surface || '') || null,
        allowLearning: typeof parsed.allowLearning === 'boolean' ? parsed.allowLearning : null,
        completedAt: parsed.completedAt || null,
        updatedAt: parsed.updatedAt || now,
        startedAt: parsed.startedAt || now,
      };
    } catch {
      return fallback;
    }
  }

  private writeState(state: FirstRunHumanState): void {
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    const temp = `${this.stateFilePath}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, this.stateFilePath);
  }
}

function normalizeLanguage(raw: string): string | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  const tag = value.startsWith('lang:') ? value.slice('lang:'.length).trim() : value;
  return isBcp47LikeLanguageTag(tag) ? tag.slice(0, 32) : null;
}

function normalizeSurface(raw: string): FirstRunSurface | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  const surface = value.startsWith('surface:') ? value.slice('surface:'.length).trim() : value;
  if (surface === 'desktop' || surface === 'telegram' || surface === 'web' || surface === 'cli') return surface;
  return null;
}

function normalizeYesNo(raw: string): boolean | null {
  const value = String(raw || '').trim().toLowerCase();
  const learning = value.startsWith('learning:') ? value.slice('learning:'.length).trim() : value;
  if (learning === 'on' || learning === 'true') return true;
  if (learning === 'off' || learning === 'false') return false;
  return null;
}

function isSafeUserIdChar(char: string): boolean {
  return (
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '.' ||
    char === '_' ||
    char === '@' ||
    char === '+' ||
    char === '-'
  );
}

function isBcp47LikeLanguageTag(value: string): boolean {
  if (!value || value.length > 32) return false;
  const parts = value.split('-');
  if (parts.length === 0) return false;
  return parts.every((part) => part.length > 0 && Array.from(part).every(isLanguageTagChar));
}

function isLanguageTagChar(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
}

export function createFirstRunLearningNotice(
  projectRoot?: string,
  userId?: string | null,
): string[] {
  try {
    return new ZavorthLearningRuntimeHubService({ projectRoot, userId: userId || null }).formatNoticeLines();
  } catch {
    return [];
  }
}
