import { McpToolPolicy, type McpSecurityProfile, type McpToolPolicyDocument } from '../mcp/McpToolPolicy.js';
import type {
  ZavorthApprovalScope,
  ZavorthMutationRiskLevel,
} from '../contracts/ZavorthMutationPlaneContract.js';
import {
  SkillTrustPolicyService,
  type SkillAllowMode,
  type SkillTrustPolicyDefault,
  type SkillTrustPolicyDocument,
} from './SkillTrustPolicyService.js';
import { ZavorthTrustPlaneService, type ZavorthTrustPlaneSnapshot } from './ZavorthTrustPlaneService.js';
import { McpToolPolicyFileService } from './McpToolPolicyFileService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import type { ZavorthMutationPlan } from '../contracts/ZavorthMutationPlaneContract.js';
import { PermissionService } from './PermissionService.js';
import {
  TrustPlanePolicyLedgerService,
  type TrustPlanePolicyDiffEntry,
  type TrustPlanePolicyDomain,
  type TrustPlanePolicyLedgerEntry,
  type TrustPlanePolicyRollbackPayload,
} from './TrustPlanePolicyLedgerService.js';

type TrustPlaneActionId =
  | 'set-mcp-profile'
  | 'allow-mcp-tool'
  | 'remove-mcp-tool'
  | 'set-skill-default'
  | 'set-skill-source-mode';

type TrustPlaneResultActionId = TrustPlaneActionId | 'rollback-policy-mutation';

type TrustPlaneActionRuntime = {
  now?: () => Date;
  trustPlaneService?: Pick<ZavorthTrustPlaneService, 'buildSnapshot'>;
  mcpToolPolicyFileService?: Pick<
    McpToolPolicyFileService,
    'readPolicy' | 'savePolicy' | 'setProfile' | 'allowTool' | 'removeTool'
  >;
  skillTrustPolicyService?: Pick<
    SkillTrustPolicyService,
    'readPolicy' | 'savePolicy' | 'setDefaultPolicy' | 'setSourceRule'
  >;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'>;
  permissionService?: Pick<PermissionService, 'getRequest'>;
  policyLedgerService?: Pick<TrustPlanePolicyLedgerService, 'append' | 'list' | 'summarize'>;
};

export type ZavorthTrustPlanePolicyDiffPreview = {
  domain: TrustPlanePolicyDomain;
  actionId: TrustPlaneActionId;
  approvalScope: ZavorthApprovalScope;
  summary: string;
  dangerousTemporary: boolean;
  rollbackAvailable: boolean;
  rollbackReason: string;
  entries: TrustPlanePolicyDiffEntry[];
};

export type ZavorthTrustPlaneActionExecution = {
  generatedAt: string;
  actionId: TrustPlaneResultActionId;
  status: 'applied' | 'noop' | 'waiting_approval' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  snapshot: ZavorthTrustPlaneSnapshot;
  mutationPlan?: ZavorthMutationPlan | null;
  trustDecision?: TrustDecision | null;
  diffPreview?: ZavorthTrustPlanePolicyDiffPreview | null;
  ledgerEntry?: TrustPlanePolicyLedgerEntry | null;
  rollbackPlan?: {
    available: boolean;
    reason: string;
    ledgerId?: string | null;
    payload?: TrustPlanePolicyRollbackPayload | null;
  } | null;
};

type TrustPlanePolicyCandidate = {
  domain: 'mcp' | 'skills';
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  riskLevel: ZavorthMutationRiskLevel;
  details: string[];
  diff: TrustPlanePolicyDiffEntry[];
  beforePolicy: McpToolPolicyDocument | SkillTrustPolicyDocument;
  afterPolicy: McpToolPolicyDocument | SkillTrustPolicyDocument;
  dangerousTemporary: boolean;
  rollback: {
    available: boolean;
    reason: string;
    payload: TrustPlanePolicyRollbackPayload | null;
  };
};

export class ZavorthTrustPlaneActionService {
  private readonly now: () => Date;
  private readonly trustPlane: Pick<ZavorthTrustPlaneService, 'buildSnapshot'>;
  private readonly mcpToolPolicyFile: Pick<
    McpToolPolicyFileService,
    'readPolicy' | 'savePolicy' | 'setProfile' | 'allowTool' | 'removeTool'
  >;
  private readonly skillTrust: Pick<
    SkillTrustPolicyService,
    'readPolicy' | 'savePolicy' | 'setDefaultPolicy' | 'setSourceRule'
  >;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;
  private readonly policyLedger: Pick<TrustPlanePolicyLedgerService, 'append' | 'list' | 'summarize'>;

  constructor(runtime: TrustPlaneActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.trustPlane = runtime.trustPlaneService || new ZavorthTrustPlaneService();
    this.mcpToolPolicyFile = runtime.mcpToolPolicyFileService || new McpToolPolicyFileService();
    this.skillTrust = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.permissionService = runtime.permissionService || new PermissionService();
    this.policyLedger = runtime.policyLedgerService || new TrustPlanePolicyLedgerService();
  }

  public async execute(input: {
    actionId: string;
    profile?: string | null;
    toolName?: string | null;
    defaultPolicy?: string | null;
    sourceId?: string | null;
    mode?: string | null;
    skillNames?: string[] | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
    approvalScope?: ZavorthApprovalScope | string | null;
  }): Promise<ZavorthTrustPlaneActionExecution> {
    const actionId = this.normalizeActionId(input.actionId);
    const candidate = this.buildPlanCandidate(actionId, input);
    const approvalScope = this.normalizeApprovalScope(input.approvalScope, candidate.payload);
    const directReason = this.safeDirectReason(actionId, candidate.payload);
    if (!directReason) {
      return this.previewMutation(actionId, input, candidate, approvalScope);
    }

    const execution = this.applyCandidate(actionId, input);
    const diffPreview = this.buildDiffPreview(actionId, candidate, approvalScope);
    const ledgerEntry = this.appendPolicyLedger({
      actionId,
      candidate,
      diffPreview,
      input,
      status: execution.status === 'noop' ? 'noop' : 'applied',
      result: execution.summary,
    });

    return {
      ...execution,
      diffPreview,
      ledgerEntry,
      rollbackPlan: this.buildRollbackPlan(candidate, ledgerEntry),
      details: [
        ...execution.details,
        `Diff preview: ${diffPreview.entries.length} mudanca(s) em ${diffPreview.domain}.`,
        `Ledger: ${ledgerEntry.id}.`,
      ],
    };
  }

  public async apply(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<ZavorthTrustPlaneActionExecution> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'trust') {
      throw new Error(`Plano do Trust Plane nao encontrado: ${input.planId || 'n/d'}.`);
    }
    if (plan.status === 'expired' || plan.status === 'blocked') {
      throw new Error(`Plano ${plan.id} nao pode ser aplicado porque esta ${plan.status}.`);
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      throw new Error(`Plano ${plan.id} ainda aguarda approval.`);
    }

    const payload = plan.payload || {};
    const actionId = this.normalizeActionId(plan.actionId);
    const execution = this.applyCandidate(actionId, {
      profile: String(payload.profile || ''),
      toolName: String(payload.toolName || ''),
      defaultPolicy: String(payload.defaultPolicy || ''),
      sourceId: String(payload.sourceId || ''),
      mode: String(payload.mode || ''),
      skillNames: Array.isArray(payload.skillNames)
        ? payload.skillNames.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
    });

    const appliedPlan = this.mutationPlane.markApplied(plan.id, execution.summary, [execution.actionId]);
    const diffPreview = this.extractDiffPreview(payload, actionId, plan.approval.defaultScope);
    const rollbackPlan = this.extractRollbackPlan(payload);
    const ledgerEntry = this.policyLedger.append({
      domain: diffPreview?.domain || this.actionDomain(actionId),
      actionId,
      requestedBy: input.requestedBy || plan.requestedBy || null,
      sourceSurface: plan.sourceSurface || 'trust-plane',
      status: execution.status === 'noop' ? 'noop' : 'applied',
      riskLevel: plan.riskLevel,
      approvalScope: plan.approval.defaultScope || 'once',
      planId: appliedPlan.id,
      permissionId: appliedPlan.approval.permissionId || null,
      summary: execution.summary,
      diff: diffPreview?.entries || [],
      rollback: rollbackPlan,
      result: execution.summary,
    });

    return {
      ...execution,
      mutationPlan: appliedPlan,
      diffPreview,
      ledgerEntry,
      rollbackPlan: this.buildRollbackPlanFromPayload(rollbackPlan, ledgerEntry),
      details: [
        ...execution.details,
        `Mutation plan aplicado exatamente do payload salvo: ${appliedPlan.id}.`,
        `Ledger: ${ledgerEntry.id}.`,
      ],
    };
  }

  public async rollback(input: {
    ledgerId: string;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<ZavorthTrustPlaneActionExecution> {
    const ledgerId = this.normalizeToken(input.ledgerId);
    const target = this.policyLedger.list({ limit: 500 }).find((entry) => entry.id === ledgerId);
    if (!target) {
      return this.blockedRollback(`Entrada de ledger nao encontrada: ${ledgerId || 'n/d'}.`);
    }
    if (!target.rollback.available || !target.rollback.payload) {
      return this.blockedRollback(target.rollback.reason || `Ledger ${target.id} nao tem rollback tecnico.`);
    }

    const rollbackPayload = target.rollback.payload;
    if (rollbackPayload.domain === 'mcp') {
      this.mcpToolPolicyFile.savePolicy(rollbackPayload.beforePolicy as Partial<McpToolPolicyDocument>);
    } else if (rollbackPayload.domain === 'skills') {
      this.skillTrust.savePolicy(rollbackPayload.beforePolicy as SkillTrustPolicyDocument);
    } else {
      return this.blockedRollback(`Rollback de dominio ${rollbackPayload.domain} nao e suportado.`);
    }

    const reverseDiff = target.diff.map((entry) => ({
      ...entry,
      before: entry.after,
      after: entry.before,
      summary: `Rollback: ${entry.summary}`,
    }));
    const ledgerEntry = this.policyLedger.append({
      domain: target.domain,
      actionId: 'rollback-policy-mutation',
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'trust-plane',
      status: 'rolled_back',
      riskLevel: target.riskLevel,
      approvalScope: 'once',
      planId: target.planId,
      permissionId: target.permissionId,
      summary: `Rollback aplicado para ${target.id}.`,
      diff: reverseDiff,
      rollback: {
        available: false,
        reason: 'Rollback de rollback exige nova entrada do ledger.',
        payload: null,
      },
      result: `Policy restaurada a partir de ${target.id}.`,
    });

    return {
      generatedAt: this.now().toISOString(),
      actionId: 'rollback-policy-mutation',
      status: 'applied',
      ok: true,
      summary: `Rollback aplicado para ${target.id}.`,
      details: [
        `Dominio restaurado: ${target.domain}.`,
        `Ledger: ${ledgerEntry.id}.`,
      ],
      snapshot: this.trustPlane.buildSnapshot(),
      mutationPlan: null,
      trustDecision: null,
      diffPreview: null,
      ledgerEntry,
      rollbackPlan: {
        available: false,
        reason: 'Rollback aplicado; use uma nova mutacao se precisar avancar novamente.',
      },
    };
  }

  private async previewMutation(
    actionId: TrustPlaneActionId,
    input: {
      requestedBy?: string | null;
      sourceSurface?: string | null;
    },
    candidate: TrustPlanePolicyCandidate,
    approvalScope: ZavorthApprovalScope,
  ): Promise<ZavorthTrustPlaneActionExecution> {
    const before = this.trustPlane.buildSnapshot();
    const diffPreview = this.buildDiffPreview(actionId, candidate, approvalScope);
    const plan = this.mutationPlane.createPlan({
      domain: 'trust',
      actionId,
      title: candidate.title,
      summary: candidate.summary,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'trust-plane',
      riskLevel: candidate.riskLevel,
      approvalRequired: true,
      approvalReason: candidate.summary,
      resourceImpact: {
        ramMb: 0,
        diskMb: 1,
        processCount: 0,
        externalExposure: actionId.includes('mcp') ? 'local' : 'none',
        recurring: false,
        notes: ['Altera policy local; nao cria sidecar.'],
      },
      validationPlan: [
        'Comparar policy antes/depois.',
        'Exibir diff antes de aplicar.',
        'Registrar ledger de preview/aplicacao/bloqueio.',
        'Bloquear dangerous permanente sem approval explicitamente host-bound.',
      ],
      rollbackPlan: [
        candidate.rollback.available
          ? 'Reaplicar policy anterior salva no payload do ledger.'
          : candidate.rollback.reason,
      ],
      payload: {
        beforeSummary: before.summary,
        policyDomain: candidate.domain,
        approvalScope,
        diffPreview,
        rollbackPayload: candidate.rollback.payload,
        beforePolicy: candidate.beforePolicy,
        afterPolicy: candidate.afterPolicy,
        ...candidate.payload,
      },
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'trust',
      actionId,
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'trust-plane',
      riskLevel: candidate.riskLevel,
      approvalRequired: true,
      approvalScope,
      payload: candidate.payload,
      reason: candidate.summary,
    });
    const planWithApproval = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    const effectivePlan = decision.decision === 'blocked'
      ? (this.mutationPlane.markBlocked(planWithApproval.id, decision.reason) || planWithApproval)
      : planWithApproval;
    const ledgerEntry = this.appendPolicyLedger({
      actionId,
      candidate,
      diffPreview,
      input,
      status: decision.decision === 'blocked' ? 'blocked' : 'previewed',
      planId: effectivePlan.id,
      permissionId: decision.permission?.permission_id || effectivePlan.approval.permissionId || null,
      result: decision.reason,
    });

    return {
      generatedAt: this.now().toISOString(),
      actionId,
      status: decision.decision === 'blocked' ? 'blocked' : 'waiting_approval',
      ok: false,
      summary: decision.decision === 'blocked'
        ? decision.reason
        : `Preview criado para ${candidate.title}; aguardando approval antes de mutar policy.`,
      details: [
        ...candidate.details,
        `Diff preview: ${diffPreview.entries.length} mudanca(s) em ${diffPreview.domain}.`,
        `Approval scope: ${approvalScope}.`,
        `Plan: ${effectivePlan.id}.`,
        `Ledger: ${ledgerEntry.id}.`,
        decision.permission ? `Permission: ${decision.permission.permission_id}.` : 'Permission pendente nao criada.',
      ],
      snapshot: before,
      mutationPlan: effectivePlan,
      trustDecision: decision,
      diffPreview,
      ledgerEntry,
      rollbackPlan: this.buildRollbackPlan(candidate, ledgerEntry),
    };
  }

  private applyCandidate(
    actionId: TrustPlaneActionId,
    input: {
      profile?: string | null;
      toolName?: string | null;
      defaultPolicy?: string | null;
      sourceId?: string | null;
      mode?: string | null;
      skillNames?: string[] | null;
    },
  ): ZavorthTrustPlaneActionExecution {
    switch (actionId) {
      case 'set-mcp-profile':
        return this.executeMcpProfile(input.profile);
      case 'allow-mcp-tool':
        return this.executeMcpAllowTool(input.toolName);
      case 'remove-mcp-tool':
        return this.executeMcpRemoveTool(input.toolName);
      case 'set-skill-default':
        return this.executeSkillDefault(input.defaultPolicy);
      case 'set-skill-source-mode':
        return this.executeSkillSourceMode({
          sourceId: input.sourceId,
          mode: input.mode,
          skillNames: input.skillNames || [],
        });
      default:
        throw new Error(`Acao do Trust Plane desconhecida: ${actionId}.`);
    }
  }

  private executeMcpProfile(profileInput: string | null | undefined): ZavorthTrustPlaneActionExecution {
    const profile = this.normalizeProfile(profileInput);
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.mcpToolPolicyFile.setProfile(profile);
    const changed = before.profile !== after.profile;
    return this.finish('set-mcp-profile', changed ? 'applied' : 'noop', changed
      ? `Perfil MCP alterado para ${after.profile}.`
      : `Perfil MCP ja estava em ${after.profile}.`, [
      `Allowlist MCP atual: ${after.allowlist.length} tool(s) explicita(s).`,
      'Use MCP dangerous somente com approval forte e finalidade clara.',
    ]);
  }

  private executeMcpAllowTool(toolNameInput: string | null | undefined): ZavorthTrustPlaneActionExecution {
    const toolName = this.normalizeToken(toolNameInput);
    if (!toolName) {
      throw new Error('toolName obrigatorio para liberar uma tool MCP.');
    }
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.mcpToolPolicyFile.allowTool(toolName);
    const changed = before.allowlist.join(',') !== after.allowlist.join(',');
    return this.finish('allow-mcp-tool', changed ? 'applied' : 'noop', changed
      ? `Tool MCP ${toolName} adicionada na allowlist explicita.`
      : `Tool MCP ${toolName} ja estava liberada na allowlist.`, [
      `Perfil MCP atual: ${after.profile}.`,
      `Allowlist MCP agora tem ${after.allowlist.length} item(ns).`,
    ]);
  }

  private executeMcpRemoveTool(toolNameInput: string | null | undefined): ZavorthTrustPlaneActionExecution {
    const toolName = this.normalizeToken(toolNameInput);
    if (!toolName) {
      throw new Error('toolName obrigatorio para remover uma tool MCP.');
    }
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.mcpToolPolicyFile.removeTool(toolName);
    const changed = before.allowlist.join(',') !== after.allowlist.join(',');
    return this.finish('remove-mcp-tool', changed ? 'applied' : 'noop', changed
      ? `Tool MCP ${toolName} removida da allowlist explicita.`
      : `Tool MCP ${toolName} nao estava na allowlist explicita.`, [
      `Perfil MCP atual: ${after.profile}.`,
      `Allowlist MCP agora tem ${after.allowlist.length} item(ns).`,
    ]);
  }

  private executeSkillDefault(defaultPolicyInput: string | null | undefined): ZavorthTrustPlaneActionExecution {
    const defaultPolicy = this.normalizeDefaultPolicy(defaultPolicyInput);
    const before = this.skillTrust.readPolicy();
    const after = this.skillTrust.setDefaultPolicy(defaultPolicy);
    const changed = before.defaultPolicy !== after.defaultPolicy;
    return this.finish('set-skill-default', changed ? 'applied' : 'noop', changed
      ? `Policy default de skills alterada para ${after.defaultPolicy}.`
      : `Policy default de skills ja estava em ${after.defaultPolicy}.`, [
      `Sources base liberadas: ${after.allowedSourceIds.length}.`,
      'Mantenha deny por default sempre que a origem da skill ainda nao foi revisada.',
    ]);
  }

  private executeSkillSourceMode(input: {
    sourceId?: string | null;
    mode?: string | null;
    skillNames?: string[];
  }): ZavorthTrustPlaneActionExecution {
    const sourceId = this.normalizeToken(input.sourceId);
    if (!sourceId) {
      throw new Error('sourceId obrigatorio para ajustar trust de skills.');
    }
    const mode = this.normalizeSkillMode(input.mode);
    const before = this.skillTrust.readPolicy();
    const after = this.skillTrust.setSourceRule({
      sourceId,
      mode,
      skillNames: Array.isArray(input.skillNames) ? input.skillNames : [],
      reason: `Atualizado pelo Trust Plane para modo ${mode}.`,
    });
    const previousRule = before.rules.find((entry) => entry.sourceId === sourceId);
    const nextRule = after.rules.find((entry) => entry.sourceId === sourceId) || null;
    const changed = JSON.stringify(previousRule || null) !== JSON.stringify(nextRule);
    return this.finish('set-skill-source-mode', changed ? 'applied' : 'noop', changed
      ? `Source ${sourceId} atualizada para modo ${mode}.`
      : `Source ${sourceId} ja estava em modo ${mode}.`, [
      nextRule?.skillNames?.length
        ? `${nextRule.skillNames.length} skill(s) explicita(s) seguem liberadas para esta source.`
        : 'Nenhuma skill explicita foi adicionada nesta alteracao.',
      `Policy default atual: ${after.defaultPolicy}.`,
    ]);
  }

  private finish(
    actionId: TrustPlaneResultActionId,
    status: ZavorthTrustPlaneActionExecution['status'],
    summary: string,
    details: string[],
    overrides: Partial<ZavorthTrustPlaneActionExecution> = {},
  ): ZavorthTrustPlaneActionExecution {
    return {
      generatedAt: this.now().toISOString(),
      actionId,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      snapshot: this.trustPlane.buildSnapshot(),
      mutationPlan: null,
      trustDecision: null,
      diffPreview: null,
      ledgerEntry: null,
      rollbackPlan: null,
      ...overrides,
    };
  }

  private blockedRollback(summary: string): ZavorthTrustPlaneActionExecution {
    return this.finish('rollback-policy-mutation', 'blocked', summary, [
      'Rollback nao alterou nenhuma policy.',
    ]);
  }

  private buildPlanCandidate(
    actionId: TrustPlaneActionId,
    input: {
      profile?: string | null;
      toolName?: string | null;
      defaultPolicy?: string | null;
      sourceId?: string | null;
      mode?: string | null;
      skillNames?: string[] | null;
    },
  ): TrustPlanePolicyCandidate {
    if (actionId === 'set-mcp-profile') {
      return this.buildMcpProfileCandidate(input.profile);
    }
    if (actionId === 'allow-mcp-tool') {
      return this.buildMcpAllowToolCandidate(input.toolName);
    }
    if (actionId === 'remove-mcp-tool') {
      return this.buildMcpRemoveToolCandidate(input.toolName);
    }
    if (actionId === 'set-skill-default') {
      return this.buildSkillDefaultCandidate(input.defaultPolicy);
    }
    return this.buildSkillSourceModeCandidate({
      sourceId: input.sourceId,
      mode: input.mode,
      skillNames: input.skillNames || [],
    });
  }

  private buildMcpProfileCandidate(profileInput: string | null | undefined): TrustPlanePolicyCandidate {
    const profile = this.normalizeProfile(profileInput);
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.normalizeMcpDocument({ ...before, profile });
    const riskLevel: ZavorthMutationRiskLevel = profile === 'dangerous' ? 'critical' : profile === 'trusted' ? 'high' : 'medium';
    return this.buildCandidate({
      domain: 'mcp',
      title: `Alterar perfil MCP para ${profile}`,
      summary: `Alterar MCP para ${profile} amplia ou reduz poder das tools locais.`,
      payload: { profile },
      riskLevel,
      details: [
        profile === 'safe'
          ? 'safe reduz risco e pode aplicar direto.'
          : 'trusted/dangerous exigem approval por ampliar poder.',
      ],
      diff: [this.diffEntry('mcp.profile', before.profile, after.profile, `Perfil MCP: ${before.profile} -> ${after.profile}.`, riskLevel)],
      beforePolicy: before,
      afterPolicy: after,
      dangerousTemporary: profile === 'dangerous',
    });
  }

  private buildMcpAllowToolCandidate(toolNameInput: string | null | undefined): TrustPlanePolicyCandidate {
    const toolName = this.normalizeToken(toolNameInput);
    if (!toolName) {
      throw new Error('toolName obrigatorio para liberar uma tool MCP.');
    }
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.normalizeMcpDocument({
      ...before,
      allowlist: [...before.allowlist, toolName],
    });
    return this.buildCandidate({
      domain: 'mcp',
      title: `Liberar MCP tool ${toolName}`,
      summary: `Adicionar ${toolName} a allowlist MCP amplia superficie executavel.`,
      payload: { toolName },
      riskLevel: 'high',
      details: ['Allowlist MCP so pode ampliar via mutation plan aprovado.'],
      diff: [this.diffEntry('mcp.allowlist', before.allowlist, after.allowlist, `Allowlist MCP recebe ${toolName}.`, 'high')],
      beforePolicy: before,
      afterPolicy: after,
      dangerousTemporary: false,
    });
  }

  private buildMcpRemoveToolCandidate(toolNameInput: string | null | undefined): TrustPlanePolicyCandidate {
    const toolName = this.normalizeToken(toolNameInput);
    if (!toolName) {
      throw new Error('toolName obrigatorio para remover uma tool MCP.');
    }
    const before = this.mcpToolPolicyFile.readPolicy();
    const after = this.normalizeMcpDocument({
      ...before,
      allowlist: before.allowlist.filter((entry) => entry !== toolName),
    });
    return this.buildCandidate({
      domain: 'mcp',
      title: `Remover MCP tool ${toolName}`,
      summary: `Remover ${toolName} da allowlist MCP reduz risco.`,
      payload: { toolName },
      riskLevel: 'medium',
      details: ['Remocao de tool reduz risco e pode aplicar direto.'],
      diff: [this.diffEntry('mcp.allowlist', before.allowlist, after.allowlist, `Allowlist MCP remove ${toolName}.`, 'medium')],
      beforePolicy: before,
      afterPolicy: after,
      dangerousTemporary: false,
    });
  }

  private buildSkillDefaultCandidate(defaultPolicyInput: string | null | undefined): TrustPlanePolicyCandidate {
    const defaultPolicy = this.normalizeDefaultPolicy(defaultPolicyInput);
    const before = this.skillTrust.readPolicy();
    const after = { ...before, defaultPolicy };
    const riskLevel: ZavorthMutationRiskLevel = defaultPolicy === 'allow' ? 'high' : 'medium';
    return this.buildCandidate({
      domain: 'skills',
      title: `Alterar default de skills para ${defaultPolicy}`,
      summary: `Default ${defaultPolicy} altera trust global de skills.`,
      payload: { defaultPolicy },
      riskLevel,
      details: [
        defaultPolicy === 'deny'
          ? 'deny reduz risco e pode aplicar direto.'
          : 'allow amplia poder e exige approval.',
      ],
      diff: [this.diffEntry('skills.defaultPolicy', before.defaultPolicy, after.defaultPolicy, `Default de skills: ${before.defaultPolicy} -> ${after.defaultPolicy}.`, riskLevel)],
      beforePolicy: before,
      afterPolicy: after,
      dangerousTemporary: false,
    });
  }

  private buildSkillSourceModeCandidate(input: {
    sourceId?: string | null;
    mode?: string | null;
    skillNames?: string[] | null;
  }): TrustPlanePolicyCandidate {
    const mode = this.normalizeSkillMode(input.mode);
    const sourceId = this.normalizeToken(input.sourceId);
    if (!sourceId) {
      throw new Error('sourceId obrigatorio para ajustar trust de skills.');
    }
    const before = this.skillTrust.readPolicy();
    const skillNames = Array.isArray(input.skillNames)
      ? input.skillNames.map((entry) => this.normalizeToken(entry)).filter(Boolean)
      : [];
    const beforeRule = before.rules.find((entry) => entry.sourceId === sourceId) || null;
    const rules = before.rules.filter((entry) => entry.sourceId !== sourceId);
    rules.push({
      sourceId,
      mode,
      skillNames,
      reason: `Atualizado pelo Trust Plane para modo ${mode}.`,
    });
    const allowedSourceIds = new Set(before.allowedSourceIds);
    if (mode === 'all') {
      allowedSourceIds.add(sourceId);
    }
    if (mode === 'none') {
      allowedSourceIds.delete(sourceId);
    }
    const after: SkillTrustPolicyDocument = {
      ...before,
      allowedSourceIds: Array.from(allowedSourceIds.values()),
      rules,
    };
    const afterRule = after.rules.find((entry) => entry.sourceId === sourceId) || null;
    const riskLevel: ZavorthMutationRiskLevel = mode === 'all' ? 'high' : 'medium';
    return this.buildCandidate({
      domain: 'skills',
      title: `Alterar source ${sourceId} para ${mode}`,
      summary: `Alterar source ${sourceId} para ${mode} muda trust de skills.`,
      payload: { sourceId, mode, skillNames },
      riskLevel,
      details: [
        mode === 'none'
          ? 'none reduz risco e pode aplicar direto.'
          : 'all/explicit ampliam acesso de skills e exigem approval.',
      ],
      diff: [this.diffEntry(`skills.rules.${sourceId}`, beforeRule, afterRule, `Source ${sourceId}: ${beforeRule?.mode || 'n/d'} -> ${afterRule?.mode || 'n/d'}.`, riskLevel)],
      beforePolicy: before,
      afterPolicy: after,
      dangerousTemporary: false,
    });
  }

  private buildCandidate(input: Omit<TrustPlanePolicyCandidate, 'rollback'>): TrustPlanePolicyCandidate {
    const rollbackPayload: TrustPlanePolicyRollbackPayload = {
      domain: input.domain,
      beforePolicy: input.beforePolicy,
      afterPolicy: input.afterPolicy,
    };
    return {
      ...input,
      rollback: {
        available: this.hasPolicyChange(input.beforePolicy, input.afterPolicy),
        reason: this.hasPolicyChange(input.beforePolicy, input.afterPolicy)
          ? 'Policy anterior salva para rollback tecnico.'
          : 'Sem mudanca material; rollback nao e necessario.',
        payload: this.hasPolicyChange(input.beforePolicy, input.afterPolicy) ? rollbackPayload : null,
      },
    };
  }

  private appendPolicyLedger(input: {
    actionId: TrustPlaneActionId;
    candidate: TrustPlanePolicyCandidate;
    diffPreview: ZavorthTrustPlanePolicyDiffPreview;
    input: {
      requestedBy?: string | null;
      sourceSurface?: string | null;
    };
    status: TrustPlanePolicyLedgerEntry['status'];
    planId?: string | null;
    permissionId?: string | null;
    result?: string | null;
  }): TrustPlanePolicyLedgerEntry {
    return this.policyLedger.append({
      domain: input.candidate.domain,
      actionId: input.actionId,
      requestedBy: input.input.requestedBy || null,
      sourceSurface: input.input.sourceSurface || 'trust-plane',
      status: input.status,
      riskLevel: input.candidate.riskLevel,
      approvalScope: input.diffPreview.approvalScope,
      planId: input.planId || null,
      permissionId: input.permissionId || null,
      summary: input.candidate.summary,
      diff: input.diffPreview.entries,
      rollback: input.candidate.rollback,
      result: input.result || null,
    });
  }

  private buildDiffPreview(
    actionId: TrustPlaneActionId,
    candidate: TrustPlanePolicyCandidate,
    approvalScope: ZavorthApprovalScope,
  ): ZavorthTrustPlanePolicyDiffPreview {
    return {
      domain: candidate.domain,
      actionId,
      approvalScope,
      summary: candidate.summary,
      dangerousTemporary: candidate.dangerousTemporary && approvalScope !== 'host',
      rollbackAvailable: candidate.rollback.available,
      rollbackReason: candidate.rollback.reason,
      entries: candidate.diff,
    };
  }

  private buildRollbackPlan(
    candidate: TrustPlanePolicyCandidate,
    ledgerEntry: TrustPlanePolicyLedgerEntry | null,
  ): ZavorthTrustPlaneActionExecution['rollbackPlan'] {
    return {
      available: candidate.rollback.available,
      reason: candidate.rollback.reason,
      ledgerId: ledgerEntry?.id || null,
      payload: candidate.rollback.payload,
    };
  }

  private buildRollbackPlanFromPayload(
    rollback: TrustPlanePolicyLedgerEntry['rollback'],
    ledgerEntry: TrustPlanePolicyLedgerEntry,
  ): ZavorthTrustPlaneActionExecution['rollbackPlan'] {
    return {
      available: rollback.available,
      reason: rollback.reason,
      ledgerId: ledgerEntry.id,
      payload: rollback.payload || null,
    };
  }

  private extractDiffPreview(
    payload: Record<string, unknown>,
    actionId: TrustPlaneActionId,
    fallbackScope: ZavorthApprovalScope,
  ): ZavorthTrustPlanePolicyDiffPreview | null {
    const raw = payload.diffPreview as Partial<ZavorthTrustPlanePolicyDiffPreview> | undefined;
    if (!raw || !Array.isArray(raw.entries)) {
      return null;
    }
    const approvalScope = this.normalizeApprovalScope(raw.approvalScope || fallbackScope, payload);
    return {
      domain: this.actionDomain(actionId),
      actionId,
      approvalScope,
      summary: String(raw.summary || '').trim() || `Diff preview para ${actionId}.`,
      dangerousTemporary: raw.dangerousTemporary === true,
      rollbackAvailable: raw.rollbackAvailable === true,
      rollbackReason: String(raw.rollbackReason || '').trim() || 'Rollback indisponivel.',
      entries: raw.entries,
    };
  }

  private extractRollbackPlan(payload: Record<string, unknown>): TrustPlanePolicyLedgerEntry['rollback'] {
    const rollbackPayload = payload.rollbackPayload as TrustPlanePolicyRollbackPayload | null | undefined;
    return {
      available: Boolean(rollbackPayload),
      reason: rollbackPayload ? 'Policy anterior salva para rollback tecnico.' : 'Payload antigo sem rollback tecnico.',
      payload: rollbackPayload || null,
    };
  }

  private actionDomain(actionId: TrustPlaneActionId): 'mcp' | 'skills' {
    return actionId.includes('mcp') ? 'mcp' : 'skills';
  }

  private diffEntry(
    diffPath: string,
    before: unknown,
    after: unknown,
    summary: string,
    riskLevel: ZavorthMutationRiskLevel,
  ): TrustPlanePolicyDiffEntry {
    return {
      path: diffPath,
      before,
      after,
      summary,
      riskLevel,
      reversible: true,
    };
  }

  private hasPolicyChange(before: unknown, after: unknown): boolean {
    return JSON.stringify(before) !== JSON.stringify(after);
  }

  private normalizeMcpDocument(input: Partial<McpToolPolicyDocument>): McpToolPolicyDocument {
    const policy = new McpToolPolicy({
      profile: input.profile,
      allowlist: Array.isArray(input.allowlist) ? input.allowlist : [],
    });
    return {
      version: Number.isFinite(input.version) ? Number(input.version) : 1,
      updatedAt: typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt.trim() : null,
      profile: policy.profile,
      allowlist: policy.getAllowlist(),
    };
  }

  private safeDirectReason(
    actionId: TrustPlaneActionId,
    payload: Record<string, unknown>,
  ): string | null {
    if (actionId === 'set-mcp-profile' && payload.profile === 'safe') {
      return 'MCP safe reduz risco.';
    }
    if (actionId === 'remove-mcp-tool') {
      return 'Remover allowlist MCP reduz risco.';
    }
    if (actionId === 'set-skill-default' && payload.defaultPolicy === 'deny') {
      return 'Skills deny reduz risco.';
    }
    if (actionId === 'set-skill-source-mode' && payload.mode === 'none') {
      return 'Negar source de skills reduz risco.';
    }
    return null;
  }

  private normalizeActionId(value: string): TrustPlaneActionId {
    const normalized = String(value || '').trim().toLowerCase();
    if (
      normalized === 'set-mcp-profile'
      || normalized === 'allow-mcp-tool'
      || normalized === 'remove-mcp-tool'
      || normalized === 'set-skill-default'
      || normalized === 'set-skill-source-mode'
    ) {
      return normalized;
    }
    throw new Error(`Acao do Trust Plane desconhecida: ${value || 'n/d'}.`);
  }

  private normalizeApprovalScope(
    value: ZavorthApprovalScope | string | null | undefined,
    payload: Record<string, unknown>,
  ): ZavorthApprovalScope {
    const normalized = String(value || '').trim().toLowerCase();
    if (payload.profile === 'dangerous') {
      return normalized === 'host' ? 'host' : 'once';
    }
    if (normalized === 'session' || normalized === 'host') {
      return normalized;
    }
    return 'once';
  }

  private normalizeProfile(value: string | null | undefined): McpSecurityProfile {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'trusted' || normalized === 'dangerous' || normalized === 'safe') {
      return normalized;
    }
    throw new Error('profile obrigatorio e deve ser safe, trusted ou dangerous.');
  }

  private normalizeDefaultPolicy(value: string | null | undefined): SkillTrustPolicyDefault {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'allow' || normalized === 'deny') {
      return normalized;
    }
    throw new Error('defaultPolicy obrigatorio e deve ser allow ou deny.');
  }

  private normalizeSkillMode(value: string | null | undefined): SkillAllowMode {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'all' || normalized === 'explicit' || normalized === 'none') {
      return normalized;
    }
    throw new Error('mode obrigatorio e deve ser all, explicit ou none.');
  }

  private normalizeToken(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }
}
