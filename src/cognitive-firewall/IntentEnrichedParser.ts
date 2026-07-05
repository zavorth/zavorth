/**
 * IntentEnrichedParser - command parser with runtime intent enrichment.
 *
 * Wraps the original CommandParser and adds the NaturalLanguageRouter result
 * to ParsedCommand. When free text without "/" arrives, the original parser
 * assigns command_type = "/task" and ignores semantics. This wrapper adds:
 *
 * - intentCategory: intent category detected by Cognitive Firewall
 * - useFastModel: whether a cheaper model should be used
 * - isTrivialChat: whether this is trivial greeting or confirmation chat
 * - firewallStats: filtering statistics
 */

import { CommandParser, type ParsedCommand } from '../gateways/channels/telegram/CommandParser.js';
import { NaturalLanguageRouter, type NaturalRouteDecision } from './NaturalLanguageRouter.js';

export interface IntentEnrichedCommand extends ParsedCommand {
  /** Natural routing result, or null for explicit slash commands. */
  naturalRoute: NaturalRouteDecision | null;
}

export class IntentEnrichedParser {
  private readonly commandParser = new CommandParser();
  private readonly naturalRouter = new NaturalLanguageRouter();

  /**
   * Parses like the original CommandParser, then enriches free text with
   * NaturalLanguageRouter output.
   */
  public parse(rawMessage: string): IntentEnrichedCommand {
    const parsed = this.commandParser.parse(rawMessage);
    const text = rawMessage.trim();

    if (text.startsWith('/')) {
      return {
        ...parsed,
        naturalRoute: null,
      };
    }

    const naturalRoute = this.naturalRouter.route(text);

    return {
      ...parsed,
      naturalRoute,
    };
  }

  /**
   * Returns true when the message is trivial chat and can use a cheap model.
   */
  public static isTrivialChat(enriched: IntentEnrichedCommand): boolean {
    return enriched.naturalRoute?.isTrivialChat === true;
  }

  /**
   * Returns true when the message should use a fast/cheap model.
   */
  public static shouldUseFastModel(enriched: IntentEnrichedCommand): boolean {
    return enriched.naturalRoute?.useFastModel === true;
  }

  /**
   * Returns the intent category or 'full_toolset' for explicit commands.
   */
  public static getIntentCategory(enriched: IntentEnrichedCommand): string {
    return enriched.naturalRoute?.intentCategory || 'full_toolset';
  }
}
