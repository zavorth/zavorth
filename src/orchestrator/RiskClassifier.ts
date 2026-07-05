import { RouteIntent } from './IntentRouter.js';
import { ParsedCommand } from '../gateways/channels/telegram/CommandParser.js';

export interface RiskClassification {
  risk_level: number;
  reason: string;
  requires_approval: boolean;
}

export class RiskClassifier {
  private static DANGEROUS_TERMS = [
    'rm -rf',
    'format',
    'shutdown',
    'reboot',
    'del /s',
    'system32',
    'registry',
    'passwd',
    'drop table',
  ];

  public classify(parsed: ParsedCommand, intent: RouteIntent): RiskClassification {
    const text = parsed.normalized_message;
    const inferredExecutor = (intent.executor_preference || '').toLowerCase();

    if (['/status', '/help', '/logs', '/tasks', '/diff'].includes(parsed.command_type)) {
      return { risk_level: 0, reason: 'Read-only query', requires_approval: false };
    }

    for (const term of RiskClassifier.DANGEROUS_TERMS) {
      if (text.includes(term)) {
        return {
          risk_level: 3,
          reason: `Command contains dangerous keyword: ${term}`,
          requires_approval: true,
        };
      }
    }

    if (parsed.command_type === '/codex') {
      return { risk_level: 2, reason: 'Execution through local Codex agent', requires_approval: false };
    }

    if (parsed.command_type === '/external') {
      return { risk_level: 2, reason: 'Execution delegated to local ExternalExecutor', requires_approval: false };
    }

    if (parsed.command_type === '/gemini') {
      return { risk_level: 1, reason: 'Execution delegated to Gemini CLI', requires_approval: false };
    }

    if (parsed.command_type === '/aistudio') {
      return {
        risk_level: 1,
        reason: 'Execution delegated to Google AI Studio with tools controlled by Zavorth',
        requires_approval: false,
      };
    }

    if (parsed.command_type === '/jules') {
      return { risk_level: 1, reason: 'Asynchronous execution delegated to Jules', requires_approval: false };
    }

    if (parsed.command_type === '/stitch') {
      return { risk_level: 1, reason: 'UI and artifact generation through Google Stitch', requires_approval: false };
    }

    if (parsed.command_type === '/run') {
      if (text.includes('build') || text.includes('npm') || text.includes('script')) {
        return { risk_level: 2, reason: 'Development and build', requires_approval: false };
      }

      return {
        risk_level: 3,
        reason: 'Arbitrary shell inferred outside build flow',
        requires_approval: true,
      };
    }

    if (['/task', '/auto'].includes(parsed.command_type) && inferredExecutor) {
      switch (inferredExecutor) {
        case 'codex':
          return {
            risk_level: 2,
            reason: 'Automatic routing to Codex with potential code changes',
            requires_approval: false,
          };
        case 'external_executor':
          return {
            risk_level: 2,
            reason: 'Automatic routing to ExternalExecutor for investigation or workspace execution',
            requires_approval: false,
          };
        case 'gemini_cli':
          return { risk_level: 1, reason: 'Automatic routing to Gemini CLI', requires_approval: false };
        case 'web_research':
          return {
            risk_level: 0,
            reason: 'Automatic routing to structured read-only web research',
            requires_approval: false,
          };
        case 'aistudio':
          return {
            risk_level: 1,
            reason: 'Automatic routing to Google AI Studio with tools controlled by Zavorth',
            requires_approval: false,
          };
        case 'jules':
          return { risk_level: 1, reason: 'Automatic routing to Jules', requires_approval: false };
        case 'stitch':
          return { risk_level: 1, reason: 'Automatic routing to Google Stitch', requires_approval: false };
        case 'zavorthBridge':
          return { risk_level: 1, reason: 'Automatic routing to ZavorthBridge', requires_approval: false };
        default:
          break;
      }
    }

    if (['/plan', '/ag', '/bridge', '/task', '/auto'].includes(parsed.command_type)) {
      return {
        risk_level: 1,
        reason: 'Planning and controlled write analysis',
        requires_approval: false,
      };
    }

    return {
      risk_level: 3,
      reason: 'Default safety: could not determine a uniquely safe intent',
      requires_approval: true,
    };
  }
}
