import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthRuntimeCapabilitiesService } from '../../src/services/ZavorthRuntimeCapabilitiesService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-capabilities-'));
}

describe('ZavorthRuntimeCapabilitiesService', () => {
  it('builds a sanitized capabilities payload from runtime projections', () => {
    const root = makeRoot();
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T11:00:00.000Z'),
    });
    runtimeStateBus.dispatch({
      type: 'set-provider-connection',
      approved: true,
      payload: {
        providerConnection: {
          providerId: 'ollama',
          label: 'Ollama local',
          targetUrl: 'http://127.0.0.1:11434/v1',
          apiKey: 'should-never-leak',
        },
      },
    });
    runtimeStateBus.appendReceipt({
      id: 'blocked-provider-receipt-1',
      createdAt: '2026-06-10T11:00:00.000Z',
      domain: 'model',
      action: 'set-provider-connection',
      status: 'blocked',
      phase: 'receipt',
      summary: 'Blocked unsafe provider target.',
      preview: {
        mutation: 'set provider connection',
        requiresApproval: true,
        reason: 'private_network_provider_requires_explicit_local_provider',
      },
      approval: {
        required: true,
        approved: false,
        approvalId: null,
      },
      safety: {
        pathValidated: false,
        rawSecretsSerialized: false,
        receiptSpoofingPrevented: true,
        approvalBypassPrevented: true,
      },
      metadata: {
        error: 'private_network_provider_requires_explicit_local_provider',
        payload: {
          providerConnection: {
            providerId: 'openai',
            label: 'OpenAI unsafe local',
            targetHost: 'http://127.0.0.1:11434',
          },
        },
      },
    });
    runtimeStateBus.dispatch({
      type: 'set-provider-connection',
      approved: true,
      payload: {
        providerConnection: {
          providerId: 'anthropic',
          label: 'Anthropic',
          status: 'needs-setup',
        },
      },
    });
    runtimeStateBus.dispatch({
      type: 'set-workspace-knowledge',
      approved: true,
      payload: {
        workspaceKnowledge: {
          workspaceId: 'folder:repo',
          activeWorkspaceLabel: 'repo',
          isolation: 'folder',
          trustedWorkspaceIds: ['folder:repo'],
          allowedPaths: ['C:/repo'],
          ragSources: [
            { id: 'docs', kind: 'document', label: 'Project docs', trusted: true },
            { id: 'web-research', kind: 'web', label: 'Web research', trusted: false },
          ],
        },
      },
    });
    runtimeStateBus.dispatch({
      type: 'register-personal-connector',
      approved: true,
      payload: {
        personalConnector: {
          id: 'email:primary',
          kind: 'email',
          label: 'Primary email',
          configured: false,
          rawToken: 'email-token-should-never-leak',
        },
      },
    });
    runtimeStateBus.dispatch({
      type: 'set-mcp-trust',
      approved: true,
      payload: {
        mcpTrust: {
          id: 'mcp:filesystem',
          label: 'Filesystem MCP',
          origin: 'local',
          trustState: 'review',
          toolNames: ['read_file', 'write_file'],
          risk: 'high',
          networkAccess: 'blocked',
        },
      },
    });
    runtimeStateBus.dispatch({
      type: 'resume-stream',
      approved: true,
      payload: {
        streamSession: {
          sessionId: 'desktop-main',
          status: 'resumable',
          resumeToken: 'stream-token-1',
        },
      },
    });

    const snapshot = new ZavorthRuntimeCapabilitiesService({
      now: () => new Date('2026-06-10T11:00:00.000Z'),
      runtimeStateBus,
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-runtime-capabilities/1');
    expect(snapshot.capabilities.available.some((capability) => capability.id === 'chat.ask')).toBe(true);
    expect(snapshot.modelSpecs.selectedSpecId).toBe('daily');
    expect(snapshot.providers.connected.some((provider) => provider.id === 'ollama')).toBe(true);
    expect(snapshot.providers.configurable.some((provider) => provider.id === 'anthropic')).toBe(true);
    expect(snapshot.providers.blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai',
        status: 'blocked',
        blockReason: 'private_network_provider_requires_explicit_local_provider',
      }),
    ]));
    expect(snapshot.workspaceKnowledge.allowedPaths).toEqual([path.normalize('C:/repo')]);
    expect(snapshot.workspaceKnowledge.ragSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'docs', trusted: true }),
      expect.objectContaining({ id: 'web-research', trusted: false }),
    ]));
    expect(snapshot.permissions.domains.filesystem.actions.write.requiresApproval).toBe(true);
    expect(snapshot.personalOps.connectors.every((connector) => connector.enabled === false)).toBe(true);
    expect(snapshot.personalOps.connectors.find((connector) => connector.id === 'email:primary')).toMatchObject({
      status: 'disabled',
      readAllowed: false,
      draftAllowed: false,
      sendRequiresApproval: true,
      operations: expect.arrayContaining([
        expect.objectContaining({ id: 'email.read', requiresApproval: true, enabled: false }),
        expect.objectContaining({ id: 'email.draft', requiresApproval: true, enabled: false }),
        expect.objectContaining({ id: 'email.send', requiresApproval: true, enabled: false }),
      ]),
      profilePriority: 'primary-for-personal',
    });
    expect(snapshot.personalOps.policy).toMatchObject({
      primaryProfile: 'personal',
      defaultOutsidePersonal: 'discreet',
      liveAdaptersRequireCredentialRef: true,
      mcpAllowedAsAdapter: true,
    });
    expect(snapshot.mcpTrust.servers.find((server) => server.id === 'mcp:filesystem')).toMatchObject({
      trustState: 'review',
      risk: 'medium',
      networkAccess: 'blocked',
      exposedToModel: false,
    });
    expect(snapshot.streamSession.resumeToken).toBe('stream-token-1');
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('should-never-leak');
    expect(JSON.stringify(snapshot)).not.toContain('email-token-should-never-leak');
  });
});
