import { config } from '../config/index.js';
import type { ZavorthGovernanceControlPlaneSnapshot } from './ZavorthGovernanceControlPlaneService.js';
import { ZavorthGovernanceControlPlaneService } from './ZavorthGovernanceControlPlaneService.js';
import type { ZavorthTenantGovernanceEntry, ZavorthTenantGovernanceSnapshot } from './ZavorthTenantGovernanceService.js';
import { ZavorthTenantGovernanceService } from './ZavorthTenantGovernanceService.js';
import type { ZavorthTrustPlaneSnapshot } from './ZavorthTrustPlaneService.js';
import { ZavorthTrustPlaneService } from './ZavorthTrustPlaneService.js';
import {
  buildOverviewCard,
  buildOverviewNarrative,
  collectOverviewActions,
  countOverviewPostures,
  resolveOverviewPosture,
  text,
  type ControlPlaneOverviewAction,
  type ControlPlaneOverviewCard,
  type ControlPlaneOverviewNarrative,
  type ControlPlaneOverviewPosture,
} from '../domain/observability/infrastructure/control-plane/ControlPlaneOverviewKit.js';

type GovernanceLike = Pick<ZavorthGovernanceControlPlaneService, 'buildSnapshot'>;
type TrustPlaneLike = Pick<ZavorthTrustPlaneService, 'buildSnapshot'>;
type TenantGovernanceLike = Pick<ZavorthTenantGovernanceService, 'buildSnapshot'>;

type TrustOverviewRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  governanceControlPlaneService?: GovernanceLike | null;
  trustPlaneService?: TrustPlaneLike | null;
  tenantGovernanceService?: TenantGovernanceLike | null;
};

export type ZavorthTrustOverviewSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: ControlPlaneOverviewPosture;
    healthyPlanes: number;
    attentionPlanes: number;
    criticalPlanes: number;
    tenants: number;
    pendingOnboarding: number;
    restrictedShared: number;
    pendingApprovals: number;
    highRiskCapabilities: number;
    trustedPlugins: number;
    restrictedNodes: number;
    recommendedActions: number;
  };
  cards: ControlPlaneOverviewCard[];
  actions: ControlPlaneOverviewAction[];
  sourceSnapshots: {
    governance: ZavorthGovernanceControlPlaneSnapshot;
    trust: ZavorthTrustPlaneSnapshot;
    tenants: ZavorthTenantGovernanceSnapshot;
  };
  narrative: ControlPlaneOverviewNarrative;
};

export class ZavorthTrustOverviewService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly governance: GovernanceLike;
  private readonly trustPlane: TrustPlaneLike;
  private readonly tenantGovernance: TenantGovernanceLike;

  constructor(runtime: TrustOverviewRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.governance = runtime.governanceControlPlaneService || new ZavorthGovernanceControlPlaneService();
    this.trustPlane = runtime.trustPlaneService || new ZavorthTrustPlaneService();
    this.tenantGovernance = runtime.tenantGovernanceService || new ZavorthTenantGovernanceService();
  }

  public buildSnapshot(input: { limit?: number | null } = {}): ZavorthTrustOverviewSnapshot {
    const limit = this.normalizeLimit(input.limit);
    const governance = this.governance.buildSnapshot({ limit });
    const trust = this.trustPlane.buildSnapshot();
    const tenants = this.tenantGovernance.buildSnapshot({ limit });
    const cards = this.buildCards({ governance, trust, tenants });
    const actions = collectOverviewActions([
      { source: 'governance', actions: governance?.actions },
      { source: 'trust', actions: trust?.suggestedActions },
      {
        source: 'tenants',
        actions: Array.isArray(tenants?.pendingOnboarding)
          ? tenants.pendingOnboarding.slice(0, 3).map((entry: ZavorthTenantGovernanceEntry) => ({
            id: `tenant:${entry.tenantId}`,
            label: `Onboard tenant ${entry.tenantId}`,
            severity: 'warn',
            reason: entry?.operatorSummary || 'Tenant still depends on governed onboarding.',
            command: entry?.actions?.[0]?.command || '/tenants',
          }))
          : [],
      },
    ], limit);
    const counts = countOverviewPostures(cards);
    const posture = resolveOverviewPosture(cards.map((entry) => entry.posture));
    const summary = {
      posture,
      healthyPlanes: counts.healthy,
      attentionPlanes: counts.attention,
      criticalPlanes: counts.critical,
      tenants: Number(tenants?.summary?.total || governance?.summary?.tenants || 0) || 0,
      pendingOnboarding: Number(tenants?.summary?.pendingOnboarding || governance?.summary?.pendingOnboarding || 0) || 0,
      restrictedShared: Number(tenants?.summary?.restrictedShared || governance?.summary?.restrictedShared || 0) || 0,
      pendingApprovals: Number(trust?.summary?.pendingApprovals || governance?.summary?.pendingApprovals || 0) || 0,
      highRiskCapabilities:
        Number(trust?.summary?.highRiskCapabilities || governance?.summary?.highRiskCapabilities || 0) || 0,
      trustedPlugins: Number(trust?.summary?.trustedPlugins || governance?.summary?.trustedPlugins || 0) || 0,
      restrictedNodes: Number(trust?.summary?.restrictedNodes || governance?.summary?.restrictedNodes || 0) || 0,
      recommendedActions: actions.length,
    };
    const narrative = buildOverviewNarrative({
      headline: 'Trust Overview',
      operatorSummary:
        `${summary.tenants} tenant(s) observados, ${summary.pendingOnboarding} onboarding pending(s), `
        + `${summary.pendingApprovals} approval(s), ${summary.highRiskCapabilities} capability(s) de alto risk `
        + `e ${summary.restrictedNodes} node(s) restrito(s) no boundary current.`,
      actions,
      fallbackNextAction: 'review governance, trust plane and official tenancy.',
    });

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      cards,
      actions,
      sourceSnapshots: {
        governance,
        trust,
        tenants,
      },
      narrative,
    };
  }

  public evaluatePosture(input: { limit?: number | null } = {}): {
    posture: ControlPlaneOverviewPosture;
    healthyPlanes: number;
    attentionPlanes: number;
    criticalPlanes: number;
  } {
    const snapshot = this.buildSnapshot(input);
    return {
      posture: snapshot.summary.posture,
      healthyPlanes: snapshot.summary.healthyPlanes,
      attentionPlanes: snapshot.summary.attentionPlanes,
      criticalPlanes: snapshot.summary.criticalPlanes,
    };
  }

  public listActions(input: { limit?: number | null } = {}): ControlPlaneOverviewAction[] {
    return this.buildSnapshot(input).actions;
  }

  public renderReport(input: { limit?: number | null } = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      snapshot.narrative.headline,
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Planes: healthy ${snapshot.summary.healthyPlanes} | attention ${snapshot.summary.attentionPlanes} | critical ${snapshot.summary.criticalPlanes}.`,
      `Tenants: ${snapshot.summary.tenants} | pending onboarding ${snapshot.summary.pendingOnboarding} | restricted shared ${snapshot.summary.restrictedShared}.`,
      `Trust: approvals ${snapshot.summary.pendingApprovals} | high-risk capabilities ${snapshot.summary.highRiskCapabilities} | trusted plugins ${snapshot.summary.trustedPlugins} | restricted nodes ${snapshot.summary.restrictedNodes}.`,
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Suggested actions:',
        ...snapshot.actions.map((entry) =>
          `- [${entry.source}] ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private buildCards(input: {
    governance: ZavorthGovernanceControlPlaneSnapshot;
    trust: ZavorthTrustPlaneSnapshot;
    tenants: ZavorthTenantGovernanceSnapshot;
  }): ControlPlaneOverviewCard[] {
    return [
      buildOverviewCard({
        id: 'governance',
        label: 'Governance Plane',
        posture: input.governance?.summary?.posture,
        summary:
          `${Number(input.governance?.summary?.tenants || 0) || 0} tenant(s) | `
          + `${Number(input.governance?.summary?.pendingApprovals || 0) || 0} approval(s) | `
          + `${Number(input.governance?.summary?.decisions || 0) || 0} decision(s).`,
        nextAction: input.governance?.narrative?.nextAction,
        command: input.governance?.actions?.[0]?.command,
        source: 'governance',
      }),
      buildOverviewCard({
        id: 'trust-plane',
        label: 'Trust Plane',
        posture: input.trust?.summary?.posture,
        summary:
          `${Number(input.trust?.summary?.pendingApprovals || 0) || 0} approval(s) | `
          + `${Number(input.trust?.summary?.highRiskCapabilities || 0) || 0} capability(s) de alto risk | `
          + `MCP ${text(input.trust?.summary?.mcpProfile, 'safe')}.`,
        nextAction: input.trust?.suggestedActions?.[0]?.label || 'review trust boundary and kill switch.',
        command: input.trust?.suggestedActions?.[0]?.command,
        source: 'trust',
      }),
      buildOverviewCard({
        id: 'tenant-governance',
        label: 'Tenant Governance',
        posture: (Number(input.tenants?.summary?.pendingOnboarding || 0) || 0) > 0 ? 'attention' : 'healthy',
        summary:
          `${Number(input.tenants?.summary?.total || 0) || 0} tenant(s) | `
          + `${Number(input.tenants?.summary?.pendingOnboarding || 0) || 0} onboarding pending(s) | `
          + `${Number(input.tenants?.summary?.restrictedShared || 0) || 0} restricted shared.`,
        nextAction: input.tenants?.narrative?.nextAction,
        command: input.tenants?.pendingOnboarding?.[0]?.actions?.[0]?.command || '/tenants',
        source: 'tenants',
      }),
    ];
  }

  private normalizeLimit(value: number | null | undefined): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 8;
    }
    return Math.max(3, Math.min(16, Math.floor(numeric)));
  }
}
