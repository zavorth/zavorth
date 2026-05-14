import { inferUniversalAgentRequestedTools } from '../agent/index.js';
import type {
  UniversalIntentCategory,
  UniversalIntentInput,
  UniversalIntentRiskLevel,
  UniversalIntentSafetyClassification,
  UniversalIntentSideEffect,
  UniversalIntentSignalSnapshot,
} from './UniversalIntentContracts.js';

export class IntentSafetyClassifier {
  public classify(input: UniversalIntentInput): UniversalIntentSafetyClassification {
    const signals = this.collectSignals(input);
    const risk = this.inferRisk(input, signals);
    const sideEffect = this.inferSideEffect(signals);
    const intent = this.inferIntent(signals);

    return {
      intent,
      risk,
      sideEffect,
      confidence: this.inferConfidence(signals),
      capabilityRequired: signals.requestedTools,
      signals,
    };
  }

  private collectSignals(input: UniversalIntentInput): UniversalIntentSignalSnapshot {
    const rawText = String(input.text || '');
    const text = this.normalizeText(rawText);
    const toolsFromRequest = this.normalizeList(input.requestedTools || []);
    const toolsFromCapabilities = this.normalizeList(input.capabilityIds || []);
    const inferredTools = inferUniversalAgentRequestedTools({
      text: rawText,
      capabilityIds: toolsFromCapabilities,
      fallbackTool: null,
    });
    const requestedTools = this.unique([...toolsFromRequest, ...inferredTools]);
    const matchedSignals: string[] = [];
    const textEmpty = rawText.trim().length === 0;
    const hasTargetInText = this.looksLikeConcreteTarget(text);
    const hasKnownTarget = Boolean(
      input.contextHints?.activeTargetId
      || input.contextHints?.activeArtifactId
      || input.contextHints?.previousRunId
      || input.contextHints?.workspacePath
      || input.contextHints?.workspaceRoot
      || input.contextHints?.targetPath
      || hasTargetInText,
    );

    const mutation = Boolean(input.riskHints?.mutation)
      || this.hasAnyTool(requestedTools, ['write_file', 'workspace.write', 'workspace.edit', 'apply_patch', 'selfmod.preview'])
      || this.matches(text, /\b(crie|criar|edite|editar|altere|alterar|corrija|corrigir|salve|aplique|patch|instale|install|organize|organizar|mova|mover|renomeie|renomear)\b/);
    const shell = Boolean(input.riskHints?.shell)
      || this.hasAnyTool(requestedTools, ['shell.exec', 'bash.exec', 'powershell.exec'])
      || this.matches(text, /\b(shell|powershell|terminal|comando|execute|executar|rode|rodar|npm|pnpm|yarn|git|build|teste|testes|jest)\b/);
    const network = Boolean(input.riskHints?.network)
      || this.hasAnyTool(requestedTools, ['network_fetch', 'web.search', 'browser.open'])
      || this.matches(text, /\b(web|internet|url|site|pesquise|pesquisar|busque|buscar)\b/);
    const externalSideEffect = Boolean(input.riskHints?.externalSideEffect)
      || this.hasAnyTool(requestedTools, ['email.send', 'report.send', 'slack.send', 'telegram.send', 'publish'])
      || this.matches(text, /\b(envie|enviar|mande|mandar|publique|publicar|poste|postar|slack|email|telegram)\b/);
    const destructive = Boolean(input.riskHints?.destructive)
      || this.hasAnyTool(requestedTools, ['delete_file', 'workspace.delete', 'git.reset', 'system.delete'])
      || this.matches(text, /\b(delete|deletar|remova|remover|apague|apagar|limpe|limpar|reset --hard|rm -rf|formatar|destrua|destruir)\b/);
    const automation = this.hasAnyTool(requestedTools, ['automation.create', 'watch.create', 'watchmode.control', 'cron.create'])
      || this.matches(text, /\b(automacao|automation|recorrente|agende|agendar|cron|watch mode|monitorar|monitore)\b/);
    const inspection = this.hasAnyTool(requestedTools, ['read_file', 'workspace.read', 'folder.read'])
      || this.matches(text, /\b(analise|analisar|inspect|inspecione|listar|liste|mostrar|mostre|leia|ler)\b/);
    const operatorRequired = Boolean(input.riskHints?.operatorRequired)
      || this.hasAnyTool(requestedTools, ['selfmod.preview', 'watchmode.control', 'system.delete'])
      || this.matches(text, /\b(overlord|host inteiro|sistema inteiro|root|admin|administrador|kernel|servico do sistema|shutdown|desligue|formate|formatar|auto[-\s]?modifique|selfmod)\b/);
    const sensitiveDomain = Boolean(input.contextHints?.sensitiveDomain);
    const hostScopeRequested = Boolean(input.contextHints?.hostScopeRequested) || this.matches(text, /\b(host inteiro|sistema inteiro|fora do workspace|maquina inteira)\b/);
    const ambiguousTarget = this.isAmbiguousTarget(text) && !hasKnownTarget;

    this.pushSignal(matchedSignals, 'text-empty', textEmpty);
    this.pushSignal(matchedSignals, 'known-target', hasKnownTarget);
    this.pushSignal(matchedSignals, 'mutation', mutation);
    this.pushSignal(matchedSignals, 'shell', shell);
    this.pushSignal(matchedSignals, 'network', network);
    this.pushSignal(matchedSignals, 'external-side-effect', externalSideEffect);
    this.pushSignal(matchedSignals, 'destructive', destructive);
    this.pushSignal(matchedSignals, 'automation', automation);
    this.pushSignal(matchedSignals, 'inspection', inspection);
    this.pushSignal(matchedSignals, 'operator-required', operatorRequired);
    this.pushSignal(matchedSignals, 'sensitive-domain', sensitiveDomain);
    this.pushSignal(matchedSignals, 'host-scope-requested', hostScopeRequested);
    this.pushSignal(matchedSignals, 'ambiguous-target', ambiguousTarget);

    return {
      textEmpty,
      hasKnownTarget,
      requestedTools,
      toolsFromRequest,
      toolsFromCapabilities,
      mutation,
      shell,
      network,
      externalSideEffect,
      destructive,
      automation,
      inspection,
      operatorRequired,
      sensitiveDomain,
      ambiguousTarget,
      hostScopeRequested,
      matchedSignals,
    };
  }

  private inferRisk(input: UniversalIntentInput, signals: UniversalIntentSignalSnapshot): UniversalIntentRiskLevel {
    if (
      signals.destructive
      || signals.shell
      || signals.externalSideEffect
      || signals.operatorRequired
      || this.hasAnyTool(signals.requestedTools, ['selfmod.preview', 'watchmode.control'])
    ) {
      return 'danger';
    }
    if (
      Boolean(input.riskHints?.approvalRequired)
      || signals.mutation
      || signals.automation
      || signals.network
      || signals.sensitiveDomain
    ) {
      return 'attention';
    }
    return 'safe';
  }

  private inferSideEffect(signals: UniversalIntentSignalSnapshot): UniversalIntentSideEffect {
    if (signals.destructive) {
      return 'destructive';
    }
    if (signals.externalSideEffect) {
      return 'external';
    }
    if (signals.shell || signals.automation || signals.operatorRequired) {
      return 'system';
    }
    if (signals.mutation) {
      return 'local_workspace';
    }
    return 'none';
  }

  private inferIntent(signals: UniversalIntentSignalSnapshot): UniversalIntentCategory {
    if (signals.operatorRequired) {
      return 'operator_control';
    }
    if (signals.externalSideEffect) {
      return 'external_side_effect';
    }
    if (signals.automation) {
      return 'automation';
    }
    if (signals.shell) {
      return 'command_execution';
    }
    if (signals.mutation || signals.destructive) {
      return 'workspace_mutation';
    }
    if (signals.network) {
      return 'network_access';
    }
    if (signals.inspection) {
      return 'inspection';
    }
    return 'conversation';
  }

  private inferConfidence(signals: UniversalIntentSignalSnapshot): number {
    if (signals.textEmpty) {
      return 0.1;
    }
    if (signals.ambiguousTarget) {
      return 0.55;
    }
    if (signals.requestedTools.length > 0 || signals.matchedSignals.length > 0) {
      return 0.86;
    }
    return 0.74;
  }

  private normalizeText(text: string): string {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private normalizeList(values: string[]): string[] {
    return this.unique(values.map((value) => String(value || '').trim()).filter(Boolean));
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  private hasAnyTool(tools: string[], candidates: string[]): boolean {
    return tools.some((tool) => candidates.includes(tool));
  }

  private matches(text: string, pattern: RegExp): boolean {
    return pattern.test(text);
  }

  private isAmbiguousTarget(text: string): boolean {
    return this.matches(text, /\b(isso|isto|aquilo|esse|essa|dessa|desse|disso|ele|ela|eles|elas|continua|continue|faca)\b/);
  }

  private looksLikeConcreteTarget(text: string): boolean {
    return this.matches(text, /\b(src\/|\.ts\b|\.tsx\b|\.js\b|\.json\b|package\.json|pasta|folder|downloads?|workspace|repositorio|repo|arquivo|file|diretorio|directory)\b/);
  }

  private pushSignal(signals: string[], signal: string, enabled: boolean): void {
    if (enabled) {
      signals.push(signal);
    }
  }
}
