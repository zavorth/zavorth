import type { UniversalAgentRequest, UniversalAgentRun } from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import { resolveLearningRuntimePolicy } from './ZavorthLearningRuntimePolicy.js';

export type ZavorthAgentMaturitySnapshot = {
  contractVersion: 'zavorth-agent-maturity/1';
  generatedAt: string;
  session: {
    mode: 'chat-first';
    continuity: 'session-memory-ready' | 'session-memory-pending';
    interactionStyle: 'natural-language-primary';
  };
  gateway: {
    policy: 'gateway-first-with-provider-fallback';
    fallbackEnabled: true;
    providerNativeTools: 'enabled-when-evidence-can-be-verified';
  };
  execution: {
    strategy: 'sandbox-first-for-mutations';
    preferredBackends: Array<'docker' | 'wsl' | 'ssh' | 'vercel-sandbox' | 'local-copy'>;
    hostMutationRequiresApproval: true;
  };
  learning: {
    mode: 'governed' | 'autonomous' | 'candidate-after-success';
    canModifySecurityPolicy: false;
    userConsentRequired: boolean;
  };
  subagents: {
    mode: 'delegate-when-complex';
    availableWhenToolExposed: true;
    isolationRequired: true;
  };
  automation: {
    mode: 'event-hooks-with-policy';
    longRunningWorkRequiresReceipts: true;
  };
  channels: {
    mode: 'same-core-all-surfaces';
    remoteInputRequiresPairingOrAllowlist: true;
    channelFailureShouldOfferRepair: true;
  };
  prompt: string;
  visibleSummary: string[];
};

export class ZavorthAgentMaturityService {
  public buildSnapshot(input: {
    run?: UniversalAgentRun | null;
    request?: UniversalAgentRequest | null;
    now?: Date;
  } = {}): ZavorthAgentMaturitySnapshot {
    const run = input.run || null;
    const now = input.now || new Date();
    const preferredBackends = this.resolvePreferredBackends(run);
    const sessionContinuity = run?.sessionId ? 'session-memory-ready' : 'session-memory-pending';
    const learningPolicy = resolveLearningRuntimePolicy({ projectRoot: process.cwd() });
    const learningMode = learningPolicy.mode === 'autonomous' ? 'autonomous' : 'governed';
    const visibleSummary = [
      'Natural language is the primary interface; commands are recovery shortcuts, not the product center.',
      'The LLM may use provider-native capabilities when evidence can be verified, then falls back to Zavorth tools.',
      `Mutable work is sandbox-first with preferred backends: ${preferredBackends.join(', ')}.`,
      learningMode === 'autonomous'
        ? 'Successful turns may persist reversible green preferences and yellow skill drafts with receipts; security policy never auto-changes.'
        : 'Repeated successful behavior becomes a learning candidate for review; no silent security-policy change.',
      'Complex work should be decomposed and delegated only through exposed subagent/tools with receipts.',
    ];
    return {
      contractVersion: 'zavorth-agent-maturity/1',
      generatedAt: now.toISOString(),
      session: {
        mode: 'chat-first',
        continuity: sessionContinuity,
        interactionStyle: 'natural-language-primary',
      },
      gateway: {
        policy: 'gateway-first-with-provider-fallback',
        fallbackEnabled: true,
        providerNativeTools: 'enabled-when-evidence-can-be-verified',
      },
      execution: {
        strategy: 'sandbox-first-for-mutations',
        preferredBackends,
        hostMutationRequiresApproval: true,
      },
      learning: {
        mode: learningMode,
        canModifySecurityPolicy: false,
        userConsentRequired: learningPolicy.userConsentRequired,
      },
      subagents: {
        mode: 'delegate-when-complex',
        availableWhenToolExposed: true,
        isolationRequired: true,
      },
      automation: {
        mode: 'event-hooks-with-policy',
        longRunningWorkRequiresReceipts: true,
      },
      channels: {
        mode: 'same-core-all-surfaces',
        remoteInputRequiresPairingOrAllowlist: true,
        channelFailureShouldOfferRepair: true,
      },
      prompt: this.buildPrompt(visibleSummary),
      visibleSummary,
    };
  }

  private buildPrompt(summary: string[]): string {
    return [
      'Zavorth maturity operating model:',
      ...summary.map((line) => `- ${line}`),
      '- If the user asks for work that needs setup, diagnose the missing provider/channel/backend and offer the narrowest safe repair.',
      '- If provider-native tools fail or lack evidence, use governed Zavorth-native fallback tools when visible instead of pretending the provider succeeded.',
      '- For code, local files or host effects: prefer read-only observation first; prepare mutations through sandbox/rehearsal and approvals.',
      '- For long or complex work: make a compact plan, use exposed tools/subagents when available, and keep progress resumable through receipts.',
      '- For automation: propose governed event hooks/tasks only after explaining trigger, effect, approval boundary and rollback.',
      '- For learning: propose reversible Mnemos/skill candidates after successful runs; never learn prompts that weaken security policy.',
    ].join('\n');
  }

  private resolvePreferredBackends(run: UniversalAgentRun | null): ZavorthAgentMaturitySnapshot['execution']['preferredBackends'] {
    const raw = normalizeText(
      run?.metadata?.terminalBackend
      || run?.metadata?.executionBackend
      || process.env.ZAVORTH_DEFAULT_MUTATION_BACKEND
      || '',
    ).toLowerCase();
    const configured = raw ? [raw] : [];
    const ordered = [
      ...configured,
      'docker',
      'wsl',
      'ssh',
      'vercel-sandbox',
      'local-copy',
    ];
    return Array.from(new Set(ordered.map((entry) => {
      if (entry === 'vercel') return 'vercel-sandbox';
      if (entry === 'local') return 'local-copy';
      return entry;
    }).filter((entry): entry is ZavorthAgentMaturitySnapshot['execution']['preferredBackends'][number] =>
      ['docker', 'wsl', 'ssh', 'vercel-sandbox', 'local-copy'].includes(entry))));
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
