import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  AgentSelfConfigService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-agent-self-config-${++index}`;
}

const sampleSnapshot = {
  contractVersion: '2026-05-03.agent-self-config',
  source: 'AgentSelfConfigService',
  status: 'needs-review',
  identity: {
    agentName: 'Zavorth',
    userName: 'Grey',
    trustMode: 'collaborator',
  },
  summary: {
    cardCount: 3,
    identityFileCount: 1,
    memoryReceiptCount: 0,
    versionedChangesRequired: true,
  },
  policy: {
    readOnlySnapshot: true,
    noIdentityChanged: true,
    noMemoryChanged: true,
  },
  cards: [],
  suggestions: [],
};

describe('ZavorthControl Agent Self Config', () => {
  it('projects agentSelfConfig metadata into the zavorthControl view model', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-1',
        status: 'completed',
        metadata: {},
      },
      agentSelfConfig: sampleSnapshot,
    });

    expect(viewModel.agentSelfConfig).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.agent-self-config',
      status: 'needs-review',
      identity: expect.objectContaining({
        agentName: 'Zavorth',
        userName: 'Grey',
      }),
      summary: expect.objectContaining({
        cardCount: 3,
        identityFileCount: 1,
      }),
      policy: expect.objectContaining({
        readOnlySnapshot: true,
        noIdentityChanged: true,
      }),
    }));
  });

  it('maps runtime snapshots with Agent Self Config into runtime projection', () => {
    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot({
      activeRun: {
        id: 'run-1',
        status: 'completed',
        userId: 'grey',
        metadata: {
          agentSelfConfig: sampleSnapshot,
        },
      },
      status: 'ready',
    });

    expect(projection.agentSelfConfig).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.agent-self-config',
      identity: expect.objectContaining({
        agentName: 'Zavorth',
      }),
    }));
  });
});
