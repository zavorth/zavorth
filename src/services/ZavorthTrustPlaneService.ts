import type {
  ZavorthSecurityMeshPosture,
  ZavorthSecurityMeshService,
  ZavorthSecurityMeshSnapshot,
} from './ZavorthSecurityMeshService.js';
import type { ZavorthPluginRegistryService, ZavorthPluginRegistrySnapshot } from './ZavorthPluginRegistryService.js';
import type { ZavorthNodeMeshService } from './ZavorthNodeMeshService.js';
import type { NodeMeshSnapshot, NodeMeshSnapshotEntry } from '../contracts/NodeMeshContract.js';
import { McpToolPolicy, type McpSecurityProfile } from '../mcp/McpToolPolicy.js';
import type { McpCapabilityControlPlaneService } from './McpCapabilityControlPlaneService.js';
import {
  SkillTrustPolicyService,
  type SkillTrustPolicyDefault,
  type SkillTrustPolicyDocument,
} from './SkillTrustPolicyService.js';
import type { SystemOverlordControlService } from './SystemOverlordControlService.js';
import type { SystemOverlordRiskLevel, SystemOverlordControlSnapshot, SystemOverlordProfileDescriptor, SystemOverlordCapabilityDescriptor } from '../contracts/SystemOverlordContract.js';
import type { WorkspaceExtensionRegistryService } from './WorkspaceExtensionRegistryService.js';
import {
  TrustPlanePolicyLedgerService,
  type TrustPlanePolicyDomain,
  type TrustPlanePolicyLedgerSummary,
} from './TrustPlanePolicyLedgerService.js';

type TrustPlaneSeverity = 'info' | 'warn' | 'critical';

type SecurityMeshLike = Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
type SystemOverlordLike = Pick<SystemOverlordControlService, 'buildSnapshot'>;
type McpCapabilityPlaneLike = Pick<McpCapabilityControlPlaneService, 'buildSnapshot'>;
type SkillTrustLike = Pick<SkillTrustPolicyService, 'readPolicy'>;
type PluginRegistryLike = Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
type WorkspaceExtensionsLike = Pick<WorkspaceExtensionRegistryService, 'buildSnapshot'>;
type NodeMeshLike = Pick<ZavorthNodeMeshService, 'buildSnapshot'>;
type PolicyLedgerLike = Pick<TrustPlanePolicyLedgerService, 'summarize'>;

type ZavorthTrustPlaneRuntime = {
  now?: () => Date;
  securityMeshService?: SecurityMeshLike | null;
  systemOverlordControlService?: SystemOverlordLike | null;
  mcpToolPolicy?: McpToolPolicy | null;
  mcpCapabilityControlPlaneService?: McpCapabilityPlaneLike | null;
  skillTrustPolicyService?: SkillTrustLike | null;
  pluginRegistryService?: PluginRegistryLike | null;
  workspaceExtensionsService?: WorkspaceExtensionsLike | null;
  nodeMeshService?: NodeMeshLike | null;
  policyLedgerService?: PolicyLedgerLike | null;
};

export type ZavorthTrustPlaneSnapshot = {
  generatedAt: string;
  summary: {
    posture: ZavorthSecurityMeshPosture | 'unknown';
    pendingApprovals: number;
    highRiskCapabilities: number;
    killSwitchActive: boolean;
    mcpProfile: McpSecurityProfile;
    mcpAllowedTools: number;
    mcpDangerousToolsBlocked: number;
    skillDefaultPolicy: SkillTrustPolicyDefault;
    skillAllowedSources: number;
    explicitSkillRules: number;
    trustedPlugins: number;
    installedPlugins: number;
    restrictedNodes: number;
    pairedNodes: number;
    policyDomains: number;
    policyLedgerEntries: number;
    rollbackablePolicyEntries: number;
  };
  surfaces: {
    systemOverlord: {
      profiles: string[];
      autonomyLevels: number;
      pendingApprovals: number;
      highRiskCapabilities: number;
      killSwitchActive: boolean;
      adapters: number;
      highestRiskLevel: SystemOverlordRiskLevel | null;
      operatorSummary: string;
    };
    mcp: {
      profile: McpSecurityProfile;
      allowlist: string[];
      allowedTools: string[];
      blockedDangerousTools: string[];
      enabledServers: number;
      connectedServers: number;
      operatorSummary: string;
      recommendations: string[];
    };
    skills: {
      defaultPolicy: SkillTrustPolicyDefault;
      allowedSourceIds: string[];
      explicitRules: Array<{
        sourceId: string;
        mode: string;
        skillNames: string[];
      }>;
      blockedSources: string[];
      operatorSummary: string;
    };
    plugins: {
      total: number;
      installed: number;
      trusted: number;
      workspaceExtensions: number;
      operatorSummary: string;
    };
    nodes: {
      total: number;
      paired: number;
      pending: number;
      restricted: number;
      operatorSummary: string;
    };
    runtime: {
      posture: ZavorthSecurityMeshPosture | 'unknown';
      trustBoundary: string;
      operatorSummary: string;
    };
  };
  riskHighlights: Array<{
    id: string;
    label: string;
    severity: TrustPlaneSeverity;
    summary: string;
  }>;
  suggestedActions: Array<{
    id: string;
    label: string;
    command: string | null;
    severity: TrustPlaneSeverity;
    reason: string;
  }>;
  policyOS: {
    domains: Array<{
      id: TrustPlanePolicyDomain;
      label: string;
      owner: string;
      status: 'active' | 'consulted' | 'planned';
      auditRequired: boolean;
      sensitiveActions: string[];
    }>;
    approvalScopes: Array<'once' | 'session' | 'host'>;
    dangerousPolicy: string;
    ledger: TrustPlanePolicyLedgerSummary;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthTrustPlaneService {
  private readonly now: () => Date;
  private readonly securityMesh: SecurityMeshLike | null;
  private readonly systemOverlord: SystemOverlordLike | null;
  private readonly mcpToolPolicy: McpToolPolicy;
  private readonly mcpCapabilityPlane: McpCapabilityPlaneLike | null;
  private readonly skillTrust: SkillTrustLike;
  private readonly pluginRegistry: PluginRegistryLike | null;
  private readonly workspaceExtensions: WorkspaceExtensionsLike | null;
  private readonly nodeMesh: NodeMeshLike | null;
  private readonly policyLedger: PolicyLedgerLike;

  constructor(runtime: ZavorthTrustPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.securityMesh = runtime.securityMeshService || null;
    this.systemOverlord = runtime.systemOverlordControlService || null;
    this.mcpToolPolicy = runtime.mcpToolPolicy || McpToolPolicy.fromEnv();
    this.mcpCapabilityPlane = runtime.mcpCapabilityControlPlaneService || null;
    this.skillTrust = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.pluginRegistry = runtime.pluginRegistryService || null;
    this.workspaceExtensions = runtime.workspaceExtensionsService || null;
    this.nodeMesh = runtime.nodeMeshService || null;
    this.policyLedger = runtime.policyLedgerService || new TrustPlanePolicyLedgerService();
  }

  public buildSnapshot(): ZavorthTrustPlaneSnapshot {
    const securityMesh = this.securityMesh?.buildSnapshot() || null;
    const systemOverlord = this.systemOverlord?.buildSnapshot(20) || null;
    const mcpServers = this.mcpCapabilityPlane?.buildSnapshot() || null;
    const skillPolicy = this.skillTrust.readPolicy();
    const pluginSnapshot = this.pluginRegistry?.buildSnapshot() || null;
    const workspaceExtensions = this.workspaceExtensions?.buildSnapshot() || null;
    const nodeSnapshot = this.nodeMesh?.buildSnapshot() || null;
    const policyLedger = this.policyLedger.summarize(6);
    const policyDomains = this.buildPolicyDomains();
    const mcpProfile = this.mcpToolPolicy.describe();
    const riskHighlights = this.buildRiskHighlights({
      systemOverlord,
      mcpProfile,
      skillPolicy,
      securityMesh,
      pluginSnapshot,
      nodeSnapshot,
    });
    const suggestedActions = this.buildSuggestedActions({
      securityMesh,
      mcpProfile,
      skillPolicy,
      pluginSnapshot,
      nodeSnapshot,
    });

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        posture: securityMesh?.posture?.level || 'unknown',
        pendingApprovals: Number(systemOverlord?.summary?.pendingApprovals || 0),
        highRiskCapabilities: this.countHighRiskCapabilities(systemOverlord),
        killSwitchActive: systemOverlord?.killSwitch?.active === true,
        mcpProfile: mcpProfile.profile,
        mcpAllowedTools: mcpProfile.allowedTools.length,
        mcpDangerousToolsBlocked: mcpProfile.blockedDangerousTools.length,
        skillDefaultPolicy: skillPolicy.defaultPolicy,
        skillAllowedSources: skillPolicy.allowedSourceIds.length,
        explicitSkillRules: skillPolicy.rules.filter((entry) => entry.mode === 'explicit').length,
        trustedPlugins: Number(pluginSnapshot?.summary?.trusted || 0),
        installedPlugins: Number(pluginSnapshot?.summary?.installed || 0),
        restrictedNodes: this.countRestrictedNodes(nodeSnapshot),
        pairedNodes: Number(nodeSnapshot?.summary?.paired || 0),
        policyDomains: policyDomains.length,
        policyLedgerEntries: policyLedger.total,
        rollbackablePolicyEntries: policyLedger.rollbackableEntries,
      },
      surfaces: {
        systemOverlord: {
          profiles: Array.isArray(systemOverlord?.profiles)
            ? systemOverlord!.profiles.map((entry: SystemOverlordProfileDescriptor) => String(entry?.profile || '').trim()).filter(Boolean)
            : [],
          autonomyLevels: Array.isArray(systemOverlord?.autonomyLevels) ? systemOverlord!.autonomyLevels.length : 0,
          pendingApprovals: Number(systemOverlord?.summary?.pendingApprovals || 0),
          highRiskCapabilities: this.countHighRiskCapabilities(systemOverlord),
          killSwitchActive: systemOverlord?.killSwitch?.active === true,
          adapters: Number(systemOverlord?.summary?.adapters || 0),
          highestRiskLevel: (systemOverlord?.summary?.highestRiskLevel || null) as SystemOverlordRiskLevel | null,
          operatorSummary:
            String(systemOverlord?.narrative?.operatorSummary || '').trim()
            || 'System Overlord indisponivel neste runtime.',
        },
        mcp: {
          profile: mcpProfile.profile,
          allowlist: mcpProfile.allowlist,
          allowedTools: mcpProfile.allowedTools,
          blockedDangerousTools: mcpProfile.blockedDangerousTools,
          enabledServers: Number(mcpServers?.summary?.enabled || 0),
          connectedServers: Number(mcpServers?.summary?.connected || 0),
          operatorSummary: this.buildMcpSummary(mcpProfile, mcpServers),
          recommendations: Array.isArray(mcpServers?.recommendations) ? mcpServers!.recommendations.slice(0, 4) : [],
        },
        skills: {
          defaultPolicy: skillPolicy.defaultPolicy,
          allowedSourceIds: skillPolicy.allowedSourceIds.slice(),
          explicitRules: skillPolicy.rules
            .filter((entry) => entry.mode === 'explicit')
            .map((entry) => ({
              sourceId: entry.sourceId,
              mode: entry.mode,
              skillNames: entry.skillNames.slice(),
            })),
          blockedSources: skillPolicy.rules
            .filter((entry) => entry.mode === 'none')
            .map((entry) => entry.sourceId),
          operatorSummary: this.buildSkillSummary(skillPolicy),
        },
        plugins: {
          total: Number(pluginSnapshot?.summary?.total || 0),
          installed: Number(pluginSnapshot?.summary?.installed || 0),
          trusted: Number(pluginSnapshot?.summary?.trusted || 0),
          workspaceExtensions:
            Number(pluginSnapshot?.summary?.workspaceExtensions || 0)
            || Number(workspaceExtensions?.summary?.workspaces || 0),
          operatorSummary:
            String(pluginSnapshot?.narrative?.operatorSummary || '').trim()
            || String(workspaceExtensions?.narrative?.operatorSummary || '').trim()
            || 'Plugin plane indisponivel.',
        },
        nodes: {
          total: Number(nodeSnapshot?.summary?.total || 0),
          paired: Number(nodeSnapshot?.summary?.paired || 0),
          pending: Number(nodeSnapshot?.summary?.pending || 0),
          restricted: this.countRestrictedNodes(nodeSnapshot),
          operatorSummary:
            String(nodeSnapshot?.narrative?.operatorSummary || '').trim()
            || 'Node Mesh indisponivel.',
        },
        runtime: {
          posture: securityMesh?.posture?.level || 'unknown',
          trustBoundary: String(securityMesh?.narrative?.trustBoundary || '').trim() || 'Trust boundary indisponivel.',
          operatorSummary:
            String(securityMesh?.narrative?.operatorSummary || '').trim()
            || 'Runtime & Security Mesh indisponivel.',
        },
      },
      riskHighlights,
      suggestedActions,
      policyOS: {
        domains: policyDomains,
        approvalScopes: ['once', 'session', 'host'],
        dangerousPolicy: 'dangerous sempre usa scope once, salvo quando o operador escolhe host explicitamente.',
        ledger: policyLedger,
      },
      narrative: {
        headline: 'Trust Plane do Zavorth',
        operatorSummary: this.buildOperatorSummary({
          securityMesh,
          systemOverlord,
          mcpProfile,
          skillPolicy,
          pluginSnapshot,
          nodeSnapshot,
        }),
      },
    };
  }

  public renderReport(): string {
    const snapshot = this.buildSnapshot();
    const lines = [
      snapshot.narrative.headline,
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Host: ${snapshot.summary.pendingApprovals} approval(s), ${snapshot.summary.highRiskCapabilities} capability(s) sensiveis e kill switch ${snapshot.summary.killSwitchActive ? 'ativo' : 'livre'}.`,
      `MCP: perfil ${snapshot.summary.mcpProfile}, ${snapshot.summary.mcpAllowedTools} tool(s) exposta(s) e ${snapshot.summary.mcpDangerousToolsBlocked} tool(s) perigosas bloqueadas.`,
      `Skills & plugins: policy ${snapshot.summary.skillDefaultPolicy}, ${snapshot.summary.skillAllowedSources} fonte(s) liberada(s), ${snapshot.summary.trustedPlugins}/${snapshot.summary.installedPlugins} plugin(s) trusted.`,
      `Nodes: ${snapshot.summary.pairedNodes} pareado(s) e ${snapshot.summary.restrictedNodes} com allowlist restrita.`,
      `Policy OS: ${snapshot.summary.policyDomains} dominio(s), ${snapshot.summary.policyLedgerEntries} entrada(s) de ledger e ${snapshot.summary.rollbackablePolicyEntries} rollback(s) possivel(is).`,
    ];

    if (snapshot.riskHighlights.length > 0) {
      lines.push(
        '',
        'Riscos destacados:',
        ...snapshot.riskHighlights.map((entry) => `- ${entry.label}: ${entry.summary}`),
      );
    }

    if (snapshot.suggestedActions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.suggestedActions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }

    lines.push(
      '',
      'Useful commands:',
      '- /trust para ver esta leitura no chat.',
      '- /trust mcp trusted para promover o MCP somente quando fizer sentido operacional.',
      '- /trust mcp safe para endurecer o perfil MCP de volta ao baseline.',
      '- /trust skills deny para manter skills novas bloqueadas por default.',
      '- /trust rollback <ledgerId> para desfazer uma mutacao quando o ledger tiver policy anterior.',
      '- npm run ops:trust-plane para revisar ou mutar o Trust Plane pelo shell.',
    );

    return lines.join('\n');
  }

  private buildOperatorSummary(input: {
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    systemOverlord: SystemOverlordControlSnapshot | null;
    mcpProfile: ReturnType<McpToolPolicy['describe']>;
    skillPolicy: SkillTrustPolicyDocument;
    pluginSnapshot: ZavorthPluginRegistrySnapshot | null;
    nodeSnapshot: NodeMeshSnapshot | null;
  }): string {
    const parts: string[] = [];

    if (input.securityMesh?.posture?.label) {
      parts.push(`Postura ${input.securityMesh.posture.label.toLowerCase()}.`);
    }
    if (input.systemOverlord) {
      parts.push(
        `${Number(input.systemOverlord.summary?.pendingApprovals || 0)} approval(s) pendente(s) e `
        + `${this.countHighRiskCapabilities(input.systemOverlord)} capability(s) de risco alto/critico no host supervisionado.`,
      );
    }
    parts.push(
      `MCP em perfil ${input.mcpProfile.profile} com ${input.mcpProfile.allowedTools.length} tool(s) exposta(s).`,
    );
    parts.push(
      `Skills em policy ${input.skillPolicy.defaultPolicy} com ${input.skillPolicy.allowedSourceIds.length} fonte(s) liberada(s).`,
    );
    if (input.pluginSnapshot) {
      parts.push(
        `${Number(input.pluginSnapshot.summary?.trusted || 0)} plugin(s) trusted de ${Number(input.pluginSnapshot.summary?.installed || 0)} instalado(s).`,
      );
    }
    if (input.nodeSnapshot) {
      parts.push(
        `${this.countRestrictedNodes(input.nodeSnapshot)} node(s) com allowlist restrita em ${Number(input.nodeSnapshot.summary?.paired || 0)} pareado(s).`,
      );
    }

    return parts.join(' ');
  }

  private buildRiskHighlights(input: {
    systemOverlord: SystemOverlordControlSnapshot | null;
    mcpProfile: ReturnType<McpToolPolicy['describe']>;
    skillPolicy: SkillTrustPolicyDocument;
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    pluginSnapshot: ZavorthPluginRegistrySnapshot | null;
    nodeSnapshot: NodeMeshSnapshot | null;
  }): ZavorthTrustPlaneSnapshot['riskHighlights'] {
    const highlights: ZavorthTrustPlaneSnapshot['riskHighlights'] = [];
    const pendingApprovals = Number(input.systemOverlord?.summary?.pendingApprovals || 0);
    const highRiskCapabilities = this.countHighRiskCapabilities(input.systemOverlord);
    const restrictedNodes = this.countRestrictedNodes(input.nodeSnapshot);
    const untrustedInstalledPlugins = Math.max(
      Number(input.pluginSnapshot?.summary?.installed || 0) - Number(input.pluginSnapshot?.summary?.trusted || 0),
      0,
    );

    if (input.systemOverlord?.killSwitch?.active === true) {
      highlights.push({
        id: 'kill-switch-active',
        label: 'Kill switch ativo',
        severity: 'critical',
        summary: 'O host supervisionado esta travado para novas acoes ate liberacao manual.',
      });
    }
    if (pendingApprovals > 0) {
      highlights.push({
        id: 'pending-approvals',
        label: 'Approvals pendentes',
        severity: pendingApprovals > 2 ? 'critical' : 'warn',
        summary: `${pendingApprovals} approval(s) supervisionado(s) aguardam decisao no host.`,
      });
    }
    if (highRiskCapabilities > 0) {
      highlights.push({
        id: 'high-risk-capabilities',
        label: 'Capabilities sensiveis expostas',
        severity: 'warn',
        summary: `${highRiskCapabilities} capability(s) de risco alto ou critico continuam disponiveis so com policy e approval.`,
      });
    }
    if (input.mcpProfile.profile !== 'safe') {
      highlights.push({
        id: 'mcp-promoted',
        label: 'MCP acima de safe',
        severity: input.mcpProfile.profile === 'dangerous' ? 'critical' : 'warn',
        summary: `O MCP esta em perfil ${input.mcpProfile.profile} com ${input.mcpProfile.allowedTools.length} tool(s) liberada(s).`,
      });
    }
    if (input.skillPolicy.defaultPolicy === 'allow') {
      highlights.push({
        id: 'skills-default-allow',
        label: 'Skills em allow por default',
        severity: 'critical',
        summary: 'A policy de skills libera fontes novas por default; isso amplia a superficie de trust.',
      });
    }
    if (untrustedInstalledPlugins > 0) {
      highlights.push({
        id: 'plugins-awaiting-review',
        label: 'Plugins aguardando review',
        severity: 'warn',
        summary: `${untrustedInstalledPlugins} installed plugin(s) are not marked as trusted yet.`,
      });
    }
    if (restrictedNodes > 0) {
      highlights.push({
        id: 'restricted-nodes',
        label: 'Nodes com allowlist restrita',
        severity: 'info',
        summary: `${restrictedNodes} node(s) pareado(s) continuam com capabilities parcialmente aprovadas.`,
      });
    }
    if (input.securityMesh?.posture?.level === 'baseline') {
      highlights.push({
        id: 'runtime-baseline',
        label: 'Runtime ainda em baseline',
        severity: 'warn',
        summary: 'The runtime has not confirmed strong mesh isolation tiers yet.',
      });
    }

    return highlights.slice(0, 8);
  }

  private buildSuggestedActions(input: {
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    mcpProfile: ReturnType<McpToolPolicy['describe']>;
    skillPolicy: SkillTrustPolicyDocument;
    pluginSnapshot: ZavorthPluginRegistrySnapshot | null;
    nodeSnapshot: NodeMeshSnapshot | null;
  }): ZavorthTrustPlaneSnapshot['suggestedActions'] {
    const actions: ZavorthTrustPlaneSnapshot['suggestedActions'] = [];

    for (const action of input.securityMesh?.suggestedActions || []) {
      actions.push({
        id: String(action.id || '').trim() || `security-${actions.length + 1}`,
        label: String(action.label || 'Acao do runtime').trim() || 'Acao do runtime',
        command: String(action.command || '').trim() || null,
        severity: action.severity === 'warn' ? 'warn' : 'info',
        reason: String(action.reason || 'Acao sugerida pelo Runtime & Security Mesh.').trim(),
      });
    }

    if (input.mcpProfile.profile === 'safe' && input.mcpProfile.blockedDangerousTools.length > 0) {
      actions.push({
        id: 'mcp-keep-safe',
        label: 'Promover MCP so por excecao',
        command: 'npm run ops:trust-plane -- --allow-tool remote_shell',
        severity: 'info',
        reason: 'Mantenha o MCP em safe e libere so as tools que realmente faltarem para o fluxo atual.',
      });
    }

    if (input.skillPolicy.defaultPolicy === 'deny') {
      actions.push({
        id: 'review-skill-allowlist',
        label: 'Revisar allowlist de skills',
        command: '/trust skills deny',
        severity: 'info',
        reason: 'A trust policy de skills esta segura por default; revise a allowlist antes de adotar fontes novas.',
      });
    }

    const untrustedInstalledPlugins = Math.max(
      Number(input.pluginSnapshot?.summary?.installed || 0) - Number(input.pluginSnapshot?.summary?.trusted || 0),
      0,
    );
    if (untrustedInstalledPlugins > 0) {
      actions.push({
        id: 'plugins-review',
        label: 'Revisar plugin plane',
        command: '/plugins review',
        severity: 'warn',
        reason: `${untrustedInstalledPlugins} plugin(s) instalado(s) ainda pedem review/trust explicito.`,
      });
    }

    const restrictedNodes = this.countRestrictedNodes(input.nodeSnapshot);
    if (restrictedNodes > 0) {
      actions.push({
        id: 'nodes-review',
        label: 'Revisar allowlist dos nodes',
        command: '/nodes',
        severity: 'info',
        reason: `${restrictedNodes} node(s) pareado(s) continuam com capabilities aprovadas so parcialmente.`,
      });
    }

    const deduped = new Map<string, ZavorthTrustPlaneSnapshot['suggestedActions'][number]>();
    for (const action of actions) {
      deduped.set(action.id, action);
    }
    return Array.from(deduped.values()).slice(0, 8);
  }

  private buildPolicyDomains(): ZavorthTrustPlaneSnapshot['policyOS']['domains'] {
    return [
      {
        id: 'mcp',
        label: 'MCP tools',
        owner: 'McpToolPolicyFileService',
        status: 'active',
        auditRequired: true,
        sensitiveActions: ['set-mcp-profile', 'allow-mcp-tool', 'remove-mcp-tool'],
      },
      {
        id: 'skills',
        label: 'Skills',
        owner: 'SkillTrustPolicyService',
        status: 'active',
        auditRequired: true,
        sensitiveActions: ['set-skill-default', 'set-skill-source-mode'],
      },
      {
        id: 'plugins',
        label: 'Plugins',
        owner: 'ZavorthPluginRegistryService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['plugin.trust', 'plugin.install', 'plugin.disable'],
      },
      {
        id: 'nodes',
        label: 'Distributed nodes',
        owner: 'ZavorthNodeMeshService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['node.pair', 'node.approve-capability', 'node.revoke-capability'],
      },
      {
        id: 'runtime',
        label: 'Runtime',
        owner: 'ZavorthSecurityMeshService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['runtime.promote', 'runtime.kill-switch', 'runtime.sandbox-tier'],
      },
      {
        id: 'watch',
        label: 'Watch Mode',
        owner: 'ZavorthWatchModeControlPlaneService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['watch.start', 'watch.allow-app', 'watch.allow-site'],
      },
      {
        id: 'automation',
        label: 'Automations',
        owner: 'ZavorthAutomationActionService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['automation.create', 'automation.resume', 'automation.maintenance-run'],
      },
      {
        id: 'hardware',
        label: 'Hardware, IoT e domotica',
        owner: 'ZavorthHardwareActionPlaneService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['hardware.plan-action', 'hardware.apply-action', 'hardware.emergency-stop'],
      },
      {
        id: 'autonomous-partner',
        label: 'Autonomous Engineering Partner',
        owner: 'ZavorthAutonomousEngineeringPartnerService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['mission.delegate', 'mission.progress', 'mission.complete', 'mission.pause'],
      },
      {
        id: 'selfmod',
        label: 'Self modification',
        owner: 'ZavorthMutationPlaneService',
        status: 'planned',
        auditRequired: true,
        sensitiveActions: ['selfmod.edit', 'selfmod.install-skill', 'selfmod.publish'],
      },
      {
        id: 'capabilities',
        label: 'Capabilities',
        owner: 'CapabilityLifecycleService',
        status: 'consulted',
        auditRequired: true,
        sensitiveActions: ['capability.boot', 'capability.promote', 'capability.bind'],
      },
    ];
  }

  private buildMcpSummary(
    policy: ReturnType<McpToolPolicy['describe']>,
    controlPlane: ReturnType<McpCapabilityPlaneLike['buildSnapshot']> | null,
  ): string {
    const serverText = controlPlane
      ? `${Number(controlPlane.summary?.connected || 0)}/${Number(controlPlane.summary?.enabled || 0)} servidor(es) conectado(s)`
      : 'sem leitura de servidores conectados';
    const allowlistText = policy.allowlist.length > 0
      ? `allowlist explicita com ${policy.allowlist.length} item(ns)`
      : 'sem allowlist explicita';
    return `Perfil ${policy.profile}, ${policy.allowedTools.length} tool(s) exposta(s), ${serverText} e ${allowlistText}.`;
  }

  private buildSkillSummary(policy: SkillTrustPolicyDocument): string {
    const explicitRules = policy.rules.filter((entry) => entry.mode === 'explicit').length;
    const blockedRules = policy.rules.filter((entry) => entry.mode === 'none').length;
    return `Policy default ${policy.defaultPolicy}, ${policy.allowedSourceIds.length} fonte(s) liberada(s), ${explicitRules} regra(s) explicita(s) e ${blockedRules} bloqueio(s) dedicado(s).`;
  }

  private countHighRiskCapabilities(systemOverlord: SystemOverlordControlSnapshot | null): number {
    const capabilities = Array.isArray(systemOverlord?.capabilities) ? systemOverlord.capabilities : [];
    return capabilities.filter((entry: SystemOverlordCapabilityDescriptor) => {
      const riskLevel = String(entry?.riskLevel || '').trim().toLowerCase();
      return riskLevel === 'high' || riskLevel === 'critical';
    }).length;
  }

  private countRestrictedNodes(nodeSnapshot: NodeMeshSnapshot | null): number {
    const entries = Array.isArray(nodeSnapshot?.entries) ? nodeSnapshot.entries : [];
    return entries.filter((entry: NodeMeshSnapshotEntry) => {
      const approved = Number(entry?.approvedCapabilityIds?.length || 0);
      const capabilities = Number(entry?.capabilityIds?.length || 0);
      return approved > 0 && approved < capabilities;
    }).length;
  }
}
