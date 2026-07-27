import { TENANT_TEAM_OPS_PACKAGE_SCRIPTS } from '../../src/contracts/TenantTeamOpsContract';
import { buildRuntimeShellHtml } from '../../src/domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml';
import type { ZavorthGovernanceControlPlaneSnapshot } from '../../src/services/ZavorthGovernanceControlPlaneService';
import { TenantTeamOpsService } from '../../src/services/TenantTeamOpsService';

describe('TenantTeamOpsService', () => {
  it('passes against the current repository tenant/team ops contract', () => {
    const service = new TenantTeamOpsService();

    const snapshot = service.buildSnapshot();

    expect(snapshot.gate).toBe('tenant-team-ops');
    expect(snapshot.surface).toBe('tenant-team-ops');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.ops.policyScopes.map((scope) => scope.id)).toEqual(
      expect.arrayContaining(['tenants', 'channels', 'teams', 'workspace']),
    );
  });

  it('builds identity scopes, policy scopes, permission readouts, project reports and isolation map', () => {
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      governanceSnapshot: governanceFixture(),
      now: () => new Date('2026-04-24T18:30:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.summary.tenants).toBe(3);
    expect(snapshot.summary.sharedTenants).toBe(2);
    expect(snapshot.summary.teams).toBe(2);
    expect(snapshot.ops.identityScopes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tenantId: 'discord-public',
        boundary: 'shared',
        policyProfile: 'discord-public',
        governanceStatus: 'pending_onboarding',
      }),
    ]));
    expect(snapshot.ops.permissionReadouts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tenantId: 'telegram-shared',
        status: 'ready',
        guidedActions: 2,
      }),
    ]));
    expect(snapshot.ops.projectReports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'project:discord',
        tenantCount: 1,
      }),
    ]));
    expect(snapshot.ops.isolationMap).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tenantId: 'discord-public',
        memoryScope: 'memory:tenant:discord-public',
        artifactScope: 'artifact:tenant:discord-public',
      }),
    ]));
  });

  it('fails when package scripts for tenant/team ops are missing', () => {
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture({
        'tenant:ops': '',
        'qa:tenant-team-ops': '',
      }),
      html: buildRuntimeShellHtml('/zavorthControl'),
      governanceSnapshot: governanceFixture(),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'package:tenant:ops', status: 'fail' }),
      expect.objectContaining({ id: 'package:qa:tenant-team-ops', status: 'fail' }),
    ]));
  });

  it('fails when the Dashboard tenant/team card disappears', () => {
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture(),
      html: '<section id="governance-control-plane-card"></section>',
      governanceSnapshot: governanceFixture(),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'web:tenant-team-ops-card', status: 'fail' }),
    ]));
  });

  it('fails when governance loses a required policy surface', () => {
    const governance = governanceFixture({
      surfaces: governanceFixture().surfaces.filter((surface) => surface.id !== 'teams'),
    });
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      governanceSnapshot: governance,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'governance:required-surfaces', status: 'fail' }),
    ]));
  });

  it('fails when a shared tenant has no guided permission action', () => {
    const governance = governanceFixture({
      sourceSnapshots: {
        ...governanceFixture().sourceSnapshots,
        tenants: {
          ...governanceFixture().sourceSnapshots.tenants,
          tenants: [
            {
              ...tenantFixture('telegram-shared'),
              actions: [],
            },
          ],
        },
      },
      summary: {
        ...governanceFixture().summary,
        tenants: 1,
        sharedTenants: 1,
        personalTenants: 0,
      },
    });
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      governanceSnapshot: governance,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'permission:segmented-readouts', status: 'fail' }),
    ]));
  });

  it('renders a human report and closes the cycle', () => {
    const service = new TenantTeamOpsService({
      packageJson: packageJsonFixture(),
      html: buildRuntimeShellHtml('/zavorthControl'),
      governanceSnapshot: governanceFixture(),
    });

    const report = service.renderReport();

    expect(report).toContain('Gate tenant-team-ops - Tenant/Team Ops');
    expect(report).toContain('next step recomendada: complete - Ciclo 39-45 closed');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  const scripts = Object.fromEntries(TENANT_TEAM_OPS_PACKAGE_SCRIPTS.map((scriptName) => [
    scriptName,
    scriptCommandFixture(scriptName),
  ]));
  return {
    scripts: {
      ...scripts,
      ...overrides,
    },
  };
}

function scriptCommandFixture(scriptName: string): string {
  const commands: Record<string, string> = {
    'ops:governance': 'npx tsx scripts/zavorth-governance.ts',
    'ops:governance:json': 'npx tsx scripts/zavorth-governance.ts --json',
    'tenant:ops': 'npx tsx scripts/tenant-team-ops.ts',
    'tenant:ops:json': 'npx tsx scripts/tenant-team-ops.ts --json',
    'qa:tenant-team-ops': 'npx tsx scripts/tenant-team-ops.ts --require-pass',
  };
  return commands[scriptName] || `npm run ${scriptName}`;
}

function tenantFixture(id: 'discord-public' | 'telegram-shared' | 'web-session-a') {
  const base = {
    tenantId: id,
    platform: id === 'web-session-a' ? 'web' : id === 'telegram-shared' ? 'telegram' : 'discord',
    boundary: id === 'web-session-a' ? 'personal' : 'shared',
    isolationMode: id === 'web-session-a' ? 'private' : 'tenant',
    onboardingStatus: id === 'discord-public' ? 'pending_onboarding' : 'internal',
    policyProfile: id === 'discord-public' ? 'discord-public' : 'runtime-default',
    publicServerMode: id === 'discord-public',
    scopeId: id === 'web-session-a' ? 'web:session-a' : `${id}:scope`,
    sessionId: id === 'web-session-a' ? 'session-a' : null,
    guildId: id === 'discord-public' ? 'guild-1' : null,
    channelId: id === 'telegram-shared' ? 'telegram:ops' : null,
    threadId: null,
    sourceUserId: 'operator',
    runtimeUserId: 'operator',
    ownerCount: id === 'web-session-a' ? 0 : 1,
    allowedGuildCount: id === 'discord-public' ? 1 : 0,
    allowedChannelCount: id === 'telegram-shared' ? 1 : 0,
    firstSeenAt: '2026-04-24T18:00:00.000Z',
    lastSeenAt: '2026-04-24T18:10:00.000Z',
    governanceStatus: id === 'discord-public' ? 'pending_onboarding' : id === 'web-session-a' ? 'personal' : 'ready',
    scopeLabel: id === 'discord-public' ? 'guild:guild-1' : id === 'telegram-shared' ? 'channel:telegram:ops' : 'session:session-a',
    operatorSummary: `${id} summary`,
    nextAction: id === 'discord-public' ? 'Configure owners and allowed channels.' : null,
    actions: [
      {
        id: 'inspect-tenant',
        label: 'Trazer /tenants',
        description: 'Inspecionar tenant.',
        command: `/tenants ${id}`,
        actionKind: 'guided',
        emphasis: 'primary',
      },
      {
        id: id === 'web-session-a' ? 'review-memoryplane' : 'review-teams',
        label: id === 'web-session-a' ? 'Revisar /memoryplane' : 'Revisar /teams',
        description: 'Revisar contexto.',
        command: id === 'web-session-a' ? '/memoryplane' : '/teams',
        actionKind: 'guided',
        emphasis: 'secondary',
      },
    ],
    recipe: null,
  };
  return base;
}

function governanceFixture(
  overrides: Partial<ZavorthGovernanceControlPlaneSnapshot> = {},
): ZavorthGovernanceControlPlaneSnapshot {
  const tenants = [
    tenantFixture('discord-public'),
    tenantFixture('telegram-shared'),
    tenantFixture('web-session-a'),
  ];
  const base: ZavorthGovernanceControlPlaneSnapshot = {
    generatedAt: '2026-04-24T18:20:00.000Z',
    workspaceRoot: 'C:/repo',
    summary: {
      posture: 'attention',
      tenants: 3,
      sharedTenants: 2,
      personalTenants: 1,
      pendingOnboarding: 1,
      restrictedShared: 0,
      publicServers: 1,
      teams: 2,
      pendingApprovals: 0,
      highRiskCapabilities: 0,
      mcpProfile: 'safe',
      trustedPlugins: 1,
      installedPlugins: 1,
      pairedNodes: 0,
      restrictedNodes: 0,
      readyChannels: 2,
      totalChannels: 3,
      remoteTransports: 0,
      remoteAttention: 0,
      decisions: 1,
    },
    surfaces: [
      {
        id: 'tenants',
        label: 'Tenant model',
        posture: 'attention',
        boundary: '2 shared / 1 personal',
        allowlistState: '1 public server(s), 0 restrito(s)',
        auditState: '2 recipe(s)',
        nextAction: 'Close onboarding.',
        command: '/tenants',
      },
      {
        id: 'channels',
        label: 'Channel policies',
        posture: 'healthy',
        boundary: '2/3 ready',
        allowlistState: '2/2 configurado(s) com group policy',
        auditState: '2 com sessions_send',
        nextAction: 'Revisar policy por channel.',
        command: '/channels',
      },
      {
        id: 'teams',
        label: 'Team surfaces',
        posture: 'healthy',
        boundary: '2 team(s)',
        allowlistState: '1 active(s), 1 retomavel(is)',
        auditState: 'Team catalog disponivel.',
        nextAction: 'Revisar workflows compostos.',
        command: '/teams',
      },
      {
        id: 'workspace',
        label: 'Workspace boundary',
        posture: 'healthy',
        boundary: 'C:/repo',
        allowlistState: 'workspace oficial',
        auditState: 'escopo usado pelo runtime',
        nextAction: 'Manter approvals.',
        command: null,
      },
    ],
    decisions: [],
    actions: [],
    sourceSnapshots: {
      tenants: {
        summary: {
          total: 3,
          shared: 2,
          personal: 1,
          pendingOnboarding: 1,
          publicServers: 1,
          readyShared: 1,
          restrictedShared: 0,
        },
        tenants,
        pendingOnboarding: [tenants[0]],
        featuredRecipes: [],
        narrative: {
          headline: 'Tenant governance with 3 tenant(s).',
          operatorSummary: '2 shareds.',
          nextAction: 'Close onboarding.',
        },
      },
      trust: {},
      channels: {},
      nodes: {},
      plugins: {},
      platform: {},
      transports: {},
      teams: {
        summary: {
          total: 2,
          active: 1,
          resumable: 1,
        },
      },
    },
    narrative: {
      headline: 'Governance: Tenancy, governance e policy',
      operatorSummary: 'Governance attention.',
      nextAction: 'Close onboarding.',
    },
  };

  return {
    ...base,
    ...overrides,
  };
}
