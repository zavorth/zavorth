/**
 * IntentEnrichedParser — Parser de Comandos com Enriquecimento de Intenção (Runtime gateway)
 *
 * Wrapper em torno do CommandParser original que adiciona o resultado do
 * NaturalLanguageRouter ao ParsedCommand. Quando uma mensagem de texto
 * livre (sem /) chega, o parser original atribui command_type = "/task"
 * e ignora qualquer semântica. Este wrapper adiciona:
 *
 * - intentCategory: a categoria de intenção detectada pelo Cognitive Firewall
 * - useFastModel: se um modelo mais barato deve ser usado
 * - isTrivialChat: se é saudação/confirmação trivial
 * - firewallStats: estatísticas de filtragem
 *
 * O sistema pode então decidir:
 * 1. Se deve carregar modelo barato para chat trivial
 * 2. Quantas tools injetar no prompt
 * 3. Se pode pular o fluxo inteiro do ConversationalAgent (p.ex. resposta local)
 */

import { CommandParser, type ParsedCommand } from '../telegram/CommandParser.js';
import { NaturalLanguageRouter, type NaturalRouteDecision } from './NaturalLanguageRouter.js';

export interface IntentEnrichedCommand extends ParsedCommand {
  /** Resultado do roteamento natural (null se for comando /explícito) */
  naturalRoute: NaturalRouteDecision | null;
}

export class IntentEnrichedParser {
  private readonly commandParser = new CommandParser();
  private readonly naturalRouter = new NaturalLanguageRouter();

  /**
   * Faz o parsing da mensagem como o CommandParser original, mas
   * enriquece com o resultado do NaturalLanguageRouter para texto livre.
   */
  public parse(rawMessage: string): IntentEnrichedCommand {
    const parsed = this.commandParser.parse(rawMessage);
    const text = rawMessage.trim();

    // Apenas enriquecer mensagens de texto livre (sem /)
    // Comandos explícitos mantêm o fluxo rígido intacto
    if (text.startsWith('/')) {
      return {
        ...parsed,
        naturalRoute: null,
      };
    }

    // Rotear a mensagem pelo NaturalLanguageRouter
    const naturalRoute = this.naturalRouter.route(text);

    return {
      ...parsed,
      naturalRoute,
    };
  }

  /**
   * Retorna true se a mensagem é chat trivial e pode usar modelo barato.
   */
  public static isTrivialChat(enriched: IntentEnrichedCommand): boolean {
    return enriched.naturalRoute?.isTrivialChat === true;
  }

  /**
   * Retorna true se a mensagem deve usar modelo rápido/barato.
   */
  public static shouldUseFastModel(enriched: IntentEnrichedCommand): boolean {
    return enriched.naturalRoute?.useFastModel === true;
  }

  /**
   * Retorna a categoria de intenção ou 'full_toolset' para comandos explícitos.
   */
  public static getIntentCategory(enriched: IntentEnrichedCommand): string {
    return enriched.naturalRoute?.intentCategory || 'full_toolset';
  }
}
