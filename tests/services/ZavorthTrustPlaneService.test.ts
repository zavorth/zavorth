import { ZavorthTrustPlaneService } from '../../src/services/ZavorthTrustPlaneService.js';
import { McpToolPolicy } from '../../src/mcp/McpToolPolicy.js';

describe('ZavorthTrustPlaneService', () => {
  it('builds a unified trust-plane snapshot from host, MCP, skills, plugins and nodes', () => {
    const service = new ZavorthTrustPlaneService({
      now: () => new Date('2026-04-11T14:00:00.000Z'),
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
            summary: 'Runtime protegido.',
          },
          summary: {
            coreReady: 3,
            extensionsReady: 1,
          },
          narrative: {
            operatorSummary: 'Runtime protegido com tiers fortes em preparo.',
            trustBoundary: 'Container antes de host e microVM para alto risco.',
          },
          suggestedActions: [
            {
              id: 'microvm-smoke',
              label: 'Validar microVM',
              command: 'npm run sandbox:firecracker:smoke',
              severity: 'warn',
              reason: 'Confirme a microVM.',
            },
          ],
        })),
      } as any,
      systemOverlordControlService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            pendingApprovals: 2,
            adapters: 3,
            highestRiskLevel: 'critical',
          },
          narrative: {
            operatorSummary: 'Host supervisionado com approvals pendentes.',
          },
          profiles: [
            { profile: 'safe' },
            { profile: 'trusted' },
            { profile: 'dangerous' },
            { profile: 'owner' },
          ],
          autonomyLevels: [{ level: 1 }, { level: 2 }, { level: 3 }],
          capabilities: [
            { capability: 'host.shell', riskLevel: 'medium' },
            { capability: 'browser.control', riskLevel: 'high' },
            { capability: 'computer_use.visual_action', riskLevel: 'critical' },
          ],
          killSwitch: {
            active: false,
          },
        })),
      } as any,
      mcpToolPolicy: new McpToolPolicy({ profile: 'trusted', allowlist: ['remote_shell'] }),
      mcpCapabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            enabled: 2,
            connected: 1,
          },
          recommendations: ['Revise o manifesto MCP.'],
        })),
      } as any,
      skillTrustPolicyService: {
        readPolicy: jest.fn(() => ({
          version: 1,
          updatedAt: '2026-04-11T13:55:00.000Z',
          defaultPolicy: 'deny',
          allowedSourceIds: ['workspace-agents', 'workspace-library'],
          rules: [
            {
              sourceId: 'workspace-agents',
              mode: 'all',
              skillNames: [],
              reason: 'Local.',
            },
            {
              sourceId: 'external-marketplace',
              mode: 'explicit',
              skillNames: ['safe-skill'],
              reason: 'Revisado.',
            },
            {
              sourceId: 'unknown-source',
              mode: 'none',
              skillNames: [],
              reason: 'Bloqueado.',
            },
          ],
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 5,
            installed: 3,
            trusted: 2,
            workspaceExtensions: 1,
          },
          narrative: {
            operatorSummary: 'Plugin plane com um review pendente.',
          },
        })),
      } as any,
      workspaceExtensionsService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            workspaces: 1,
          },
          narrative: {
            operatorSummary: 'Workspace com ZAVORTH.md.',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 2,
            pending: 0,
          },
          entries: [
            {
              id: 'node-1',
              capabilityIds: ['system.run', 'files.write'],
              approvedCapabilityIds: ['system.run'],
            },
            {
              id: 'node-2',
              capabilityIds: ['browser.proxy'],
              approvedCapabilityIds: ['browser.proxy'],
            },
          ],
          narrative: {
            operatorSummary: 'Node Mesh com um node restrito.',
          },
        })),
      } as any,
      policyLedgerService: {
        summarize: jest.fn(() => ({
          total: 3,
          lastMutationAt: '2026-04-11T13:58:00.000Z',
          rollbackableEntries: 2,
          byStatus: { previewed: 1, applied: 2, blocked: 0, rolled_back: 0, noop: 0 },
          byDomain: { mcp: 2, skills: 1 },
          recent: [],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-11T14:00:00.000Z');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      posture: 'guarded',
      pendingApprovals: 2,
      highRiskCapabilities: 2,
      mcpProfile: 'trusted',
      skillDefaultPolicy: 'deny',
      trustedPlugins: 2,
      installedPlugins: 3,
      restrictedNodes: 1,
      pairedNodes: 2,
      policyDomains: 11,
      policyLedgerEntries: 3,
      rollbackablePolicyEntries: 2,
    }));
    expect(snapshot.surfaces.mcp).toEqual(expect.objectContaining({
      profile: 'trusted',
      enabledServers: 2,
      connectedServers: 1,
    }));
    expect(snapshot.surfaces.skills).toEqual(expect.objectContaining({
      defaultPolicy: 'deny',
      blockedSources: ['unknown-source'],
    }));
    expect(snapshot.riskHighlights).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pending-approvals',
      }),
      expect.objectContaining({
        id: 'mcp-promoted',
      }),
    ]));
    expect(snapshot.suggestedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'microvm-smoke',
        command: 'npm run sandbox:firecracker:smoke',
      }),
      expect.objectContaining({
        id: 'plugins-review',
        command: '/plugins review',
      }),
      expect.objectContaining({
        id: 'nodes-review',
        command: '/nodes',
      }),
    ]));
    expect(snapshot.narrative.headline).toBe('Trust Plane do Zavorth');
    expect(snapshot.narrative.operatorSummary).toContain('MCP em perfil trusted');
    expect(snapshot.narrative.operatorSummary).toContain('node(s) com allowlist restrita');
    expect(snapshot.policyOS.domains).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'mcp', status: 'active', auditRequired: true }),
      expect.objectContaining({ id: 'automation', status: 'consulted', auditRequired: true }),
      expect.objectContaining({ id: 'hardware', status: 'consulted', auditRequired: true }),
      expect.objectContaining({ id: 'autonomous-partner', status: 'consulted', auditRequired: true }),
      expect.objectContaining({ id: 'selfmod', status: 'planned', auditRequired: true }),
    ]));
    expect(snapshot.policyOS.ledger.total).toBe(3);
    expect(snapshot.policyOS.dangerousPolicy).toContain('once');
    expect(service.renderReport()).toContain('/trust mcp trusted');
    expect(service.renderReport()).toContain('Policy OS');
  });
});
