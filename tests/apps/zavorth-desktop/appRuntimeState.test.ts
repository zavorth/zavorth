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

  it('translates full cockpit controls into first-class runtime bus actions', () => {
    expect(runtimeInstrumentActionInput({
      domain: 'gateway',
      operation: 'setup-provider',
      metadata: {
        runtimeActionType: 'set-provider-connection',
        providerConnection: {
          providerId: 'anthropic',
          label: 'Anthropic',
          status: 'needs-setup',
        },
      },
    })).toMatchObject({
      type: 'set-provider-connection',
      payload: {
        providerConnection: {
          providerId: 'anthropic',
          label: 'Anthropic',
          status: 'needs-setup',
        },
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'model',
      operation: 'select-spec',
      metadata: {
        runtimeActionType: 'select-model-spec',
        modelSpec: { id: 'coding' },
      },
    })).toMatchObject({
      type: 'select-model-spec',
      payload: {
        modelSpec: { id: 'coding' },
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'context',
      operation: 'scope-knowledge',
      metadata: {
        runtimeActionType: 'set-workspace-knowledge',
        workspaceKnowledge: {
          workspaceId: 'folder:C:/repo',
          activeWorkspaceLabel: 'repo',
          isolation: 'folder',
          allowedPaths: ['C:/repo'],
          ragSources: [{ id: 'docs', kind: 'document', label: 'Docs', trusted: true }],
        },
      },
    })).toMatchObject({
      type: 'set-workspace-knowledge',
      payload: {
        workspaceKnowledge: expect.objectContaining({
          workspaceId: 'folder:C:/repo',
          isolation: 'folder',
        }),
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'context',
      operation: 'register-personal-connector',
      metadata: {
        runtimeActionType: 'register-personal-connector',
        personalConnector: {
          id: 'email:primary',
          kind: 'email',
          label: 'Primary email',
          configured: false,
        },
      },
    })).toMatchObject({
      type: 'register-personal-connector',
      payload: {
        personalConnector: {
          id: 'email:primary',
          kind: 'email',
          label: 'Primary email',
          configured: false,
        },
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'session',
      operation: 'resume-stream',
      metadata: {
        runtimeActionType: 'resume-stream',
        streamSession: {
          sessionId: 'desktop-main',
          status: 'resumable',
          resumeToken: 'resume-1',
        },
      },
    })).toMatchObject({
      type: 'resume-stream',
      payload: {
        streamSession: {
          sessionId: 'desktop-main',
          status: 'resumable',
          resumeToken: 'resume-1',
        },
      },
    });

    expect(runtimeInstrumentActionInput({
      domain: 'skills',
      operation: 'preview-skill',
      metadata: {
        runtimeActionType: 'skill-lifecycle',
        skill: {
          id: 'native:write-file',
          name: 'write-file',
          source: 'native',
          status: 'preview',
        },
      },
    })).toMatchObject({
      type: 'skill-lifecycle',
      payload: {
        skill: {
          id: 'native:write-file',
          name: 'write-file',
          source: 'native',
          status: 'preview',
        },
      },
    });
  });
});
