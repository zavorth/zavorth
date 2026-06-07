import { resolveComposerModelRouteOverride } from '../../src/services/WebAppComposerModelRoute';

describe('resolveComposerModelRouteOverride', () => {
  it('routes provider/model composer overrides into provider and model names', () => {
    expect(resolveComposerModelRouteOverride({
      composerSettings: { model: 'openai/gpt-5.5' },
    })).toEqual({
      providerName: 'openai',
      modelName: 'gpt-5.5',
    });
  });

  it('keeps explicit providerName/modelName ahead of composer preferences', () => {
    expect(resolveComposerModelRouteOverride({
      providerName: 'anthropic',
      modelName: 'claude-opus',
      composerSettings: { model: 'openai/gpt-5.5' },
    })).toEqual({
      providerName: 'anthropic',
      modelName: 'claude-opus',
    });
  });

  it('ignores inherited composer model labels and preserves fallback lock', () => {
    expect(resolveComposerModelRouteOverride({
      allowProviderFallback: false,
      composerSettings: { model: 'auto' },
    })).toEqual({
      allowProviderFallback: false,
    });
  });
});
