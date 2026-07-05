import type { TaskResourceImpact } from '../contracts/TaskResourcePlannerContract.js';
import type {
  ZavorthResponseDecision,
  ZavorthResponseDecisionConfidence,
  ZavorthResponseDecisionMode,
  ZavorthResponseDecisionPath,
  ZavorthResponseDecisionTarget,
} from '../contracts/ZavorthResponseDecisionContract.js';
import { createZavorthResponseArtifactPolicy } from '../contracts/ZavorthResponseDecisionContract.js';
import { inferUniversalAgentRequestedTools } from '../runtime/agent/index.js';
import {
  UniversalIntentService,
  type UniversalIntentDecision,
} from '../runtime/uni/index.js';
import { AiFirstOwnerControlledDefaultActivationService } from './AiFirstOwnerControlledDefaultActivationService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import {
UserExperienceIntentRouter,
  type UserExperienceIntentDecision,
} from './UserExperienceIntentRouter.js';

export type SurfaceOperationalIntent = {
  surface: 'web' | 'cli' | 'telegram' | 'discord' | string;
  text: string;
  explicitExecution?: boolean | null;
  hasContextualMentions?: boolean | null;
  hasAttachments?: boolean | null;
  resourceImpact?: TaskResourceImpact | null;
  capabilityIds?: string[] | null;
};

export type SurfaceOperationalIntentDecision = {
  shouldExecute: boolean;
  requestedTools: string[];
  uxIntent?: UserExperienceIntentDecision | null;
  reason:
    | 'ux-conversation-first'
    | 'ux-tool-intent'
    | 'ux-approval-intent'
    | 'explicit-execution'
    | 'contextual-mentions-owned-by-composer'
    | 'attachment-present'
    | 'tool-affordance-detected'
    | 'resource-impact-detected'
    | 'semantic-operational'
    | 'semantic-conversation'
    | 'semantic-unavailable'
    | 'conversation-only';
};

type SemanticOperationalIntentClassifier = {
  chat: LlmRuntimeService['chat'];
  isProviderAvailable?: LlmRuntimeService['isProviderAvailable'];
  getPreferredProviderName?: LlmRuntimeService['getPreferredProviderName'];
};

export type SurfaceOperationalIntentServiceOptions = {
  semanticClassifier?: SemanticOperationalIntentClassifier | null;
  semanticTimeoutMs?: number;
  universalIntentService?: Pick<UniversalIntentService, 'decide'> | null;
  ownerControlledDefaultActivationService?: Pick<AiFirstOwnerControlledDefaultActivationService, 'status'> | null;
  uxIntentRouter?: Pick<UserExperienceIntentRouter, 'decide'> | null;
};

export class SurfaceOperationalIntentService {
  private readonly semanticClassifier: SemanticOperationalIntentClassifier | null;
  private readonly semanticTimeoutMs: number;
  private readonly universalIntentService: Pick<UniversalIntentService, 'decide'> | null;
  private readonly ownerControlledDefaultActivationService: Pick<AiFirstOwnerControlledDefaultActivationService, 'status'> | null;
  private readonly uxIntentRouter: Pick<UserExperienceIntentRouter, 'decide'> | null;

  constructor(options: SurfaceOperationalIntentServiceOptions = {}) {
    this.semanticClassifier = options.semanticClassifier === undefined
      ? new LlmRuntimeService()
      : options.semanticClassifier;
    this.semanticTimeoutMs = Math.max(100, Number(options.semanticTimeoutMs || 900) || 900);
    this.universalIntentService = options.universalIntentService === undefined
      ? new UniversalIntentService()
      : options.universalIntentService;
    this.ownerControlledDefaultActivationService = options.ownerControlledDefaultActivationService === undefined
      ? new AiFirstOwnerControlledDefaultActivationService()
      : options.ownerControlledDefaultActivationService;
    this.uxIntentRouter = options.uxIntentRouter === undefined
      ? new UserExperienceIntentRouter()
      : options.uxIntentRouter;
  }

  public classify(input: SurfaceOperationalIntent): SurfaceOperationalIntentDecision {
    const text = String(input.text || '').trim();
    const resourceCapabilityIds = this.collectCapabilityIds(input);
    const requestedTools = inferUniversalAgentRequestedTools({
      text,
      capabilityIds: resourceCapabilityIds,
      fallbackTool: null,
    });
    const uxIntent = this.uxIntentRouter?.decide({
      text,
      explicitExecution: input.explicitExecution,
      hasAttachments: input.hasAttachments,
      hasContextualMentions: input.hasContextualMentions,
    }) || null;

    if (input.hasContextualMentions) {
      return {
        shouldExecute: false,
        requestedTools,
        uxIntent,
        reason: 'contextual-mentions-owned-by-composer',
      };
    }

    if (
      uxIntent
      && uxIntent.confidence === 'high'
      && !uxIntent.shouldUseTools
      && requestedTools.length === 0
      && !input.explicitExecution
      && !input.hasAttachments
    ) {
      return {
        shouldExecute: false,
        requestedTools: [],
        uxIntent,
        reason: 'conversation-only',
      };
    }

    if (input.explicitExecution) {
      return {
        shouldExecute: true,
        requestedTools: requestedTools.length > 0 ? requestedTools : ['memory.read'],
        uxIntent,
        reason: 'explicit-execution',
      };
    }

    if (input.hasAttachments) {
      return {
        shouldExecute: true,
        requestedTools: requestedTools.length > 0 ? requestedTools : ['media.inspect'],
        uxIntent,
        reason: 'attachment-present',
      };
    }

    if (requestedTools.length > 0) {
      return {
        shouldExecute: true,
        requestedTools,
        uxIntent,
        reason: 'tool-affordance-detected',
      };
    }

    if (this.resourceRequiresWork(input.resourceImpact || null, resourceCapabilityIds)) {
      return {
        shouldExecute: true,
        requestedTools,
        uxIntent,
        reason: 'resource-impact-detected',
      };
    }

    if (uxIntent?.shouldUseTools && uxIntent.explicitAction && uxIntent.explicitTarget) {
      return {
        shouldExecute: true,
        requestedTools: uxIntent.kind === 'diagnose'
          ? ['status.inspect']
          : uxIntent.kind === 'configure'
            ? ['configuration.preview']
            : ['workflow.preview'],
        uxIntent,
        reason: uxIntent.shouldAskApproval ? 'ux-approval-intent' : 'ux-tool-intent',
      };
    }

    return {
      shouldExecute: false,
      requestedTools,
      uxIntent,
      reason: 'conversation-only',
    };
  }


  public async classifyWithSemantic(input: SurfaceOperationalIntent): Promise<SurfaceOperationalIntentDecision> {
    const structural = this.classify(input);
    if (!structural.shouldExecute && this.looksLikePassiveLinkShare(input.text)) {
      return {
        ...structural,
        reason: 'conversation-only',
      };
    }
    if (this.shouldUseOwnerControlledAiFirstDefault(input)) {
      const semantic = await this.classifyAmbiguousIntent(input).catch(() => null);
      if (semantic) {
        return semantic.shouldExecute
          ? {
              shouldExecute: true,
              requestedTools: semantic.requestedTools.length > 0 ? semantic.requestedTools : structural.requestedTools,
              uxIntent: structural.uxIntent,
              reason: 'semantic-operational',
            }
          : {
              shouldExecute: false,
              requestedTools: structural.requestedTools,
              uxIntent: structural.uxIntent,
              reason: 'semantic-conversation',
            };
      }
      return structural.shouldExecute ? structural : { ...structural, reason: 'semantic-unavailable' };
    }
    if (structural.shouldExecute || !this.shouldAskSemanticClassifier(input, structural)) {
      return structural;
    }

    const semantic = await this.classifyAmbiguousIntent(input).catch(() => null);
    if (!semantic) {
      return { ...structural, reason: 'semantic-unavailable' };
    }

    if (semantic.shouldExecute) {
      return {
        shouldExecute: true,
        requestedTools: semantic.requestedTools.length > 0 ? semantic.requestedTools : structural.requestedTools,
        uxIntent: structural.uxIntent,
        reason: 'semantic-operational',
      };
    }

    return {
      shouldExecute: false,
      requestedTools: structural.requestedTools,
      uxIntent: structural.uxIntent,
      reason: 'semantic-conversation',
    };
  }

  public async decideResponse(input: SurfaceOperationalIntent): Promise<ZavorthResponseDecision> {
    const intentDecision = await this.classifyWithSemantic(input);
    const universalIntent = this.resolveUniversalIntent(input, intentDecision);
    return this.toResponseDecision(input, intentDecision, universalIntent);
  }

  public toResponseDecision(
    input: SurfaceOperationalIntent,
    intentDecision: SurfaceOperationalIntentDecision,
    universalIntent: UniversalIntentDecision | null = null,
  ): ZavorthResponseDecision {
    const requestedTools = this.normalizeToolIds(intentDecision.requestedTools);
    const mode = this.inferResponseMode(input, intentDecision, requestedTools);
    const responsePath = this.inferResponsePath(mode);
    const target = this.inferResponseTarget(input, mode, requestedTools);
    const artifactPolicy = this.inferArtifactPolicy(mode, intentDecision, requestedTools);

    return {
      schemaVersion: 1,
      mode,
      confidence: this.inferDecisionConfidence(intentDecision),
      reason: this.describeResponseDecision(mode, intentDecision.reason),
      sourceReason: intentDecision.reason,
      target,
      requestedTools,
      responsePath,
      shouldCreateArtifact: artifactPolicy.shouldCreateArtifact,
      shouldShowArtifactInChat: artifactPolicy.shouldShowArtifactInChat,
      artifactPolicy,
      diagnostics: {
        surface: input.surface,
        shouldExecute: intentDecision.shouldExecute,
        semantic: intentDecision.reason === 'semantic-operational'
          || intentDecision.reason === 'semantic-conversation'
          || intentDecision.reason === 'semantic-unavailable',
        uxIntent: intentDecision.uxIntent
          ? {
            kind: intentDecision.uxIntent.kind,
            confidence: intentDecision.uxIntent.confidence,
            shouldUseTools: intentDecision.uxIntent.shouldUseTools,
            shouldAskApproval: intentDecision.uxIntent.shouldAskApproval,
            reason: intentDecision.uxIntent.reason,
          }
          : null,
        universalIntent: universalIntent
          ? {
            intent: universalIntent.intent,
            risk: universalIntent.risk,
            nextSafeAction: universalIntent.nextSafeAction,
            requiresClarification: universalIntent.requiresClarification,
            requiresPermission: universalIntent.requiresPermission,
          }
          : null,
        trustSlider: universalIntent
          ? {
            level: universalIntent.trustSlider.level,
            decision: universalIntent.trustSlider.decision,
            sandboxTier: universalIntent.trustSlider.sandboxTier,
            permissionBoundary: universalIntent.trustSlider.permissionBoundary,
            permissionScope: universalIntent.trustSlider.permissionScope,
            hostAllowed: universalIntent.trustSlider.hostAllowed,
            blocked: universalIntent.trustSlider.blocked,
          }
          : null,
      },
    };
  }

  private resolveUniversalIntent(
    input: SurfaceOperationalIntent,
    intentDecision: SurfaceOperationalIntentDecision,
  ): UniversalIntentDecision | null {
    if (!this.universalIntentService) {
      return null;
    }
    try {
      return this.universalIntentService.decide({
        surface: input.surface,
        text: input.text,
        capabilityIds: intentDecision.requestedTools,
        riskHints: {
          approvalRequired: input.resourceImpact?.approvalRequired || false,
          externalSideEffect: input.resourceImpact?.budget?.externalExposure === 'network'
            || input.resourceImpact?.budget?.externalExposure === 'public',
        },
      });
    } catch (error) { logger.warn('[Surface Operational] module import failed', error); return null; }
  }

  private collectCapabilityIds(input: SurfaceOperationalIntent): string[] {
    const values = new Set<string>();
    const explicitIds = Array.isArray(input.capabilityIds) ? input.capabilityIds : [];
    const resourceIds = Array.isArray(input.resourceImpact?.budget?.capabilityIds)
      ? input.resourceImpact.budget.capabilityIds
      : [];
    for (const value of [...explicitIds, ...resourceIds]) {
      const normalized = String(value || '').trim();
      if (normalized) {
        values.add(normalized);
      }
    }
    return Array.from(values);
  }

  private normalizeToolIds(toolIds: string[]): string[] {
    const tools = new Set<string>();
    for (const toolId of toolIds || []) {
      const normalized = String(toolId || '').trim();
      if (normalized) {
        tools.add(normalized);
      }
    }
    return Array.from(tools);
  }

  private inferResponseMode(
    input: SurfaceOperationalIntent,
    intentDecision: SurfaceOperationalIntentDecision,
    requestedTools: string[],
  ): ZavorthResponseDecisionMode {
    if (!intentDecision.shouldExecute) {
      return 'conversation';
    }
    if (input.resourceImpact?.approvalRequired) {
      return 'approval';
    }
    if (this.hasTool(requestedTools, 'read_file') && this.looksLikeFileInspection(input.text)) {
      return 'file-inspection';
    }
    return 'operation';
  }

  private inferResponsePath(mode: ZavorthResponseDecisionMode): ZavorthResponseDecisionPath {
    if (mode === 'conversation') {
      return 'fast-chat';
    }
    if (mode === 'approval') {
      return 'approval-gate';
    }
    if (mode === 'file-inspection') {
      return 'local-inspector';
    }
    return 'agent-runtime';
  }

  private inferResponseTarget(
    input: SurfaceOperationalIntent,
    mode: ZavorthResponseDecisionMode,
    requestedTools: string[],
  ): ZavorthResponseDecisionTarget {
    if (mode === 'conversation') {
      return { type: 'none', value: null };
    }
    if (input.hasAttachments || this.hasAnyTool(requestedTools, ['media.inspect', 'image.inspect', 'audio.transcribe'])) {
      return { type: 'media', value: null };
    }
    if (this.hasAnyTool(requestedTools, ['network_fetch', 'web.search', 'browser.open'])) {
      return { type: 'web', value: null };
    }
    if (this.hasAnyTool(requestedTools, ['shell.exec', 'bash.exec', 'powershell.exec'])) {
      return { type: 'shell', value: null };
    }
    if (mode === 'approval') {
      return { type: 'workflow', value: null };
    }
    if (this.hasAnyTool(requestedTools, ['pdf.generate', 'report.send', 'email.send'])) {
      return { type: 'workflow', value: null };
    }
    if (this.hasAnyTool(requestedTools, ['read_file', 'workspace.read', 'folder.read'])) {
      return {
        type: this.looksLikeFolderTarget(input.text) ? 'folder' : 'file',
        value: null,
      };
    }
    if (this.hasAnyTool(requestedTools, ['write_file', 'filesystem.write', 'file.edit'])) {
      return { type: 'file', value: null };
    }
    return { type: 'workflow', value: null };
  }

  private inferArtifactPolicy(
    mode: ZavorthResponseDecisionMode,
    intentDecision: SurfaceOperationalIntentDecision,
    requestedTools: string[],
  ) {
    if (!intentDecision.shouldExecute || mode === 'conversation') {
      return createZavorthResponseArtifactPolicy({
        reason: 'conversation-response-does-not-create-artifact',
      });
    }

    const showableArtifactTools = [
      'pdf.generate',
      'report.send',
      'artifact.create',
      'artifact.export',
      'diff.export',
    ];
    const artifactCreatingTools = [
      ...showableArtifactTools,
      'write_file',
      'filesystem.write',
      'file.edit',
    ];
    const shouldCreateArtifact = this.hasAnyTool(requestedTools, artifactCreatingTools);
    const shouldShowArtifactInChat = this.hasAnyTool(requestedTools, showableArtifactTools);

    return createZavorthResponseArtifactPolicy({
      shouldCreateArtifact,
      shouldShowArtifactInChat,
      reason: shouldShowArtifactInChat
        ? 'deliverable-artifact-requested'
        : shouldCreateArtifact
          ? 'working-artifact-kept-out-of-chat'
          : 'operation-without-user-facing-artifact',
    });
  }

  private inferDecisionConfidence(intentDecision: SurfaceOperationalIntentDecision): ZavorthResponseDecisionConfidence {
    if (intentDecision.reason === 'semantic-unavailable') {
      return 'low';
    }
    if (intentDecision.reason === 'ux-conversation-first'
      || intentDecision.reason === 'ux-tool-intent'
      || intentDecision.reason === 'ux-approval-intent') {
      return intentDecision.uxIntent?.confidence || 'high';
    }
    if (intentDecision.reason === 'semantic-operational' || intentDecision.reason === 'semantic-conversation') {
      return 'medium';
    }
    return 'high';
  }

  private describeResponseDecision(
    mode: ZavorthResponseDecisionMode,
    sourceReason: SurfaceOperationalIntentDecision['reason'],
  ): string {
    if (mode === 'conversation') {
      return 'Respond as normal chat; do not wake the agent runtime.';
    }
    if (mode === 'approval') {
      return 'Pause behind an approval gate before execution.';
    }
    if (mode === 'file-inspection') {
      return 'Use the local inspection path for a concrete file or folder target.';
    }
    if (mode === 'artifact-result') {
      return 'Render a completed artifact result.';
    }
    return `Execute through the agent runtime (${sourceReason}).`;
  }

  private hasTool(requestedTools: string[], toolId: string): boolean {
    return requestedTools.some((tool) => tool === toolId);
  }

  private hasAnyTool(requestedTools: string[], toolIds: string[]): boolean {
    const accepted = new Set(toolIds);
    return requestedTools.some((tool) => accepted.has(tool));
  }

  private looksLikeFileInspection(text: string): boolean {
    return this.looksLikeFolderTarget(text) || /\b(file|arquivo|logs?|repo|repositorio|repository|modulo|module|codigo|code)\b/i.test(this.normalizeText(text));
  }

  private looksLikeFolderTarget(text: string): boolean {
    return /\b(pasta|folder|downloads?|desktop|documentos?|workspace|diretorio|directory)\b/i.test(this.normalizeText(text));
  }

  private normalizeText(text: string): string {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private looksLikePassiveLinkShare(text: string): boolean {
    const raw = String(text || '');
    if (!/https?:\/\/|www\./i.test(raw)) {
      return false;
    }
    const normalized = this.normalizeText(raw);
    return !/\b(pesquise|pesquisar|buscar|busque|procure|acesse|acessar|abra|abrir|navegue|fetch|baixe|download|leia|ler|resuma|resumir|analise|analisar|explique|explicar|extraia|extrair|verifique|verificar)\b/i.test(normalized);
  }


  private shouldAskSemanticClassifier(
    input: SurfaceOperationalIntent,
    structural: SurfaceOperationalIntentDecision,
  ): boolean {
    if (!this.semanticClassifier || structural.reason !== 'conversation-only') {
      return false;
    }
    if (input.explicitExecution || input.hasContextualMentions || input.hasAttachments) {
      return false;
    }
    const text = String(input.text || '').trim();
    if (text.length === 0 || text.length > 2000) {
      return false;
    }
    if (this.looksLikePassiveLinkShare(text)) {
      return false;
    }
    const preferred = this.semanticClassifier.getPreferredProviderName?.() || '';
    if (preferred && this.semanticClassifier.isProviderAvailable && !this.semanticClassifier.isProviderAvailable(preferred)) {
      return false;
    }
    return true;
  }

  private shouldUseOwnerControlledAiFirstDefault(input: SurfaceOperationalIntent): boolean {
    if (!this.semanticClassifier || input.explicitExecution || input.hasContextualMentions) {
      return false;
    }
    const text = String(input.text || '').trim();
    if (text.length === 0 || text.length > 2000) {
      return false;
    }
    const preferred = this.semanticClassifier.getPreferredProviderName?.() || '';
    if (preferred && this.semanticClassifier.isProviderAvailable && !this.semanticClassifier.isProviderAvailable(preferred)) {
      return false;
    }
    try {
      const state = this.ownerControlledDefaultActivationService?.status(1).state || null;
      return state?.status === 'active' && state.defaultRouter === 'ai-first';
    } catch (error) { logger.warn('[Surface Operational] filesystem check failed', error); return false; }
  }

  private async classifyAmbiguousIntent(input: SurfaceOperationalIntent): Promise<{
    shouldExecute: boolean;
    requestedTools: string[];
  } | null> {
    const classifier = this.semanticClassifier;
    if (!classifier) {
      return null;
    }
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'Voce e o classificador de intencao operacional do Zavorth (um "System Overlord").',
          'Sua funcao e decidir se a mensagem do usuario exige execucao de operacoes complexas (tools/run) ou apenas uma resposta textual direta (conversation).',
          '',
          'CRITERIOS PARA EXECUCAO OPERACIONAL (shouldExecute: true):',
          '- O usuario pede explicitamente para ler/editar arquivos, criar algo no disco, rodar scripts, buscar na web, gerar midias/artefatos ou manipular o sistema.',
          '- O pedido contem um ALVO real de sistema (ex: "verifique a pasta downloads", "leia o arquivo config.json", "crie um componente React").',
          '',
          'CRITERIOS PARA CONVERSA DIRETA (shouldExecute: false):',
          '- Saudacoes casuais ("oi", "bom dia", "tudo bem?").',
          '- Perguntas conceituais, teoricas ou pedidos de explicacao ("o que e um transformer?", "como funciona o react?").',
          '- Frases que usam verbos de acao, mas SEM objeto de sistema ("analise minha ideia", "pense numa solucao", "compare duas coisas que vou te falar").',
          '- Link solto, ou "olha isso: https://...", e conversa direta; so vira execucao se o usuario pedir para abrir, buscar, ler, resumir ou verificar o link.',
          '- Pedidos de brainstorm, ajuda mental ou feedback textual sem tocar em disco.',
          '',
          'IMPORTANTE: A presenca de palavras como "analise", "pense", "ajude" NAO significa execucao pesada. So execute se houver um objeto tangivel (arquivo, pasta, comando shell, web).',
          '',
          'Responda SOMENTE JSON valido no formato:',
          '{"shouldExecute":boolean,"requestedTools":string[],"confidence":"low|medium|high"}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          surface: input.surface,
          text: input.text,
        }),
      },
    ];
    const response = await this.withTimeout(
      classifier.chat(messages, undefined, { allowFallback: true }),
      this.semanticTimeoutMs,
    );
    return this.parseSemanticDecision(response.content || '');
  }

  private parseSemanticDecision(content: string): {
    shouldExecute: boolean;
    requestedTools: string[];
  } | null {
    const raw = String(content || '').trim();
    if (!raw) {
      return null;
    }
    const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed?.shouldExecute !== 'boolean') {
        return null;
      }
      return {
        shouldExecute: parsed.shouldExecute,
        requestedTools: Array.isArray(parsed.requestedTools)
          ? parsed.requestedTools.map((tool: unknown) => String(tool || '').trim()).filter(Boolean).slice(0, 8)
          : [],
      };
    } catch (error) { logger.warn('[Surface Operational] JSON parse failed', error); return null; }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('semantic intent classifier timeout')), timeoutMs);
          timeoutHandle.unref?.();
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private resourceRequiresWork(
    resourceImpact: TaskResourceImpact | null,
    resourceCapabilityIds: string[],
  ): boolean {
    if (!resourceImpact) {
      return false;
    }
    return Boolean(
      resourceImpact.heavy
      || resourceImpact.approvalRequired
      || resourceCapabilityIds.length > 0
      || resourceImpact.budget?.recurring
      || resourceImpact.budget?.externalExposure === 'network'
      || resourceImpact.budget?.externalExposure === 'public',
    );
  }
}

export function createSurfaceOperationalIntentService(
  options: SurfaceOperationalIntentServiceOptions = {},
): SurfaceOperationalIntentService {
  return new SurfaceOperationalIntentService(options);
}
