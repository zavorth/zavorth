/**
 * bootstrapContextEngine.ts — Inicialização do Context Engine + Cognitive Firewall
 *
 * Este módulo é chamado durante o bootstrap do Zavorth para:
 * 1. Escanear skills dinâmicas via SkillScanner
 * 2. Iniciar o ContextEngine (memória de curto prazo)
 * 3. Iniciar o LegacyUnifiedGatewayAdapter (fallback conversacional legado)
 * 4. Criar o EpisodicMemoryBridge (ponte curto→longo prazo)
 * 5. Logar as estatísticas de skills descobertas
 *
 * Chamado em bootstrapFoundation.ts após a criação do tool runtime.
 */

import * as path from 'path';
import { ConversationalAgent } from '../agents/ConversationalAgent.js';
import { ContextEngine } from '../context-engine/ContextEngine.js';
import { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import { SkillLoader, type SkillLoadResult } from '../context-engine/SkillLoader.js';
import { EpisodicMemoryBridge } from '../context-engine/EpisodicMemoryBridge.js';
import type { LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
import type { ToolRuntimeService } from '../services/tools/ToolRuntimeService.js';
import type { LogRepository } from '../storage/LogRepository.js';

export const GlobalContextReloadEvents = {
  reloadSkills: (): SkillLoadResult | null => null,
};

export interface ContextEngineRuntime {
  contextEngine: ContextEngine;
  legacyUnifiedGateway: LegacyUnifiedGatewayAdapter;
  skillLoader: SkillLoader;
  skillLoadResult: SkillLoadResult;
  episodicMemoryBridge: EpisodicMemoryBridge;
}

type LegacyUnifiedGatewayAgentRuntime = {
  getToolRuntime(): ToolRuntimeService;
  getLlmRuntime(): LlmRuntimeService;
};

export function createContextEngineRuntime(
  logRepo: LogRepository,
  basePath?: string,
): ContextEngineRuntime {
  const root = basePath || process.cwd();

  // 1. Escanear skills dinâmicas
  const skillLoader = new SkillLoader();
  const skillLoadResult = skillLoader.loadAll(root);
  GlobalContextReloadEvents.reloadSkills = () => skillLoader.reload(root);

  logRepo.log(
    'info',
    'ContextEngine',
    `Skills descobertas: ${skillLoadResult.totalSkills} skills, ${skillLoadResult.totalTools} tools (${skillLoadResult.skillIds.join(', ')})`,
  );

  for (const [category, toolNames] of Object.entries(skillLoadResult.categoryMap)) {
    logRepo.log(
      'info',
      'ContextEngine',
      `  Categoria [${category}]: ${toolNames.join(', ')}`,
    );
  }

  // 2. Criar o ContextEngine
  const contextEngine = new ContextEngine();

  // 3. Criar o adapter legado de conversa (conectado ao ContextEngine)
  const legacyUnifiedGateway = new LegacyUnifiedGatewayAdapter(contextEngine);

  // 4. Criar o EpisodicMemoryBridge e conectar ao ContextEngine
  const episodicMemoryBridge = new EpisodicMemoryBridge();
  contextEngine.attachEpisodicBridge(episodicMemoryBridge);

  logRepo.log(
    'info',
    'ContextEngine',
    'ContextEngine + LegacyUnifiedGatewayAdapter + SkillScanner + EpisodicMemoryBridge inicializados. Cognitive Firewall ativo.',
  );

  console.log('[BOOT] context-engine-ready');

  return {
    contextEngine,
    legacyUnifiedGateway,
    skillLoader,
    skillLoadResult,
    episodicMemoryBridge,
  };
}

export function wireLegacyUnifiedGatewayAgentCallback(input: {
  logRepo: Pick<LogRepository, 'log'>;
  contextEngine: ContextEngine;
  legacyUnifiedGateway: LegacyUnifiedGatewayAdapter;
  runtimeComposition: LegacyUnifiedGatewayAgentRuntime;
}): void {
  const { logRepo, contextEngine, legacyUnifiedGateway, runtimeComposition } = input;

  legacyUnifiedGateway.setAgentCallback(
    async (message, userId, chatId, surface, _tools, inlineData, metadata) => {
      const isVoiceInput =
        metadata?.isVoiceInput === true ||
        Boolean(inlineData?.some((entry) => String(entry.mimeType || '').startsWith('audio/')));
      const voiceReplyRequested = isExplicitVoiceReplyRequest(message);
      const preferredLanguageCode =
        typeof metadata?.preferredLanguageCode === 'string' && metadata.preferredLanguageCode.trim().length > 0
          ? metadata.preferredLanguageCode.trim()
          : null;
      const convAgent = new ConversationalAgent({
        llmRuntime: runtimeComposition.getLlmRuntime(),
        toolRuntime: runtimeComposition.getToolRuntime(),
        contextEngine,
      });
      const response = await convAgent.chat(message, inlineData, {
        mode: 'direct',
        requireContextEngine: true,
        userId,
        chatId,
        surface,
        workspaceContext: resolveLegacyUnifiedGatewayWorkspaceContext(metadata),
        styleHints: [
          ...(isVoiceInput
            ? [
              "Reply in the same language as the user's current audio transcript unless explicitly asked otherwise.",
              'Your final answer must be monolingual and stay in the user language from start to finish unless the user explicitly asked for bilingual output.',
              'Do not switch languages mid-response unless the user did.',
              'Do not address the user by a proper name unless explicitly confirmed in this turn.',
              'Do not infer or repeat a person name from a noisy transcript.',
              ...(preferredLanguageCode ? [`Use ${preferredLanguageCode} as the reply language for this turn.`] : []),
              'Treat voice as natural language, not as a small command grammar. The same tool access and reasoning standards used for text also apply to audio.',
            ]
            : []),
          ...(voiceReplyRequested
            ? [
                'The Telegram output stage can synthesize your final answer as a voice message. If the user asks for audio or voice, do not claim you cannot send audio; answer normally and keep the answer concise for speech.',
              ]
            : []),
        ],
      });

      return {
        text: String(response.text || '').trim() || 'Sem resposta do agente.',
        action: response.action,
      };
    },
  );

  logRepo.log(
    'info',
    'ContextEngine',
    'LegacyUnifiedGatewayAdapter agent callback conectado no bootstrap central.',
  );
}

function resolveLegacyUnifiedGatewayWorkspaceContext(metadata?: Record<string, unknown>): string | null {
  const workspaceContext = metadata?.workspaceContext;
  return typeof workspaceContext === 'string' && workspaceContext.trim().length > 0
    ? workspaceContext.trim()
    : null;
}

function isExplicitVoiceReplyRequest(message: string): boolean {
  const normalized = String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return false;
  }

  return (
    /\b(respond[ae]r?|responda|responde|fale|mande|envie)\b.{0,40}\b(audio|voz)\b/.test(normalized)
    || /\b(audio|voz)\b.{0,40}\b(resposta|reply|answer|response|responder|responda|responde)\b/.test(normalized)
    || /\b(reply|answer|respond|send)\b.{0,40}\b(audio|voice)\b/.test(normalized)
    || /\b(audio|voice)\b.{0,40}\b(reply|answer|response)\b/.test(normalized)
    || /\b(respuesta|responde|respondeme|enviame|mandame)\b.{0,40}\b(audio|voz)\b/.test(normalized)
  );
}
