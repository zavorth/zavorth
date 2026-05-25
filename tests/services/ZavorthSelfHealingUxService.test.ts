import { ZavorthSelfHealingUxService, sanitize } from '../../src/services/ZavorthSelfHealingUxService.js';

describe('ZavorthSelfHealingUxService', () => {
  it('turns missing provider state into contextual setup guidance', () => {
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: 'Answer the user',
      snapshot: {
        agent: {
          providerLabel: 'not configured',
          modelLabel: 'not configured',
        },
        health: {
          status: 'attention',
          summary: 'Provider missing',
          warnings: [],
        },
      } as any,
    });

    expect(projection.issue).toBe('provider_missing');
    expect(projection.canZavorthRepair).toBe(true);
    expect(projection.needsUserInput).toBe(true);
    expect(projection.nextSafeAction).toContain('provider');
    expect(projection.setup?.requiredInput.join(' ')).toContain('API key');
  });

  it('classifies quota failures as fallback opportunities without leaking secrets', () => {
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: 'Call provider',
      error: new Error('OpenAI insufficient_quota for sk-proj-secret-value-1234567890'),
      snapshot: {
        agent: {
          providerLabel: 'openai',
          modelLabel: 'gpt-test',
        },
        health: {
          status: 'attention',
          summary: 'quota',
          warnings: [],
        },
      } as any,
      providerMatrix: {
        entries: [
          { id: 'gemini', status: 'ready', defaultRouteAllowed: true },
          { id: 'openrouter', status: 'ready', defaultRouteAllowed: true },
        ],
      } as any,
      debug: true,
    });

    expect(projection.issue).toBe('provider_quota');
    expect(projection.fallback?.selectedProvider).toBe('gemini');
    expect(JSON.stringify(projection)).not.toContain('sk-proj-secret-value');
  });

  it('keeps secret-looking values redacted', () => {
    expect(sanitize('token=abc123 OPENAI_API_KEY=sk-secret-value-1234567890 Bearer live-token-123')).toContain('[redacted]');
  });

  it('does not render recovery for successful normal replies', () => {
    const projection = new ZavorthSelfHealingUxService().buildProjection({
      attempted: 'Answer normally',
      result: {
        ok: true,
        handled: true,
        error: null,
        plan: {
          title: 'Natural answer',
          summary: 'Safe answer',
          requiresApproval: false,
          risk: 'safe',
        },
        replies: [{ text: 'Done.' }],
        snapshot: {
          agent: {
            providerLabel: 'gemini',
            modelLabel: 'gemini-test',
          },
          health: {
            status: 'ready',
            summary: 'ready',
            warnings: [],
          },
        },
        receipts: [],
      } as any,
    });

    expect(projection.issue).toBe('none');
    expect(projection.shouldRender).toBe(false);
  });
});
