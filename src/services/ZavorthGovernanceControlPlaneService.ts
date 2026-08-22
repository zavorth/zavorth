import { config } from '../config/index.js';
import { McpToolPolicy } from '../mcp/McpToolPolicy.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { ZavorthRemoteTransportService } from './ZavorthRemoteTransportService.js';
import { ZavorthSecurityMeshService } from './ZavorthSecurityMeshService.js';
import { ZavorthTeamCatalogService } from './ZavorthTeamCatalogService.js';
import { ZavorthTenantGovernanceService } from './ZavorthTenantGovernanceService.js';
import { ZavorthTrustPlaneService } from './ZavorthTrustPlaneService.js';
import { McpCapabilityControlPlaneService } from './McpCapabilityControlPlaneService.js';
import { SkillTrustPolicyService } from './SkillTrustPolicyService.js';

export type ZavorthGovernancePosture = 'healthy' | 'attention' | 'critical';
export type ZavorthGovernanceDecisionSeverity = 'info' | 'warn' | 'critical';

type SnapshotLike = {
  buildSnapshot: (input?: GovernanceCompatPayload) => GovernanceCompatPayload;
};

// Compatibility payload: accepts any service snapshot shape for cross-service wiring.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GovernanceCompatPayload = any;

type GovernanceRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  tenantGovernanceService?: SnapshotLike | null;
  trustPlaneService?: SnapshotLike | null;
  channelMeshService?: SnapshotLike | null;
  nodeMeshService?: SnapshotLike | null;
  remoteTransportService?: SnapshotLike | null;
  pluginRegistryService?: SnapshotLike | null;
  platformRegistryService?: SnapshotLike | null;
  teamCatalogService?: SnapshotLike | null;
};

export type ZavorthGovernancePolicySurface = {
  id: 'tenants' | 'trust' | 'channels' | 'nodes' | 'plugins' | 'platform' | 'transports' | 'teams' | 'workspace';
  label: string;
  posture: ZavorthGovernancePosture;
  boundary: string;
  allowlistState: string;
  auditState: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthGovernanceTrustDecision = {
  id: string;
  surface: ZavorthGovernancePolicySurface['id'];
  label: string;
  severity: ZavorthGovernanceDecisionSeverity;
  decision: 'allow' | 'ask' | 'deny' | 'defer' | 'audit';
  rationale: string;
  command: string | null;
};

export type ZavorthGovernanceControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: ZavorthGovernancePosture;
    tenants: number;
    sharedTenants: number;
    personalTenants: number;
    pendingOnboarding: number;
    restrictedShared: number;
    publicServers: number;
    teams: number;
    pendingApprovals: number;
    highRiskCapabilities: number;
    mcpProfile: string;
    trustedPlugins: number;
    installedPlugins: number;
    pairedNodes: number;
    restrictedNodes: number;
    readyChannels: number;
    totalChannels: number;
    remoteTransports: number;
    remoteAttention: number;
    decisions: number;
  };
  surfaces: ZavorthGovernancePolicySurface[];
  decisions: ZavorthGovernanceTrustDecision[];
  actions: Array<{
    id: string;
    label: string;
    severity: ZavorthGovernanceDecisionSeverity;
    command: string | null;
    reason: string;
  }>;
  sourceSnapshots: {
    tenants: GovernanceCompatPayload;
    trust: GovernanceCompatPayload;
    channels: GovernanceCompatPayload;
    nodes: GovernanceCompatPayload;
    plugins: GovernanceCompatPayload;
    platform: GovernanceCompatPayload;
    transports: GovernanceCompatPayload;
    teams: GovernanceCompatPayload;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthGovernanceControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly tenantGovernance: SnapshotLike;
  private readonly trustPlane: SnapshotLike;
  private readonly channels: SnapshotLike;
  private readonly nodes: SnapshotLike;
  private readonly transports: SnapshotLike;
  private readonly plugins: SnapshotLike;
  private readonly platform: SnapshotLike;
  private readonly teams: SnapshotLike;

  constructor(runtime: GovernanceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim() || process.cwd();
    this.tenantGovernance = runtime.tenantGovernanceService || new ZavorthTenantGovernanceService();
    this.channels = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.nodes = runtime.nodeMeshService || new ZavorthNodeMeshService();
    this.plugins = runtime.pluginRegistryService || new ZavorthPluginRegistryService();
    this.platform = runtime.platformRegistryService || new ZavorthPlatformRegistryService();
    this.transports = runtime.remoteTransportService || new ZavorthRemoteTransportService({
      nodeMeshService: this.nodes as GovernanceCompatPayload,
    });
    this.teams = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.trustPlane =
      runtime.trustPlaneService ||
      new ZavorthTrustPlaneService({
        securityMeshService: new ZavorthSecurityMeshService(),
        mcpToolPolicy: McpToolPolicy.fromEnv(),
        mcpCapabilityControlPlaneService: new McpCapabilityControlPlaneService(),
        skillTrustPolicyService: new SkillTrustPolicyService(),
        pluginRegistryService: this.plugins as GovernanceCompatPayload,
        nodeMeshService: this.nodes as GovernanceCompatPayload,
      });
  }

  public buildSnapshot(input: { limit?: number | null } = {}): ZavorthGovernanceControlPlaneSnapshot {
    const limit = this.normalizeLimit(input.limit);
    const tenants = this.tenantGovernance.buildSnapshot({ limit });
    const trust = this.trustPlane.buildSnapshot();
    const channels = this.channels.buildSnapshot();
    const nodes = this.nodes.buildSnapshot();
    const plugins = this.plugins.buildSnapshot();
    const platform = this.platform.buildSnapshot();
    const transports = this.transports.buildSnapshot();
    const teams = this.teams.buildSnapshot({ workspace: this.workspaceRoot });
    const decisions = this.buildDecisions({
      tenants,
      trust,
      channels,
      nodes,
      plugins,
      platform,
      transports,
      teams,
    });
    const surfaces = this.buildSurfaces({
      tenants,
      trust,
      channels,
      nodes,
      plugins,
      platform,
      transports,
      teams,
      decisions,
    });
    const posture = this.resolvePosture(surfaces, decisions);
    const actions = this.buildActions(decisions, surfaces);

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary: {
        posture,
        tenants: Number(tenants?.summary?.total || 0) || 0,
        sharedTenants: Number(tenants?.summary?.shared || 0) || 0,
        personalTenants: Number(tenants?.summary?.personal || 0) || 0,
        pendingOnboarding: Number(tenants?.summary?.pendingOnboarding || 0) || 0,
        restrictedShared: Number(tenants?.summary?.restrictedShared || 0) || 0,
        publicServers: Number(tenants?.summary?.publicServers || 0) || 0,
        teams: Number(teams?.summary?.total || 0) || 0,
        pendingApprovals: Number(trust?.summary?.pendingApprovals || 0) || 0,
        highRiskCapabilities: Number(trust?.summary?.highRiskCapabilities || 0) || 0,
        mcpProfile: this.text(trust?.summary?.mcpProfile, 'safe'),
        trustedPlugins: Number(plugins?.summary?.trusted || trust?.summary?.trustedPlugins || 0) || 0,
        installedPlugins: Number(plugins?.summary?.installed || trust?.summary?.installedPlugins || 0) || 0,
        pairedNodes: Number(nodes?.summary?.paired || trust?.summary?.pairedNodes || 0) || 0,
        restrictedNodes: this.countRestrictedNodes(nodes),
        readyChannels: Number(channels?.summary?.ready || 0) || 0,
        totalChannels: Number(channels?.summary?.total || 0) || 0,
        remoteTransports: Number(transports?.summary?.total || 0) || 0,
        remoteAttention: this.countRemoteAttention(transports),
        decisions: decisions.length,
      },
      surfaces,
      decisions,
      actions,
      sourceSnapshots: {
        tenants,
        trust,
        channels,
        nodes,
        plugins,
        platform,
        transports,
        teams,
      },
      narrative: {
        headline: 'Governance: Tenancy, governance e policy',
        operatorSummary: this.buildOperatorSummary({ tenants, trust, channels, nodes, plugins, transports, teams, posture }),
        nextAction: actions[0]?.label || 'review periodicamente tenants, trust decisions e allowlists por surface.',
      },
    };
  }

  public renderReport(input: { limit?: number | null } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Governance: Tenancy, governance e policy',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Tenants: ${snapshot.summary.tenants} | compartilhados: ${snapshot.summary.sharedTenants} | onboarding pending: ${snapshot.summary.pendingOnboarding} | restritos: ${snapshot.summary.restrictedShared}.`,
      `Trust: ${snapshot.summary.pendingApprovals} approval(s), ${snapshot.summary.highRiskCapabilities} capability(s) sensitive e MCP ${snapshot.summary.mcpProfile}.`,
      `Surfaces: ${snapshot.summary.readyChannels}/${snapshot.summary.totalChannels} channel(s) ready, ${snapshot.summary.pairedNodes} node(s) paired(s), ${snapshot.summary.remoteAttention} transport(s) needing attention real.`,
      '',
      'surfaces de policy:',
      ...snapshot.surfaces.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.boundary} | ${entry.allowlistState} | ${entry.nextAction}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.decisions.length > 0) {
      lines.push(
        '',
        'Trust decisions:',
        ...snapshot.decisions.slice(0, 8).map((entry) =>
          `- [${entry.decision}] ${entry.label}: ${entry.rationale}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Actions sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private buildSurfaces(input: {
    tenants: GovernanceCompatPayload;
    trust: GovernanceCompatPayload;
    channels: GovernanceCompatPayload;
    nodes: GovernanceCompatPayload;
    plugins: GovernanceCompatPayload;
    platform: GovernanceCompatPayload;
    transports: GovernanceCompatPayload;
    teams: GovernanceCompatPayload;
    decisions: ZavorthGovernanceTrustDecision[];
  }): ZavorthGovernancePolicySurface[] {
    const surfacePosture = (id: ZavorthGovernancePolicySurface['id']): ZavorthGovernancePosture =>
      this.resolvePosture([], input.decisions.filter((entry) => entry.surface === id));
    const channelConfigured = Array.isArray(input.channels?.entries)
      ? input.channels.entries.filter((entry: GovernanceCompatPayload) => entry?.configured === true).length
      : 0;
    const channelGroupPolicy = Number(input.channels?.summary?.groupPolicy || 0) || 0;
    const channelGroupPolicyScoped = channelConfigured > 0
      ? Math.min(channelGroupPolicy, channelConfigured)
      : channelGroupPolicy;
    const installedPlugins = Number(input.plugins?.summary?.installed || 0) || 0;
    const trustedPlugins = Number(input.plugins?.summary?.trusted || 0) || 0;
    const platformReviewPending = Number(input.platform?.summary?.reviewPending || 0) || 0;
    const nodeRestricted = this.countRestrictedNodes(input.nodes);
    const remoteAttention = this.countRemoteAttention(input.transports);

    return [
      {
        id: 'tenants',
        label: 'Tenant model',
        posture: surfacePosture('tenants'),
        boundary: `${Number(input.tenants?.summary?.shared || 0)} shared / ${Number(input.tenants?.summary?.personal || 0)} personal`,
        allowlistState: `${Number(input.tenants?.summary?.publicServers || 0)} public server(s), ${Number(input.tenants?.summary?.restrictedShared || 0)} restrito(s)`,
        auditState: `${Number(input.tenants?.featuredRecipes?.length || 0)} recipe(s) de governanca`,
        nextAction: this.text(input.tenants?.narrative?.nextAction, 'Observar novos tenants before enable automations.'),
        command: '/tenants',
      },
      {
        id: 'trust',
        label: 'Trust plane',
        posture: surfacePosture('trust'),
        boundary: this.text(input.trust?.surfaces?.runtime?.trustBoundary, 'runtime-default'),
        allowlistState: `MCP ${this.text(input.trust?.summary?.mcpProfile, 'safe')} | skills ${this.text(input.trust?.summary?.skillDefaultPolicy, 'deny')}`,
        auditState: `${Number(input.trust?.summary?.pendingApprovals || 0)} approval(s) pending(s)`,
        nextAction: 'review approvals, profile MCP e capabilities sensitive.',
        command: '/runtime',
      },
      {
        id: 'channels',
        label: 'Channel policies',
        posture: surfacePosture('channels'),
        boundary: `${Number(input.channels?.summary?.ready || 0)}/${Number(input.channels?.summary?.total || 0)} ready`,
        allowlistState: `${channelGroupPolicyScoped}/${channelConfigured} configured(s) com group policy`,
        auditState: `${Number(input.channels?.summary?.sessionSendReady || 0)} com sessions_send`,
        nextAction: 'review policy by channel before promoting new groups/workspaces.',
        command: '/channels',
      },
      {
        id: 'nodes',
        label: 'Node allowlists',
        posture: surfacePosture('nodes'),
        boundary: `${Number(input.nodes?.summary?.paired || 0)} paired(s) / ${Number(input.nodes?.summary?.online || 0)} online`,
        allowlistState: `${nodeRestricted} node(s) with restricted allowlists`,
        auditState: `${Number(input.nodes?.summary?.staleQueued || 0)} queue(s) stale`,
        nextAction: nodeRestricted > 0 ? 'review approved capabilities por node.' : 'Manter heartbeat e allowlist por node sob review.',
        command: '/nodes',
      },
      {
        id: 'plugins',
        label: 'Plugin trust',
        posture: surfacePosture('plugins'),
        boundary: `${installedPlugins} installed`,
        allowlistState: `${trustedPlugins}/${installedPlugins} trusted`,
        auditState: `${Number(input.plugins?.summary?.catalogBacked || 0)} catalog-backed`,
        nextAction: trustedPlugins < installedPlugins ? 'review plugins instalados ainda without trusted.' : 'Manter provenance e trust por plugin.',
        command: '/plugins',
      },
      {
        id: 'platform',
        label: 'Platform registry',
        posture: surfacePosture('platform'),
        boundary: `${Number(input.platform?.summary?.total || 0)} entry(s)`,
        allowlistState: `${Number(input.platform?.summary?.trusted || 0)} trusted | ${platformReviewPending} review`,
        auditState: this.text(input.platform?.catalogSync?.status, 'local'),
        nextAction: platformReviewPending > 0 ? 'review entradas do registry at review.' : 'Keep optional sync and origin policy.',
        command: '/platform',
      },
      {
        id: 'transports',
        label: 'Remote transports',
        posture: surfacePosture('transports'),
        boundary: `${Number(input.transports?.summary?.ready || 0)}/${Number(input.transports?.summary?.total || 0)} ready`,
        allowlistState: `${remoteAttention} com error ou queue pending`,
        auditState: `${Number(input.transports?.summary?.pendingWork || 0)} item(s) pending(s)`,
        nextAction: remoteAttention > 0 ? 'Run doctor/recover on transports with error or queue.' : 'Keep optional transports as backlog, not incident.',
        command: '/transports',
      },
      {
        id: 'teams',
        label: 'Team surfaces',
        posture: surfacePosture('teams'),
        boundary: `${Number(input.teams?.summary?.total || 0)} team(s)`,
        allowlistState: `${Number(input.teams?.summary?.active || 0)} active(s), ${Number(input.teams?.summary?.resumable || 0)} retomavel(is)`,
        auditState: this.text(input.teams?.narrative?.headline, 'Team catalog available.'),
        nextAction: 'review allowed surfaces before triggering composite workflows in shared tenants.',
        command: '/teams',
      },
      {
        id: 'workspace',
        label: 'Workspace boundary',
        posture: 'healthy',
        boundary: this.workspaceRoot,
        allowlistState: 'workspace oficial do runtime current',
        auditState: 'escopo usado por /app, CLI e governance control plane',
        nextAction: 'Keep mutable commands behind Execution Gateway and approvals.',
        command: null,
      },
    ];
  }

  private buildDecisions(input: {
    tenants: GovernanceCompatPayload;
    trust: GovernanceCompatPayload;
    channels: GovernanceCompatPayload;
    nodes: GovernanceCompatPayload;
    plugins: GovernanceCompatPayload;
    platform: GovernanceCompatPayload;
    transports: GovernanceCompatPayload;
    teams: GovernanceCompatPayload;
  }): ZavorthGovernanceTrustDecision[] {
    const decisions: ZavorthGovernanceTrustDecision[] = [];
    const push = (entry: ZavorthGovernanceTrustDecision) => {
      if (!decisions.some((candidate) => candidate.id === entry.id)) {
        decisions.push(entry);
      }
    };

    if (Number(input.tenants?.summary?.restrictedShared || 0) > 0) {
      push({
        id: 'tenant-restricted-shared',
        surface: 'tenants',
        label: 'Tenant compartilhado fail-closed',
        severity: 'critical',
        decision: 'deny',
        rationale: `${input.tenants.summary.restrictedShared} tenant(s) public tenant(s) still lack enough channel allowlist.`,
        command: '/tenants',
      });
    }
    if (Number(input.tenants?.summary?.pendingOnboarding || 0) > 0) {
      push({
        id: 'tenant-onboarding',
        surface: 'tenants',
        label: 'Onboarding de tenant pending',
        severity: 'warn',
        decision: 'ask',
        rationale: `${input.tenants.summary.pendingOnboarding} tenant(s) need owner scope, policy profile, or allowlist before broad automation.`,
        command: '/tenants',
      });
    }

    if (input.trust?.summary?.killSwitchActive === true) {
      push({
        id: 'kill-switch-active',
        surface: 'trust',
        label: 'Kill switch active',
        severity: 'critical',
        decision: 'deny',
        rationale: 'O supervised host is bloqueando new actions ate review manual.',
        command: '/runtime',
      });
    }
    if (Number(input.trust?.summary?.pendingApprovals || 0) > 0) {
      push({
        id: 'pending-approvals',
        surface: 'trust',
        label: 'Approvals pending',
        severity: 'warn',
        decision: 'ask',
        rationale: `${input.trust.summary.pendingApprovals} approval(s) aguardam decision humana.`,
        command: '/perm pending',
      });
    }
    if (this.text(input.trust?.summary?.mcpProfile, 'safe') !== 'safe') {
      push({
        id: 'mcp-profile-promoted',
        surface: 'trust',
        label: 'MCP acima de safe',
        severity: this.text(input.trust?.summary?.mcpProfile, 'safe') === 'dangerous' ? 'critical' : 'warn',
        decision: 'audit',
        rationale: `Perfil MCP current: ${this.text(input.trust?.summary?.mcpProfile, 'safe')}.`,
        command: 'npm run mcp:browser:doctor',
      });
    }
    if (this.text(input.trust?.summary?.skillDefaultPolicy, 'deny') === 'allow') {
      push({
        id: 'skills-default-allow',
        surface: 'trust',
        label: 'Skills liberadas por default',
        severity: 'critical',
        decision: 'audit',
        rationale: 'A policy de skills at allow amplia a surface de trust para fontes new.',
        command: 'config/skill-allowlist.json',
      });
    }

    const installedPlugins = Number(input.plugins?.summary?.installed || 0) || 0;
    const trustedPlugins = Number(input.plugins?.summary?.trusted || 0) || 0;
    if (installedPlugins > trustedPlugins) {
      push({
        id: 'plugins-untrusted-installed',
        surface: 'plugins',
        label: 'Plugins instalados without trusted',
        severity: 'warn',
        decision: 'audit',
        rationale: `${installedPlugins - trustedPlugins} plugin(s) installed are not trusted yet.`,
        command: '/plugins review',
      });
    }

    const platformReviewPending = Number(input.platform?.summary?.reviewPending || 0) || 0;
    if (platformReviewPending > 0 && input.platform?.catalogSync?.sourceTrusted !== false) {
      push({
        id: 'platform-review-pending',
        surface: 'platform',
        label: 'Registry com review pending',
        severity: 'warn',
        decision: 'defer',
        rationale: `${platformReviewPending} entry(s) de platform ainda pedunder review.`,
        command: '/platform',
      });
    }

    const configuredChannelsWithoutGroupPolicy = this.countConfiguredChannelsWithoutGroupPolicy(input.channels);
    if (configuredChannelsWithoutGroupPolicy > 0) {
      push({
        id: 'channels-group-policy-review',
        surface: 'channels',
        label: 'Canais configurados without group policy',
        severity: 'info',
        decision: 'audit',
        rationale: `${configuredChannelsWithoutGroupPolicy} channel(s) configured(s) ainda merecunder review de escopo por grupo/thread/workspace.`,
        command: '/channels',
      });
    }

    const restrictedNodes = this.countRestrictedNodes(input.nodes);
    if (restrictedNodes > 0) {
      push({
        id: 'node-allowlist-restricted',
        surface: 'nodes',
        label: 'Nodes with restricted allowlists',
        severity: 'info',
        decision: 'defer',
        rationale: `${restrictedNodes} node(s) are pareados com parte das approved capabilities.`,
        command: '/nodes',
      });
    }

    const remoteAttention = this.countRemoteAttention(input.transports);
    if (remoteAttention > 0) {
      push({
        id: 'remote-transport-attention',
        surface: 'transports',
        label: 'Transportes com error ou queue',
        severity: 'warn',
        decision: 'audit',
        rationale: `${remoteAttention} remote transport(s) has recent errors or pending work.`,
        command: '/transports',
      });
    }

    if (Number(input.teams?.summary?.active || 0) > 0 && Number(input.tenants?.summary?.shared || 0) > 0) {
      push({
        id: 'team-surface-audit',
        surface: 'teams',
        label: 'Workflows compostos at tenants compartilhados',
        severity: 'info',
        decision: 'audit',
        rationale: 'Active teams must keep surface availability aligned with observed tenants.',
        command: '/teams',
      });
    }

    return decisions.slice(0, 16);
  }

  private buildActions(
    decisions: ZavorthGovernanceTrustDecision[],
    surfaces: ZavorthGovernancePolicySurface[],
  ): ZavorthGovernanceControlPlaneSnapshot['actions'] {
    const actions = decisions
      .filter((entry) => entry.severity === 'critical' || entry.severity === 'warn')
      .map((entry) => ({
        id: `decision:${entry.id}`,
        label: entry.label,
        severity: entry.severity,
        command: entry.command,
        reason: entry.rationale,
      }));
    if (actions.length > 0) {
      return actions.slice(0, 8);
    }
    return surfaces
      .filter((entry) => entry.command)
      .slice(0, 3)
      .map((entry) => ({
        id: `surface:${entry.id}`,
        label: `review ${entry.label}`,
        severity: 'info' as const,
        command: entry.command,
        reason: entry.nextAction,
      }));
  }

  private buildOperatorSummary(input: {
    tenants: GovernanceCompatPayload;
    trust: GovernanceCompatPayload;
    channels: GovernanceCompatPayload;
    nodes: GovernanceCompatPayload;
    plugins: GovernanceCompatPayload;
    transports: GovernanceCompatPayload;
    teams: GovernanceCompatPayload;
    posture: ZavorthGovernancePosture;
  }): string {
    return [
      `Governance ${input.posture}.`,
      `${Number(input.tenants?.summary?.shared || 0)} tenant(s) compartilhado(s), ${Number(input.tenants?.summary?.pendingOnboarding || 0)} onboarding pending e ${Number(input.tenants?.summary?.restrictedShared || 0)} restrito(s).`,
      `Trust plane com MCP ${this.text(input.trust?.summary?.mcpProfile, 'safe')}, ${Number(input.trust?.summary?.pendingApprovals || 0)} approval(s) e ${Number(input.trust?.summary?.highRiskCapabilities || 0)} capability(s) sensitive.`,
      `${Number(input.channels?.summary?.ready || 0)}/${Number(input.channels?.summary?.total || 0)} channel(s) ready, ${Number(input.nodes?.summary?.paired || 0)} node(s) paired(s), ${Number(input.plugins?.summary?.trusted || 0)}/${Number(input.plugins?.summary?.installed || 0)} plugin(s) trusted.`,
      `${this.countRemoteAttention(input.transports)} transport(s) remote(s) com error/queue e ${Number(input.teams?.summary?.total || 0)} team(s) catalogado(s).`,
    ].join(' ');
  }

  private resolvePosture(
    surfaces: ZavorthGovernancePolicySurface[],
    decisions: ZavorthGovernanceTrustDecision[],
  ): ZavorthGovernancePosture {
    if (decisions.some((entry) => entry.severity === 'critical') || surfaces.some((entry) => entry.posture === 'critical')) {
      return 'critical';
    }
    if (decisions.some((entry) => entry.severity === 'warn') || surfaces.some((entry) => entry.posture === 'attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private normalizeLimit(limit: number | null | undefined): number {
    const numeric = Number(limit || 8);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 8;
    }
    return Math.max(1, Math.min(24, Math.floor(numeric)));
  }

  private countRestrictedNodes(nodeSnapshot: GovernanceCompatPayload): number {
    const entries = Array.isArray(nodeSnapshot?.entries) ? nodeSnapshot.entries : [];
    return entries.filter((entry: GovernanceCompatPayload) => {
      const approved = Number(entry?.approvedCapabilityIds?.length || 0);
      const capabilities = Number(entry?.capabilityIds?.length || 0);
      return approved > 0 && approved < capabilities;
    }).length;
  }

  private countRemoteAttention(transportSnapshot: GovernanceCompatPayload): number {
    const entries = Array.isArray(transportSnapshot?.entries) ? transportSnapshot.entries : [];
    return entries.filter((entry: GovernanceCompatPayload) =>
      Number(entry?.telemetry?.pendingWork || 0) > 0 || Boolean(this.text(entry?.telemetry?.lastError, '')),
    ).length;
  }

  private countConfiguredChannelsWithoutGroupPolicy(channelSnapshot: GovernanceCompatPayload): number {
    const entries = Array.isArray(channelSnapshot?.entries) ? channelSnapshot.entries : [];
    return entries.filter((entry: GovernanceCompatPayload) =>
      entry?.configured === true
      && entry?.readiness !== 'planned'
      && entry?.readiness !== 'disabled'
      && entry?.features?.groupPolicy !== true,
    ).length;
  }

  private text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
