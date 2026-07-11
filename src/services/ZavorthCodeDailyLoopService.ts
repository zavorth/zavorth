import { resolveUserProviderSelection } from './UserSelectionResolver.js';
import type { ZavorthDailyProductExperienceSnapshot } from '../contracts/ui/ZavorthDailyProductExperienceContract.js';

/**
 * Maps Zavorth Code (CLI/TUI) open → provider → first ask → review
 * onto the same Daily PE semantics used by Desktop/Control.
 */
export type CodeDailyLoopSnapshot = {
  generatedAt: string;
  version: 'code-daily-loop/v1';
  surface: 'code';
  chatReady: boolean;
  providerReady: boolean;
  providerId: string | null;
  /** Same field names as Daily PE for cross-surface tooling. */
  peAligned: {
    chatReady: boolean;
    happyPathSteps: number;
    nextCommand: string;
  };
  happyPath: {
    steps: Array<{ id: string; label: string; summary: string; done: boolean }>;
    nextCommand: string;
    summary: string;
  };
  /** True only when step order/ids match PE contract (and optional PE snapshot agrees). */
  alignsWithDailyPe: boolean;
  notes: string[];
};

const EXPECTED_STEP_IDS = ['open-code', 'provider-ready', 'first-ask', 'review'] as const;

export class ZavorthCodeDailyLoopService {
  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      now?: () => Date;
    } = {},
  ) {}

  public buildSnapshot(input: {
    dailyPe?: Pick<ZavorthDailyProductExperienceSnapshot, 'chatReady' | 'happyPath'> | null;
    /** Optional proof that the user already sent a first ask in Code. */
    firstAskDone?: boolean;
    /** Optional proof that a review step was completed. */
    reviewDone?: boolean;
  } = {}): CodeDailyLoopSnapshot {
    const selection = resolveUserProviderSelection({
      projectRoot: this.options.projectRoot,
      env: this.options.env,
    });
    const providerReady = Boolean(selection.configured && selection.providerId);
    // Prefer real Daily PE chatReady when provided; otherwise preference-only readiness.
    const chatReady = input.dailyPe?.chatReady ?? providerReady;
    const now = (this.options.now || (() => new Date()))().toISOString();
    const firstAskDone = Boolean(input.firstAskDone) && chatReady;
    const reviewDone = Boolean(input.reviewDone) && chatReady;

    const steps = [
      {
        id: 'open-code',
        label: 'Open Code',
        summary: 'Start the Code CLI/TUI (zavorth or code package entry).',
        done: true,
      },
      {
        id: 'provider-ready',
        label: 'Provider ready',
        summary: providerReady
          ? `Using selected provider ${selection.providerId}.`
          : 'Select a provider (same preference files as Desktop/Control).',
        done: providerReady,
      },
      {
        id: 'first-ask',
        label: 'First ask',
        summary: firstAskDone
          ? 'First coding ask recorded for this Code session.'
          : chatReady
            ? 'Send a useful coding ask in the TUI session (not auto-marked done).'
            : 'Blocked until provider is ready.',
        done: firstAskDone,
      },
      {
        id: 'review',
        label: 'Review',
        summary: reviewDone
          ? 'Review step completed for this Code session.'
          : 'Review diffs/approvals before applying risky edits (not auto-marked done).',
        done: reviewDone,
      },
    ];

    const stepIdsMatch = steps.every((step, index) => step.id === EXPECTED_STEP_IDS[index]);
    const peChatAgrees = input.dailyPe
      ? Boolean(input.dailyPe.chatReady) === Boolean(chatReady)
      : true;
    const alignsWithDailyPe = stepIdsMatch && peChatAgrees && steps.length === 4;

    const nextCommand = chatReady ? 'zavorth' : 'zavorth setup';
    return {
      generatedAt: now,
      version: 'code-daily-loop/v1',
      surface: 'code',
      chatReady,
      providerReady,
      providerId: selection.providerId,
      peAligned: {
        chatReady,
        happyPathSteps: steps.length,
        nextCommand,
      },
      happyPath: {
        steps,
        nextCommand,
        summary: chatReady
          ? 'Code daily loop structure matches Desktop/Control PE (open → provider → first ask → review).'
          : 'Code daily loop needs a configured provider (shared UserSelectionResolver).',
      },
      alignsWithDailyPe,
      notes: [
        'Code uses the same provider/channel preference files as Desktop and Control.',
        'Daily loop order matches Desktop/Control: open → provider ready → first ask → review.',
        'first-ask and review stay incomplete until real session signals are provided.',
        'This projection does not claim the external zavorth-code repo is fully merged.',
      ],
    };
  }

  public renderText(snapshot: CodeDailyLoopSnapshot): string {
    return [
      'Zavorth Code daily loop',
      `chatReady: ${snapshot.chatReady ? 'yes' : 'no'}`,
      `providerReady: ${snapshot.providerReady ? 'yes' : 'no'}`,
      `provider: ${snapshot.providerId || 'not configured'}`,
      `alignsWithDailyPe: ${snapshot.alignsWithDailyPe ? 'yes' : 'no'}`,
      '',
      '[happy path]',
      ...snapshot.happyPath.steps.map((step) => `- [${step.done ? 'done' : 'todo'}] ${step.label}: ${step.summary}`),
      `Next: ${snapshot.happyPath.nextCommand}`,
      '',
      ...snapshot.notes.map((note) => `note: ${note}`),
    ].join('\n');
  }
}
