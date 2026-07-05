/**
 * bootstrapContextEngine.ts - Context Engine + Cognitive Firewall initialization.
 *
 * Called during Zavorth bootstrap to:
 * 1. Scan dynamic skills through SkillScanner.
 * 2. Start the ContextEngine for short-term memory.
 * 3. Start LegacyUnifiedGatewayAdapter as the legacy conversational fallback.
 * 4. Create the EpisodicMemoryBridge from short-term to long-term memory.
 * 5. Log discovered skill statistics.
 *
 * Called from bootstrapFoundation.ts after tool runtime creation.
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

  // 1. Scan dynamic skills.
  const skillLoader = new SkillLoader();
  const skillLoadResult = skillLoader.loadAll(root);
  GlobalContextReloadEvents.reloadSkills = () => skillLoader.reload(root);

  logRepo.log(
    'info',
    'ContextEngine',
    `Discovered skills: ${skillLoadResult.totalSkills} skills, ${skillLoadResult.totalTools} tools (${skillLoadResult.skillIds.join(', ')})`,
  );

  for (const [category, toolNames] of Object.entries(skillLoadResult.categoryMap)) {
    logRepo.log(
      'info',
      'ContextEngine',
      `  Category [${category}]: ${toolNames.join(', ')}`,
    );
  }

  // 2. Create the ContextEngine with all cognitive firewall improvements enabled.
  const contextEngine = new ContextEngine({
    compactMode: true,    // Lazy tool definitions (~80% fewer tokens per tool)
    clusterMode: true,    // Tool clustering (group related tools)
    cacheEnabled: true,   // Tool result caching (avoid re-execution)
  });

  // 3. Create the legacy conversational adapter connected to ContextEngine.
  const legacyUnifiedGateway = new LegacyUnifiedGatewayAdapter(contextEngine);

  // 4. Create the EpisodicMemoryBridge and attach it to ContextEngine.
  const episodicMemoryBridge = new EpisodicMemoryBridge();
  contextEngine.attachEpisodicBridge(episodicMemoryBridge);

  logRepo.log(
    'info',
    'ContextEngine',
    'ContextEngine + LegacyUnifiedGatewayAdapter + SkillScanner + EpisodicMemoryBridge initialized. Cognitive Firewall active.',
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
        text: String(response.text || '').trim() || 'No agent response.',
        action: response.action,
      };
    },
  );

  logRepo.log(
    'info',
    'ContextEngine',
    'LegacyUnifiedGatewayAdapter agent callback connected in central bootstrap.',
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
