import {
  isSurfaceAgentFirstEnabled,
  isTelegramAgentFirstFreeTextEnabled,
  shouldPassNaturalTextToAgent,
  resetSurfaceAgentFirstMetrics,
  getSurfaceAgentFirstMetrics,
  formatSurfaceAgentFirstMetricsText,
} from '../../../src/domain/surface/presentation/shared-surface/SurfaceAgentFirstMode.js';
import {
  preDispatchSharedSurfaceCommand,
  type SharedSurfaceCommandPreDispatchContext,
} from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceCommandDispatch.js';

function mockDeps(
  overrides: Partial<SharedSurfaceCommandPreDispatchContext> = {},
): SharedSurfaceCommandPreDispatchContext {
  return {
    ctx: {
      platform: 'telegram',
      rawText: 'approve the last task',
      userId: 'u1',
      chatId: 'c1',
      isGroup: false,
      reply: async () => undefined,
    } as SharedSurfaceCommandPreDispatchContext['ctx'],
    rawText: 'approve the last task',
    parsed: null,
    parse: (t: string) => ({
      command_type: t.startsWith('/') ? t.split(' ')[0] : '/task',
      command_args: t.startsWith('/') ? t.split(' ').slice(1).join(' ') : t,
      normalized_message: t.toLowerCase(),
      explicit_executor: null,
      references_last_task: false,
    }),
    discordSurfacePolicyService: {
      canUseOperationalCommand: () => true,
      formatOperationalCommandDenied: () => 'denied',
      isOperationalCommand: () => false,
    },
    ...overrides,
  };
}

describe('Hermes-style free-text: always agent (no free-text NLU packs)', () => {
  const envKeys = [
    'ZAVORTH_TELEGRAM_AGENT_FIRST',
    'ZAVORTH_SURFACE_AGENT_FIRST',
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    resetSurfaceAgentFirstMetrics();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    resetSurfaceAgentFirstMetrics();
  });

  it('always routes free text to the agent (Hermes-style)', () => {
    expect(isTelegramAgentFirstFreeTextEnabled()).toBe(true);
    expect(isSurfaceAgentFirstEnabled('telegram')).toBe(true);
    expect(
      shouldPassNaturalTextToAgent({ platform: 'telegram', rawText: 'approve the last task' }),
    ).toBe(true);
    expect(
      shouldPassNaturalTextToAgent({ platform: 'telegram', rawText: 'install this skill please' }),
    ).toBe(true);
    expect(
      shouldPassNaturalTextToAgent({ platform: 'telegram', rawText: '/approve abc' }),
    ).toBe(false);
  });

  it('kill-switch env no longer re-enables free-text NLU packs', () => {
    process.env.ZAVORTH_TELEGRAM_AGENT_FIRST = '0';
    process.env.ZAVORTH_SURFACE_AGENT_FIRST = '0';
    // Free text still belongs to the agent; packs are deleted.
    expect(isTelegramAgentFirstFreeTextEnabled()).toBe(true);
    expect(isSurfaceAgentFirstEnabled('telegram')).toBe(true);
    expect(
      shouldPassNaturalTextToAgent({ platform: 'telegram', rawText: 'approve the last task' }),
    ).toBe(true);
    expect(formatSurfaceAgentFirstMetricsText()).toMatch(/NLU packs: removed|free text → agent/i);
  });

  it('defaults to agent-first on non-Telegram surfaces', () => {
    expect(isSurfaceAgentFirstEnabled('discord')).toBe(true);
    expect(isSurfaceAgentFirstEnabled('desktop')).toBe(true);
    expect(
      shouldPassNaturalTextToAgent({ platform: 'discord', rawText: 'hello agent' }),
    ).toBe(true);
  });

  it('preDispatch defaults to pass_to_agent for free text', async () => {
    const result = await preDispatchSharedSurfaceCommand(mockDeps());
    expect(result.kind).toBe('pass_to_agent');
    expect(getSurfaceAgentFirstMetrics().naturalSkippedForAgent).toBe(1);
  });

  it('slash commands are never pass_to_agent', async () => {
    const deps = mockDeps({
      rawText: '/approve task-1',
      parsed: {
        command_type: '/approve',
        command_args: 'task-1',
        normalized_message: '/approve task-1',
        explicit_executor: null,
        references_last_task: false,
      },
    });
    deps.rawText = '/approve task-1';
    const result = await preDispatchSharedSurfaceCommand(deps);
    expect(result.kind).not.toBe('pass_to_agent');
    expect(result.kind).toBe('resolved');
    expect(getSurfaceAgentFirstMetrics().slashDeterministic).toBe(1);
  });
});
