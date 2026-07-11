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
  alignsWithDailyPe: true;
  notes: string[];
};

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
  } = {}): CodeDailyLoopSnapshot {
    const selection = resolveUserProviderSelection({
      projectRoot: this.options.projectRoot,
      env: this.options.env,
    });
    const providerReady = Boolean(selection.configured && selection.providerId);
    const chatReady = input.dailyPe?.chatReady ?? providerReady;
    const now = (this.options.now || (() => new Date()))().toISOString();

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
        summary: chatReady
          ? 'Send a useful coding ask in the TUI session.'
          : 'Blocked until provider is ready.',
        done: chatReady,
      },
      {
        id: 'review',
        label: 'Review',
        summary: 'Review diffs/approvals before applying risky edits.',
        done: chatReady,
      },
    ];

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
          ? 'Code daily loop ready: open → ask → review (same PE as Desktop/Control).'
          : 'Code daily loop needs a configured provider (shared UserSelectionResolver).',
      },
      alignsWithDailyPe: true,
      notes: [
        'Code uses the same provider/channel preference files as Desktop and Control.',
        'Daily loop order matches Desktop/Control: open → provider ready → first ask → review.',
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
      '',
      '[happy path]',
      ...snapshot.happyPath.steps.map((step) => `- [${step.done ? 'done' : 'todo'}] ${step.label}: ${step.summary}`),
      `Next: ${snapshot.happyPath.nextCommand}`,
      '',
      ...snapshot.notes.map((note) => `note: ${note}`),
    ].join('\n');
  }
}
