import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthRuntimeSecureIntegrationService } from '../../src/services/ZavorthRuntimeSecureIntegrationService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';
import { TrustedWorkspacePolicyService } from '../../src/services/TrustedWorkspacePolicyService.js';
import { McpToolPolicyFileService } from '../../src/services/McpToolPolicyFileService.js';

class MemorySecureStorage {
  public readonly secrets = new Map<string, string>();

  public writeSecret(name: string, value: string | null | undefined): boolean {
    if (!value) return false;
    this.secrets.set(name, String(value));
    return true;
  }

  public readSecret(name: string): string | null {
    return this.secrets.get(name) || null;
  }
}

function makeRuntime() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-secure-integration-'));
  const bus = new ZavorthRuntimeStateBusService({
    stateFilePath: path.join(root, 'runtime-state.json'),
    now: () => new Date('2026-06-10T14:00:00.000Z'),
  });
  return { root, bus };
}

describe('ZavorthRuntimeSecureIntegrationService', () => {
  it('stores provider credentials securely and only publishes sanitized provider state', () => {
    const { bus } = makeRuntime();
    const secureStorage = new MemorySecureStorage();
    const service = new ZavorthRuntimeSecureIntegrationService({
      runtimeStateBus: bus,
      secureStorage,
      now: () => new Date('2026-06-10T14:00:00.000Z'),
    });

    const result = service.dispatch({
      type: 'set-provider-connection',
      approved: true,
      source: 'desktop-provider-setup',
      payload: {
        providerConnection: {
          providerId: 'openai',
          label: 'OpenAI',
          apiKey: 'sk-test-provider-secret',
          modelIds: ['openai:gpt-5'],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(secureStorage.readSecret('providers.openai.apiKey')).toBe('sk-test-provider-secret');
    expect(result.snapshot.projections.dynamicRouting.providerConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai',
        label: 'OpenAI',
        status: 'configured',
      }),
    ]));
    expect(JSON.stringify(result.snapshot)).not.toContain('sk-test-provider-secret');
    expect(JSON.stringify(result.receipt)).not.toContain('sk-test-provider-secret');
  });

  it('stores personal OAuth tokens while keeping read/draft/send governed by approvals', () => {
    const { bus } = makeRuntime();
    const secureStorage = new MemorySecureStorage();
    const service = new ZavorthRuntimeSecureIntegrationService({
      runtimeStateBus: bus,
      secureStorage,
      now: () => new Date('2026-06-10T14:00:00.000Z'),
    });

    const result = service.dispatch({
      type: 'register-personal-connector',
      approved: true,
      source: 'desktop-personal-ops-setup',
      payload: {
        personalConnector: {
          id: 'email:primary',
          kind: 'email',
          label: 'Primary email',
          accessToken: 'email-access-secret',
          refreshToken: 'email-refresh-secret',
          enabled: true,
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(secureStorage.readSecret('personal.email.email-primary.accessToken')).toBe('email-access-secret');
    expect(secureStorage.readSecret('personal.email.email-primary.refreshToken')).toBe('email-refresh-secret');
    expect(result.snapshot.projections.personalOps.connectors.find((connector) => connector.id === 'email:primary')).toMatchObject({
      status: 'configured',
      enabled: true,
      readAllowed: true,
      draftAllowed: true,
      sendRequiresApproval: true,
      writeRequiresApproval: true,
    });
    expect(JSON.stringify(result.snapshot)).not.toContain('email-access-secret');
    expect(JSON.stringify(result.snapshot)).not.toContain('email-refresh-secret');
  });

  it('blocks unsafe workspace knowledge paths before they become RAG scope', () => {
    const { bus } = makeRuntime();
    const secureStorage = new MemorySecureStorage();
    const workspacePolicy = new TrustedWorkspacePolicyService();
    const service = new ZavorthRuntimeSecureIntegrationService({
      runtimeStateBus: bus,
      secureStorage,
      workspacePolicy,
      now: () => new Date('2026-06-10T14:00:00.000Z'),
    });

    const result = service.dispatch({
      type: 'set-workspace-knowledge',
      approved: true,
      source: 'desktop-workspace-picker',
      payload: {
        workspaceKnowledge: {
          workspaceId: 'folder:root',
          activeWorkspaceLabel: 'Root',
          allowedPaths: [path.parse(process.cwd()).root],
          ragSources: [
            { id: 'root-docs', kind: 'document', label: 'Root docs', trusted: true },
          ],
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toBe('workspace_knowledge_path_blocked');
    expect(result.snapshot.projections.workspaceKnowledge.allowedPaths).toEqual([]);
    expect(result.receipt.status).toBe('blocked');
  });

  it('persists MCP trust decisions to policy before exposing tools to the model', () => {
    const { root, bus } = makeRuntime();
    const secureStorage = new MemorySecureStorage();
    const mcpPolicy = new McpToolPolicyFileService({
      policyFile: path.join(root, 'mcp-tool-policy.json'),
      now: () => new Date('2026-06-10T14:00:00.000Z'),
    });
    const service = new ZavorthRuntimeSecureIntegrationService({
      runtimeStateBus: bus,
      secureStorage,
      mcpPolicy,
      now: () => new Date('2026-06-10T14:00:00.000Z'),
    });

    const result = service.dispatch({
      type: 'set-mcp-trust',
      approved: true,
      source: 'desktop-mcp-trust',
      payload: {
        mcpTrust: {
          id: 'mcp:filesystem',
          label: 'Filesystem MCP',
          origin: 'local',
          trustState: 'trusted',
          toolNames: ['read_file', 'write_file'],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(mcpPolicy.readPolicy()).toMatchObject({
      profile: 'trusted',
      allowlist: expect.arrayContaining(['read_file', 'write_file']),
    });
    expect(result.snapshot.projections.mcpTrust.servers.find((server) => server.id === 'mcp:filesystem')).toMatchObject({
      trustState: 'trusted',
      exposedToModel: true,
    });
  });
});
