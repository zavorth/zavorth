import {
  modelOptionsFromRuntimeCapabilities,
  runtimeInstrumentActionInput,
} from '../../../apps/zavorth-desktop/src/appRuntimeState.js';
import type { RuntimeCapabilitiesSnapshot } from '../../../apps/zavorth-desktop/src/apiClient.js';

describe('zavorth desktop runtime state helpers', () => {
  it('builds model options only from runtime selectable model ids when capabilities are present', () => {
    const capabilities: RuntimeCapabilitiesSnapshot = {
      providers: {
        selectableModelIds: ['openai:gpt-5', 'local:custom-model'],
        selectedModelId: 'openai:gpt-5',
      },
    };

    const options = modelOptionsFromRuntimeCapabilities(capabilities);

    expect(options.map(option => option.id)).toEqual(['openai:gpt-5', 'local:custom-model']);
    expect(options[0]).toMatchObject({
      family: 'OpenAI',
      label: 'GPT-5',
      connected: true,
    });
    expect(options[1]).toMatchObject({
      family: 'Local',
      label: 'Custom Model',
      connected: true,
    });
  });

  it('translates operational settings controls into runtime bus actions', () => {
    expect(runtimeInstrumentActionInput({
      domain: 'skills',
      operation: 'trust-mcp',
      metadata: {
        runtimeActionType: 'set-mcp-trust',
        mcpTrust: {
          id: 'mcp:filesystem',
          trustState: 'trusted',
        },
      },
    })).toMatchObject({
      type: 'set-mcp-trust',
      payload: {
        mcpTrust: {
          id: 'mcp:filesystem',
          trustState: 'trusted',
        },
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'cron',
      operation: 'recover',
      metadata: {
        runtimeActionType: 'recover-scheduled-jobs',
        scheduledJobs: { recoverable: 1 },
      },
    })).toMatchObject({
      type: 'recover-scheduled-jobs',
      payload: {
        scheduledJobs: { recoverable: 1 },
      },
    });
  });
});
