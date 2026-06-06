/**
 * ToolGatekeeper — Cognitive Firewall, Preview engine: Just-In-Time Tool Loading
 *
 * Este módulo recebe a classificação de intenção do IntentClassifier e filtra
 * as ToolDefinitions a serem injetadas no prompt do LLM. Em vez de enviar
 * TODAS as 16+ tools em toda chamada (como o ExternalExecutor faz), enviamos apenas
 * as tools que fazem sentido para a intenção detectada.
 *
 * RESULTADO: O prompt enviado ao LLM fica ~60-70% mais leve em tokens.
 */

import type { IntentCategory } from './IntentClassifier.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { PluginStateService } from '../services/PluginStateService.js';

export type IntentToolCategoryMap = Partial<Record<IntentCategory | string, string[]>>;
export type ToolGatekeeperHintGroup =
  | 'conversation'
  | 'workspace'
  | 'web'
  | 'execution'
  | 'configuration'
  | 'memory'
  | 'desktop'
  | 'research'
  | 'all';

export type ToolGatekeeperHintProfile = {
  intentCategory: IntentCategory;
  groups: ToolGatekeeperHintGroup[];
  recommendedToolNames: string[];
  tools: ToolDefinition[];
  omittedToolNames: string[];
  quarantinedToolNames: string[];
  totalTools: number;
  filteredTools: number;
  toolExposureGatedByCognitiveFirewall: boolean;
  isHardGate: boolean;
  reason: string;
};

/**
 * Mapa de intenção → nomes de tools permitidas.
 * 'conversation' = nenhuma tool (economia máxima).
 * 'full_toolset' = todas (fallback de segurança).
 */
const DEFAULT_INTENT_TOOL_MAP: Record<IntentCategory, string[] | '*'> = {
  conversation: [],
  information: ['web_search', 'get_datetime'],
  file_operation: ['read_file', 'create_file', 'list_directory'],
  execution: ['run_sandbox_code', 'remote_shell', 'read_file', 'list_directory'],
  configuration: ['configure_llm_profile', 'zavorth_action', 'get_datetime'],
  memory: ['semantic_memory', 'zavorth_action', 'get_datetime'],
  desktop: ['desktop_automation', 'read_file'],
  research: ['web_search', 'query_external_ai', 'get_datetime', 'create_file'],
  full_toolset: '*',
};

const INTENT_HINT_GROUPS: Record<IntentCategory, ToolGatekeeperHintGroup[]> = {
  conversation: ['conversation'],
  information: ['web'],
  file_operation: ['workspace'],
  execution: ['execution', 'workspace'],
  configuration: ['configuration'],
  memory: ['memory'],
  desktop: ['desktop', 'workspace'],
  research: ['research', 'web', 'workspace'],
  full_toolset: ['all'],
};

let dynamicIntentToolMap: Record<string, string[]> = {};

export function setDynamicIntentToolMap(map: IntentToolCategoryMap): void {
  const normalized: Record<string, string[]> = {};

  for (const [category, tools] of Object.entries(map || {})) {
    const names = Array.from(
      new Set(
        (tools || [])
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    );
    if (names.length > 0) {
      normalized[String(category)] = names;
    }
  }

  dynamicIntentToolMap = normalized;
}

export function getDynamicIntentToolMap(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(dynamicIntentToolMap).map(([category, tools]) => [category, [...tools]]),
  );
}

export class ToolGatekeeper {
  private readonly pluginState: PluginStateService;

  constructor(pluginState?: PluginStateService) {
    this.pluginState = pluginState ?? new PluginStateService();
  }

  /**
   * Aplica a política de quarentena de plugins do operador.
   * Remove ferramentas cujo pluginId não está aprovado (trust !== 'trusted' ou sourceTrusted !== true).
   * Ferramentas sem pluginId associado são sempre permitidas (tratadas como ferramentas nativas).
   */
  private applyPluginQuarantine(tools: ToolDefinition[]): {
    approved: ToolDefinition[];
    quarantined: string[];
  } {
    const approved: ToolDefinition[] = [];
    const quarantined: string[] = [];

    for (const tool of tools) {
      const pluginId = this.resolvePluginId(tool);
      if (pluginId && !this.pluginState.isApproved(pluginId)) {
        quarantined.push(tool.name);
      } else {
        approved.push(tool);
      }
    }

    return { approved, quarantined };
  }

  private resolvePluginId(tool: ToolDefinition): string | null {
    const metadata = tool.metadata || {};
    const explicit = [
      metadata.pluginId,
      metadata.sourcePluginId,
      metadata.packageId,
      metadata.serverId,
    ]
      .map((value) => String(value || '').trim())
      .find(Boolean);
    if (explicit) {
      return explicit;
    }

    const source = String(metadata.source || '').trim().toLowerCase();
    if (source === 'mcp' || source === 'plugin' || source === 'external-plugin') {
      return `untrusted-source:${source}:${tool.name}`;
    }

    return null;
  }

  public buildHintProfile(
    allTools: ToolDefinition[],
    intentCategory: IntentCategory,
  ): ToolGatekeeperHintProfile {
    const defaultAllowedNames = DEFAULT_INTENT_TOOL_MAP[intentCategory];
    const totalTools = allTools.length;

    // Etapa 1: Quarentena de plugins não aprovados pelo operador (hard gate de segurança)
    const { approved: approvedTools, quarantined: quarantinedToolNames } = this.applyPluginQuarantine(allTools);
    const pluginGateApplied = quarantinedToolNames.length > 0;

    if (defaultAllowedNames === '*') {
      const recommendedToolNames = approvedTools.map((tool) => tool.name);
      return {
        intentCategory,
        groups: INTENT_HINT_GROUPS[intentCategory],
        recommendedToolNames,
        tools: [...approvedTools],
        omittedToolNames: [],
        quarantinedToolNames,
        totalTools,
        filteredTools: approvedTools.length,
        toolExposureGatedByCognitiveFirewall: pluginGateApplied,
        isHardGate: pluginGateApplied,
        reason: pluginGateApplied
          ? `Intent hint recomenda o toolset completo; ${quarantinedToolNames.length} ferramenta(s) bloqueada(s) pela política de plugins do operador.`
          : 'Intent hint recommends the full available toolset; final exposure belongs to runtime policy.',
      };
    }

    // Etapa 2: Filtragem por intenção aplicada sobre o pool já aprovado
    const intendedToolNames = Array.from(
      new Set([
        ...(defaultAllowedNames || []),
        ...(dynamicIntentToolMap[intentCategory] || []),
      ]),
    );
    const allowedSet = new Set(intendedToolNames);
    const tools = approvedTools.filter((tool) => allowedSet.has(tool.name));
    const selectedNames = new Set(tools.map((tool) => tool.name));
    const recommendedToolNames = tools.map((tool) => tool.name);

    return {
      intentCategory,
      groups: INTENT_HINT_GROUPS[intentCategory],
      recommendedToolNames,
      tools,
      omittedToolNames: approvedTools
        .map((tool) => tool.name)
        .filter((name) => !selectedNames.has(name)),
      quarantinedToolNames,
      totalTools,
      filteredTools: tools.length,
      toolExposureGatedByCognitiveFirewall: pluginGateApplied,
      isHardGate: pluginGateApplied,
      reason: pluginGateApplied
        ? `Intent classifier filtrou por intenção; ${quarantinedToolNames.length} ferramenta(s) bloqueada(s) pela política de plugins do operador.`
        : 'Intent classifier produced a tool hint only; final exposure belongs to runtime policy.',
    };
  }

  /**
   * Filtra as tool definitions baseado na categoria de intenção detectada.
   * Retorna somente as que o LLM realmente pode precisar.
   *
   * @param allTools - Todas as tools registradas no ToolRegistry
   * @param intentCategory - Categoria detectada pelo IntentClassifier
   * @returns Subconjunto filtrado de ToolDefinitions (ou vazio para chat puro)
   */
  public filterTools(allTools: ToolDefinition[], intentCategory: IntentCategory): ToolDefinition[] {
    return this.buildHintProfile(allTools, intentCategory).tools;
  }

  /**
   * Retorna estatísticas de economia para logging.
   */
  public getFilterStats(
    totalTools: number,
    filteredTools: number,
    intentCategory: IntentCategory,
    quarantinedCount = 0,
  ): string {
    const saved = totalTools - filteredTools;
    const percent = totalTools > 0 ? Math.round((saved / totalTools) * 100) : 0;
    const quarantineInfo = quarantinedCount > 0 ? ` | Quarentena: ${quarantinedCount} bloqueada(s)` : '';
    return `[Cognitive Firewall] Intent: ${intentCategory} | Tools: ${filteredTools}/${totalTools} recomendadas (${percent}% economia estimada${quarantineInfo})`;
  }
}
