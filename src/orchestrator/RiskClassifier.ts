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
      return { risk_level: 0, reason: 'Consulta read-only', requires_approval: false };
    }

    for (const term of RiskClassifier.DANGEROUS_TERMS) {
      if (text.includes(term)) {
        return {
          risk_level: 3,
          reason: `Comando contem palavra chave perigosa: ${term}`,
          requires_approval: true,
        };
      }
    }

    if (parsed.command_type === '/codex') {
      return { risk_level: 2, reason: 'Execucao via agente Codex local', requires_approval: false };
    }

    if (parsed.command_type === '/external') {
      return { risk_level: 2, reason: 'Execucao delegada ao ExternalExecutor local', requires_approval: false };
    }

    if (parsed.command_type === '/gemini') {
      return { risk_level: 1, reason: 'Execucao delegada ao Gemini CLI', requires_approval: false };
    }

    if (parsed.command_type === '/aistudio') {
      return {
        risk_level: 1,
        reason: 'Execucao delegada ao Google AI Studio com tools controladas pelo Zavorth',
        requires_approval: false,
      };
    }

    if (parsed.command_type === '/jules') {
      return { risk_level: 1, reason: 'Execucao assincrona delegada ao Jules', requires_approval: false };
    }

    if (parsed.command_type === '/stitch') {
      return { risk_level: 1, reason: 'Geracao de UI e artefatos via Google Stitch', requires_approval: false };
    }

    if (parsed.command_type === '/run') {
      if (text.includes('build') || text.includes('npm') || text.includes('script')) {
        return { risk_level: 2, reason: 'Desenvolvimento e build', requires_approval: false };
      }

      return {
        risk_level: 3,
        reason: 'Shell arbitrario inferido fora de build',
        requires_approval: true,
      };
    }

    if (['/task', '/auto'].includes(parsed.command_type) && inferredExecutor) {
      switch (inferredExecutor) {
        case 'codex':
          return {
            risk_level: 2,
            reason: 'Roteamento automatico para Codex com alteracao potencial de codigo',
            requires_approval: false,
          };
        case 'external_executor':
          return {
            risk_level: 2,
            reason: 'Roteamento automatico para ExternalExecutor com investigacao ou execucao no workspace',
            requires_approval: false,
          };
        case 'gemini_cli':
          return { risk_level: 1, reason: 'Roteamento automatico para Gemini CLI', requires_approval: false };
        case 'web_research':
          return {
            risk_level: 0,
            reason: 'Roteamento automatico para pesquisa web estruturada e somente leitura',
            requires_approval: false,
          };
        case 'aistudio':
          return {
            risk_level: 1,
            reason: 'Roteamento automatico para Google AI Studio com tools controladas pelo Zavorth',
            requires_approval: false,
          };
        case 'jules':
          return { risk_level: 1, reason: 'Roteamento automatico para Jules', requires_approval: false };
        case 'stitch':
          return { risk_level: 1, reason: 'Roteamento automatico para Google Stitch', requires_approval: false };
        case 'zavorthBridge':
          return { risk_level: 1, reason: 'Roteamento automatico para ZavorthBridge', requires_approval: false };
        default:
          break;
      }
    }

    if (['/plan', '/ag', '/bridge', '/task', '/auto'].includes(parsed.command_type)) {
      return {
        risk_level: 1,
        reason: 'Planejamento e analise de escrita controlada',
        requires_approval: false,
      };
    }

    return {
      risk_level: 3,
      reason: 'Seguranca por padrao: impossivel determinar intencao unicamente segura',
      requires_approval: true,
    };
  }
}
