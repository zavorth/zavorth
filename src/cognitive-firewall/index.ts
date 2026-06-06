/**
 * CognitiveFirewall — Fachada principal do sistema de economia de tokens.
 *
 * Orquestra IntentClassifier + ToolGatekeeper em uma única chamada simples
 * para integração no ConversationalAgent e em qualquer outro ponto do Zavorth.
 *
 * USO:
 *   const firewall = new CognitiveFirewall();
 *   const decision = firewall.evaluate(userMessage, allToolDefinitions);
 *   // decision.tools → tools filtradas para injetar no prompt
 *   // decision.useFastModel → se true, pode usar LLM barato (Flash/local)
 */

import { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
import { ToolGatekeeper, type ToolGatekeeperHintProfile } from './ToolGatekeeper.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';

export interface FirewallDecision {
  /** Tools filtradas pela intenção — injetar estas (e somente estas) no prompt do LLM */
  tools: ToolDefinition[];
  /** Perfil de hint consumivel por runtime policy/telemetria; nao e gate final. */
  toolHintProfile: ToolGatekeeperHintProfile;
  /** Nomes recomendados para exposicao, sem substituir a policy final. */
  recommendedToolNames: string[];
  /** True quando o Cognitive Firewall bloqueou exposicao de plugin/capability nao confiavel. */
  toolExposureGatedByCognitiveFirewall: boolean;
  /** Se true, a mensagem é chat trivial (bom dia, ok, obrigado). Pode usar LLM mais barato. */
  useFastModel: boolean;
  /** Classificação de intenção completa para logging/debug */
  classification: IntentClassification;
  /** Estatísticas de economia para log */
  stats: string;
}

export class CognitiveFirewall {
  private readonly classifier = new IntentClassifier();
  private readonly gatekeeper = new ToolGatekeeper();

  /**
   * Avalia uma mensagem do usuário e decide:
   * 1. Quais tools injetar no prompt (Just-In-Time)
   * 2. Se pode usar um modelo mais barato (LLM Cascade)
   *
   * Roda em <1ms, 0 tokens, 0 chamadas externas.
   */
  public evaluate(userMessage: string, allTools: ToolDefinition[]): FirewallDecision {
    const classification = this.classifier.classify(userMessage);
    const toolHintProfile = this.gatekeeper.buildHintProfile(allTools, classification.category);
    const stats = this.gatekeeper.getFilterStats(
      allTools.length,
      toolHintProfile.filteredTools,
      classification.category,
      toolHintProfile.quarantinedToolNames.length,
    );

    return {
      tools: toolHintProfile.tools,
      toolHintProfile,
      recommendedToolNames: toolHintProfile.recommendedToolNames,
      toolExposureGatedByCognitiveFirewall: toolHintProfile.toolExposureGatedByCognitiveFirewall,
      useFastModel: classification.isTrivialChat,
      classification,
      stats,
    };
  }
}

// Re-exportar para conveniência
export { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
export {
  ToolGatekeeper,
  getDynamicIntentToolMap,
  setDynamicIntentToolMap,
  type IntentToolCategoryMap,
  type ToolGatekeeperHintGroup,
  type ToolGatekeeperHintProfile,
} from './ToolGatekeeper.js';
export { NaturalLanguageRouter, type NaturalRouteDecision } from './NaturalLanguageRouter.js';
export { IntentEnrichedParser, type IntentEnrichedCommand } from './IntentEnrichedParser.js';
