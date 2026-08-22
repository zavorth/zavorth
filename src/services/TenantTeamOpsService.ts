import { buildRuntimeShellHtml } from '../domain/surface/presentation/web-console/WebConsoleRuntimeShellHtml.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  TENANT_TEAM_OPS_CONTRACTS,
  TENANT_TEAM_OPS_PACKAGE_SCRIPTS,
  TENANT_TEAM_OPS_REQUIRED_SURFACES,
  TENANT_TEAM_OPS_WEB_MARKERS,
  type TenantTeamOpsCheck,
  type TenantTeamOpsCheckStatus,
  type TenantTeamOpsIdentityScope,
  type TenantTeamOpsIsolationEntry,
  type TenantTeamOpsPermissionReadout,
  type TenantTeamOpsPolicyScope,
  type TenantTeamOpsProjectReport,
  type TenantTeamOpsSnapshot,
  type TenantTeamOpsSource,
} from '../contracts/TenantTeamOpsContract.js';

import { logger } from '../logger.js';
import {
ZavorthGovernanceControlPlaneService,
  type ZavorthGovernanceControlPlaneSnapshot,
} from './ZavorthGovernanceControlPlaneService.js';

type PackageLike = {
  scripts?: Record<string, string>;
};

type GovernanceLike = Pick<ZavorthGovernanceControlPlaneService, 'buildSnapshot'>;

type TenantTeamOpsGovernanceTenant = {
  tenantId?: string;
  platform?: string;
  boundary?: string;
  scopeLabel?: string;
  scopeId?: string;
  policyProfile?: string;
  governanceStatus?: string;
  ownerCount?: number;
  allowedGuildCount?: number;
  allowedChannelCount?: number;
  publicServerMode?: boolean;
  actions?: Array<{ actionKind?: string }>;
  nextAction?: string;
};

export type TenantTeamOpsServiceOptions = {
  projectRoot?: string;
  packageJson?: PackageLike;
  html?: string;
  governanceSnapshot?: ZavorthGovernanceControlPlaneSnapshot;
  governanceControlPlane?: GovernanceLike;
  existsSync?: (targetPath: string) => boolean;
  readFileSync?: (targetPath: string, encoding: BufferEncoding) => string;
  now?: () => Date;
};

export class TenantTeamOpsService {
  private readonly projectRoot: string;
  private readonly packageJson: PackageLike | null;
  private readonly html: string | null;
  private readonly governanceSnapshot: ZavorthGovernanceControlPlaneSnapshot | null;
  private readonly governanceControlPlane: GovernanceLike;
  private readonly existsSync: (targetPath: string) => boolean;
  private readonly readFileSync: (targetPath: string, encoding: BufferEncoding) => string;
  private readonly now: () => Date;

  constructor(options: TenantTeamOpsServiceOptions = {}) {
    this.projectRoot = options.projectRoot || config.projectRoot;
    this.packageJson = options.packageJson || null;
    this.html = Object.prototype.hasOwnProperty.call(options, 'html') ? options.html || '' : null;
    this.governanceSnapshot = options.governanceSnapshot || null;
    this.governanceControlPlane = options.governanceControlPlane || new ZavorthGovernanceControlPlaneService({
      workspaceRoot: this.projectRoot,
    });
    this.existsSync = options.existsSync || fs.existsSync;
    this.readFileSync = options.readFileSync || ((targetPath, encoding) => fs.readFileSync(targetPath, encoding));
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: { limit?: number } = {}): TenantTeamOpsSnapshot {
    const limit = Math.max(1, Math.min(Number(input.limit || 12), 50));
    const governance = this.governanceSnapshot || this.governanceControlPlane.buildSnapshot({ limit });
    const identityScopes = this.buildIdentityScopes(governance, limit);
    const policyScopes = this.buildPolicyScopes(governance);
    const permissionReadouts = this.buildPermissionReadouts(governance, identityScopes, limit);
    const projectReports = this.buildProjectReports(governance, identityScopes);
    const isolationMap = this.buildIsolationMap(identityScopes);
    const checks = [
      ...this.checkPackageScripts(),
      this.checkWebMarkers(),
      this.checkGovernanceSurfaces(governance, policyScopes),
      this.checkIdentityScopes(identityScopes),
      this.checkPolicyScopes(policyScopes),
      this.checkPermissionReadouts(permissionReadouts),
      this.checkProjectReports(projectReports),
      this.checkIsolationMap(isolationMap),
      this.checkQuietGate(),
    ];
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'tenant-team-ops',
      surface: 'tenant-team-ops',
      generatedAt: this.now().toISOString(),
      status: failed > 0 ? 'blocked' : warnings > 0 ? 'attention' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
        tenants: identityScopes.length,
        sharedTenants: identityScopes.filter((entry) => entry.boundary === 'shared').length,
        personalTenants: identityScopes.filter((entry) => entry.boundary !== 'shared').length,
        teams: Number(governance.summary.teams || 0) || 0,
        policyScopes: policyScopes.length,
        permissionReadouts: permissionReadouts.length,
        isolatedContexts: isolationMap.length,
        heavyRuntimesStarted: false,
      },
      ops: {
        identityScopes,
        policyScopes,
        permissionReadouts,
        projectReports,
        isolationMap,
      },
      checks,
      contracts: TENANT_TEAM_OPS_CONTRACTS,
      commands: {
        inspect: 'npm run tenant:ops',
        json: 'npm run tenant:ops:json',
        gate: 'npm run qa:tenant-team-ops',
        governance: 'npm run ops:governance',
        tenants: 'zavorth tenants',
      },
      nextRecommendedGate: {
        phase: 'complete',
        title: 'Ciclo 39-45 closed',
        reason:
          'Com Tenant/Team Ops implementado, o ciclo Product Quality, Web/App Polish, QA, Release, Artifact/Replay, Idle Budget e Tenant Ops fica completo.',
      },
    };
  }

  public renderReport(snapshot: TenantTeamOpsSnapshot = this.buildSnapshot()): string {
    const lines: string[] = [];
    lines.push('[tenant-team-ops] Tenant/Team Ops');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`tenants=${snapshot.summary.tenants} shared=${snapshot.summary.sharedTenants} personal=${snapshot.summary.personalTenants} teams=${snapshot.summary.teams} scopes=${snapshot.summary.policyScopes}`);
    lines.push('');
    for (const check of snapshot.checks) {
      lines.push(`[${check.status}] ${check.title} (${check.source})`);
      lines.push(`  ${check.reason}`);
      for (const evidence of check.evidence || []) {
        lines.push(`  - ${evidence}`);
      }
    }
    if (snapshot.ops.identityScopes.length > 0) {
      lines.push('', 'Tenants:');
      for (const tenant of snapshot.ops.identityScopes.slice(0, 6)) {
        lines.push(`- ${tenant.tenantId}: ${tenant.boundary} | ${tenant.platform} | ${tenant.governanceStatus} | ${tenant.policyProfile}`);
      }
    }
    lines.push('');
    lines.push(`next passo recomendada: ${snapshot.nextRecommendedGate.phase} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private buildIdentityScopes(
    governance: ZavorthGovernanceControlPlaneSnapshot,
    limit: number,
  ): TenantTeamOpsIdentityScope[] {
    const tenants = Array.isArray(governance.sourceSnapshots.tenants?.tenants)
      ? governance.sourceSnapshots.tenants.tenants
      : [];
    return tenants.slice(0, limit).map((tenant: TenantTeamOpsGovernanceTenant) => ({
      tenantId: this.text(tenant.tenantId, 'unknown-tenant'),
      platform: this.text(tenant.platform, 'unknown'),
      boundary: this.text(tenant.boundary, 'personal'),
      scopeLabel: this.text(tenant.scopeLabel, tenant.scopeId || tenant.tenantId || 'scope:unknown'),
      policyProfile: this.text(tenant.policyProfile, 'runtime-default'),
      governanceStatus: this.text(tenant.governanceStatus, 'personal'),
      ownerCount: Number(tenant.ownerCount || 0) || 0,
      allowedGuildCount: Number(tenant.allowedGuildCount || 0) || 0,
      allowedChannelCount: Number(tenant.allowedChannelCount || 0) || 0,
      publicServerMode: tenant.publicServerMode === true,
    }));
  }

  private buildPolicyScopes(governance: ZavorthGovernanceControlPlaneSnapshot): TenantTeamOpsPolicyScope[] {
    return (governance.surfaces || [])
      .filter((surface) => (TENANT_TEAM_OPS_REQUIRED_SURFACES as readonly string[]).includes(surface.id))
      .map((surface) => ({
        id: surface.id,
        label: surface.label,
        posture: surface.posture,
        boundary: surface.boundary,
        allowlistState: surface.allowlistState,
        command: surface.command,
      }));
  }

  private buildPermissionReadouts(
    governance: ZavorthGovernanceControlPlaneSnapshot,
    identityScopes: TenantTeamOpsIdentityScope[],
    limit: number,
  ): TenantTeamOpsPermissionReadout[] {
    const tenants = Array.isArray(governance.sourceSnapshots.tenants?.tenants)
      ? governance.sourceSnapshots.tenants.tenants
      : [];
    return identityScopes.slice(0, limit).map((identity) => {
      const tenant = tenants.find((entry: TenantTeamOpsGovernanceTenant) => String(entry.tenantId || '') === identity.tenantId) || {};
      return {
        tenantId: identity.tenantId,
        status: identity.governanceStatus === 'pending_onboarding'
          ? 'needs-onboarding'
          : identity.governanceStatus === 'restricted'
            ? 'restricted'
            : identity.boundary === 'shared'
              ? 'ready'
              : 'personal',
        owners: identity.ownerCount,
        allowedGuilds: identity.allowedGuildCount,
        allowedChannels: identity.allowedChannelCount,
        guidedActions: Array.isArray(tenant.actions)
          ? tenant.actions.filter((action: { actionKind?: string }) => action?.actionKind === 'guided').length
          : 0,
        nextAction: this.optionalText(tenant.nextAction),
      };
    });
  }

  private buildProjectReports(
    governance: ZavorthGovernanceControlPlaneSnapshot,
    identityScopes: TenantTeamOpsIdentityScope[],
  ): TenantTeamOpsProjectReport[] {
    const byPlatform = identityScopes.reduce<Record<string, TenantTeamOpsIdentityScope[]>>((acc, tenant) => {
      const platform = tenant.platform || 'unknown';
      acc[platform] = acc[platform] || [];
      acc[platform].push(tenant);
      return acc;
    }, {});
    const entries = Object.entries(byPlatform).map(([platform, tenants]) => ({
      id: `project:${platform}`,
      label: `${platform} project scope`,
      workspaceRoot: governance.workspaceRoot || this.projectRoot,
      tenantCount: tenants.length,
      sharedTenants: tenants.filter((tenant) => tenant.boundary === 'shared').length,
      teams: Number(governance.summary.teams || 0) || 0,
      posture: governance.summary.posture,
      summary: `${tenants.length} tenant(s) em ${platform}; ${governance.summary.teams} team(s) catalogado(s).`,
    }));
    if (entries.length > 0) {
      return entries;
    }
    return [
      {
        id: 'project:workspace',
        label: 'workspace project scope',
        workspaceRoot: governance.workspaceRoot || this.projectRoot,
        tenantCount: 0,
        sharedTenants: 0,
        teams: Number(governance.summary.teams || 0) || 0,
        posture: governance.summary.posture,
        summary: 'No tenant observed yet; workspace ready for segmentation when traffic exists.',
      },
    ];
  }

  private buildIsolationMap(identityScopes: TenantTeamOpsIdentityScope[]): TenantTeamOpsIsolationEntry[] {
    return identityScopes.map((tenant) => {
      const scope = `${tenant.boundary === 'shared' ? 'tenant' : 'personal'}:${tenant.tenantId}`;
      const attention = tenant.publicServerMode && tenant.boundary === 'shared' && tenant.allowedChannelCount === 0;
      return {
        tenantId: tenant.tenantId,
        memoryScope: `memory:${scope}`,
        artifactScope: `artifact:${scope}`,
        status: attention ? 'attention'
          : tenant.boundary === 'shared'
            ? 'isolated'
            : 'personal',
        reason: attention ? 'Shared public tenant needs allowlist before expanding automations.'
          : 'Memory e artifacts ficam referenciados pelo tenant/contexto, without payload bruto.',
      };
    });
  }

  private checkPackageScripts(): TenantTeamOpsCheck[] {
    const scripts = this.readPackageJson()?.scripts || {};
    return TENANT_TEAM_OPS_PACKAGE_SCRIPTS.map((scriptName) => {
      const command = String(scripts[scriptName] || '').trim();
      return this.check(
        `package:${scriptName}`,
        `script ${scriptName}`,
        command ? 'pass' : 'fail',
        command ? `package.json exposes ${scriptName} para Tenant/Team Ops.`
          : `package.json must expose ${scriptName}.`,
        'package',
        [`command=${command || '<missing>'}`],
      );
    });
  }

  private checkWebMarkers(): TenantTeamOpsCheck {
    const html = this.html !== null ? this.html : buildRuntimeShellHtml('/zavorthControl');
    const missing = TENANT_TEAM_OPS_WEB_MARKERS.filter((marker) => !html.includes(marker));
    return this.check(
      'web:tenant-team-ops-card',
      'card Tenant/Team Ops no /zavorthControl',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'ZavorthControl exposes identity, policy, permissions, and tenant/team isolation.'
        : 'ZavorthControl perdeu marcadores de Tenant/Team Ops.',
      'web',
      missing.map((marker) => `faltando: ${marker}`),
    );
  }

  private checkGovernanceSurfaces(
    governance: ZavorthGovernanceControlPlaneSnapshot,
    policyScopes: TenantTeamOpsPolicyScope[],
  ): TenantTeamOpsCheck {
    const ids = new Set(policyScopes.map((scope) => scope.id));
    const missing = TENANT_TEAM_OPS_REQUIRED_SURFACES.filter((surface) => !ids.has(surface));
    return this.check(
      'governance:required-surfaces',
      'surfaces de policy essenciais',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? 'Governance control plane exposes tenants, channels, teams, and workspace.'
        : 'Governance control plane perdeu surfaces essenciais para Tenant/Team Ops.',
      'governance',
      [
        `posture=${governance.summary.posture}`,
        ...missing.map((surface) => `faltando:${surface}`),
      ],
    );
  }

  private checkIdentityScopes(identityScopes: TenantTeamOpsIdentityScope[]): TenantTeamOpsCheck {
    const invalid = identityScopes.filter((tenant) =>
      !tenant.tenantId || !tenant.platform || !tenant.boundary || !tenant.policyProfile);
    return this.check(
      'tenant:identity-scopes',
      'identidade operational por tenant',
      invalid.length === 0 ? 'pass' : 'fail',
      identityScopes.length > 0
        ? 'Tenants observados tem tenantId, platform, boundary e policy profile.'
        : 'Cold start without tenants; contrato preserva estrutura para primeira observation.',
      'tenant',
      [`tenants=${identityScopes.length}`, `invalid=${invalid.map((tenant) => tenant.tenantId).join(', ') || '<none>'}`],
    );
  }

  private checkPolicyScopes(policyScopes: TenantTeamOpsPolicyScope[]): TenantTeamOpsCheck {
    const missingCommand = policyScopes.filter((scope) => scope.id !== 'workspace' && !scope.command);
    return this.check(
      'policy:scoped-surfaces',
      'policy por escopo',
      missingCommand.length === 0 ? 'pass' : 'fail',
      'Policy scopes para tenants, channels, teams e workspace are normalizados.',
      'policy',
      policyScopes.map((scope) => `${scope.id}:${scope.posture}:${scope.command || '<without comando>'}`),
    );
  }

  private checkPermissionReadouts(readouts: TenantTeamOpsPermissionReadout[]): TenantTeamOpsCheck {
    const sharedWithoutGuidedAction = readouts.filter((entry) =>
      entry.status !== 'personal' && entry.guidedActions === 0);
    return this.check(
      'permission:segmented-readouts',
      'permissions segmentadas por tenant',
      sharedWithoutGuidedAction.length === 0 ? 'pass' : 'fail',
      readouts.length > 0
        ? 'Permissions mostram owners, guilds, channels e actions guiadas por tenant.'
        : 'Cold start without tenants; segmented permission is ready to populate.',
      'permission',
      readouts.map((entry) => `${entry.tenantId}:owners=${entry.owners}:channels=${entry.allowedChannels}:actions=${entry.guidedActions}`),
    );
  }

  private checkProjectReports(reports: TenantTeamOpsProjectReport[]): TenantTeamOpsCheck {
    const invalid = reports.filter((report) => !report.workspaceRoot || !report.label || !report.summary);
    return this.check(
      'tenant:project-reports',
      'reports por projeto/workspace',
      invalid.length === 0 ? 'pass' : 'fail',
      'Reports agregam tenants por plataforma/projeto usando workspaceRoot e postura de governance.',
      'tenant',
      reports.map((report) => `${report.id}:tenants=${report.tenantCount}:teams=${report.teams}`),
    );
  }

  private checkIsolationMap(isolationMap: TenantTeamOpsIsolationEntry[]): TenantTeamOpsCheck {
    const invalid = isolationMap.filter((entry) =>
      !entry.memoryScope.startsWith('memory:') || !entry.artifactScope.startsWith('artifact:'));
    return this.check(
      'isolation:memory-artifacts',
      'memory and artifact isolation',
      invalid.length === 0 ? 'pass' : 'fail',
      isolationMap.length > 0
        ? 'Each tenant has memory and artifact scopes separated by context.'
        : 'Cold start without tenants; mapa de isolamento fica vazio without bloquear o gate.',
      'isolation',
      [`isolated=${isolationMap.length}`, `attention=${isolationMap.filter((entry) => entry.status === 'attention').length}`],
    );
  }

  private checkQuietGate(): TenantTeamOpsCheck {
    const scripts = this.readPackageJson()?.scripts || {};
    const quietScripts = ['tenant:ops', 'tenant:ops:json', 'qa:tenant-team-ops', 'qa:tenant-team-ops'];
    const backgroundWords = ['nodemon', '--watch', ' dev', 'node-mesh-host', 'ops-maintain-recurring', 'start-ai-gateway-runtime'];
    const offenders = quietScripts.filter((scriptName) => {
      const command = ` ${String(scripts[scriptName] || '').toLowerCase()} `;
      return backgroundWords.some((word) => command.includes(word.toLowerCase()));
    });
    return this.check(
      'tenant:quiet-gate',
      'Tenant/Team Ops does not start persistent background work',
      offenders.length === 0 ? 'pass' : 'fail',
      offenders.length === 0
        ? 'Scripts e gate de tenant/team ops sao reads sob demanda.'
        : 'Scripts de Tenant/Team Ops apontam para process persistente.',
      'tenant',
      offenders,
    );
  }

  private readPackageJson(): PackageLike | null {
    if (this.packageJson) {
      return this.packageJson;
    }
    const target = path.resolve(this.projectRoot, 'package.json');
    if (!this.existsSync(target)) {
      return null;
    }
    try {
      return JSON.parse(this.readFileSync(target, 'utf8')) as PackageLike;
    } catch (error: unknown) {logger.warn('[Tenant Team Ops] JSON parse failed', error); return null; }
  }

  private check(
    id: string,
    title: string,
    status: TenantTeamOpsCheckStatus,
    reason: string,
    source: TenantTeamOpsSource,
    evidence: string[] = [],
  ): TenantTeamOpsCheck {
    return {
      id,
      title,
      status,
      source,
      reason,
      evidence,
    };
  }

  private optionalText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private text(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
