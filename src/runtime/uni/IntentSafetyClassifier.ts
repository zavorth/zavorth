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
    const intentText = this.stripKnownContextPaths(text, input);
    const toolsFromRequest = this.normalizeList(input.requestedTools || []);
    const toolsFromCapabilities = this.normalizeList(input.capabilityIds || []);
    const inferredTools = inferUniversalAgentRequestedTools({
      text: intentText,
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
      || this.detectTextMutation(intentText);
    const shell = Boolean(input.riskHints?.shell)
      || this.hasAnyTool(requestedTools, ['shell.exec', 'bash.exec', 'powershell.exec'])
      || this.detectTextShell(intentText);
    const network = Boolean(input.riskHints?.network)
      || this.hasAnyTool(requestedTools, ['network_fetch', 'web.search', 'browser.open', 'web_search', 'deep_search']);
    const externalSideEffect = Boolean(input.riskHints?.externalSideEffect)
      || this.hasAnyTool(requestedTools, ['email.send', 'report.send', 'slack.send', 'telegram.send', 'publish'])
      || this.detectTextExternalSideEffect(intentText);
    const destructive = Boolean(input.riskHints?.destructive)
      || this.hasAnyTool(requestedTools, ['delete_file', 'workspace.delete', 'git.reset', 'system.delete'])
      || this.detectTextDestructive(intentText);
    const automation = this.hasAnyTool(requestedTools, ['automation.create', 'watch.create', 'watchmode.control', 'cron.create'])
      || Boolean(input.riskHints?.externalSideEffect);
    const inspection = this.hasAnyTool(requestedTools, ['read_file', 'workspace.read', 'folder.read']);
    const operatorRequired = Boolean(input.riskHints?.operatorRequired)
      || this.hasAnyTool(requestedTools, ['selfmod.preview', 'watchmode.control', 'system.delete'])
      || this.detectTextOperatorRequired(intentText);
    const sensitiveDomain = Boolean(input.contextHints?.sensitiveDomain);
    const hostScopeRequested = Boolean(input.contextHints?.hostScopeRequested);
    const ambiguousTarget = this.isAmbiguousTarget(intentText) && !hasKnownTarget;

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
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code < 0x0300 || code > 0x036f;
      })
      .join('')
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

  private isAmbiguousTarget(text: string): boolean {
    const ambiguousPatterns = [
      /\bfix\s+this\b/i,
      /\b(delete|remove)\s+this\b/i,
      /\bmove\s+the rest\b/i,
      /\bchange\s+this\b/i,
      /\bupdate\s+this\b/i,
      /\badjust\s+this\b/i,
      /\bedit\s+this\b/i,
      /\bdelete\s+.*\bmove\b/i,
      /\bmove\s+.*\bthe rest\b/i,
      /\bcorrija\s+isso\b/i,
      /\bapague\s+isso\b/i,
      /\bmova\s+o\s+resto\b/i,
      /\b(apague|delete|remova)\b.*\b(mova|move)\b/i,
    ];
    return ambiguousPatterns.some((pattern) => pattern.test(text.trim()));
  }

  private looksLikeConcreteTarget(text: string): boolean {
    return text.includes('/')
      || text.includes('\\')
      || text.includes('.ts')
      || text.includes('.tsx')
      || text.includes('.js')
      || text.includes('.json');
  }

  private stripKnownContextPaths(text: string, input: UniversalIntentInput): string {
    const values = [
      input.contextHints?.workspacePath,
      input.contextHints?.workspaceRoot,
      input.contextHints?.targetPath,
    ];
    let output = text;
    for (const value of values) {
      const normalized = this.normalizeText(String(value || ''));
      if (!normalized) {
        continue;
      }
      output = output.split(normalized).join(' ');
      output = output.split(normalized.replace(/\\/g, '/')).join(' ');
      output = output.split(normalized.replace(/\//g, '\\')).join(' ');
    }
    return output.split(' ').filter(Boolean).join(' ').trim();
  }
  private detectTextShell(text: string): boolean {
    const shellPatterns = [
      /\brun\s+(npm|git|yarn|pnpm|npx|node|python|pip|cargo|docker|kubectl|make|cmake)/i,
      /\bexecute\s+(npm|git|yarn|pnpm|npx|node|python|pip|cargo|docker|kubectl|make|cmake)/i,
      /\brun\s+git\s+reset/i,
      /\brun\s+full\s+host\s+command/i,
      /\brun\s+npm\s+run/i,
      /\brun\s+npm\s+test/i,
      /\brun\s+npm\s+build/i,
      /\brode\s+(npm|git|yarn|pnpm|npx|node|python|pip|cargo|docker|kubectl|make|cmake)/i,
    ];
    return shellPatterns.some((pattern) => pattern.test(text));
  }

  private detectTextExternalSideEffect(text: string): boolean {
    const externalPatterns = [
      /\bsend\s+(an?\s+)?(email|report|message|notification)/i,
      /\bsend\s+(email|report|message)\s+(to|for)/i,
      /\bpublish\s+(to|on|the)/i,
      /\benvie\s+o\s+(email|relatorio|mensagem|notificacao)\b/i,
      /\benvie\s+(um|uma)\s+(email|relatorio|mensagem|notificacao)\b/i,
    ];
    return externalPatterns.some((pattern) => pattern.test(text));
  }

  private detectTextMutation(text: string): boolean {
    const mutationPatterns = [
      /\bapply\s+(a\s+)?patch/i,
      /\borganize\s+(my\s+)?(folder|downloads)/i,
      /\b(edit|write|change|modify)\b.*\b(src\/|file)\b/i,
      /\bapply\s+(an?\s+)?patch/i,
      /\bedit\s+src\//i,
      /\bpatch\b.*\b(file|workspace|reversible)\b/i,
      /\b(file|workspace)\b.*\bpatch\b/i,
      /\baplique\s+(um\s+)?patch\b/i,
      /\borganize\s+(minha\s+)?(pasta|downloads)\b/i,
      /\b(edite|modifique|altere)\b.*\b(src\/|arquivo)\b/i,
    ];
    return mutationPatterns.some((pattern) => pattern.test(text));
  }

  private detectTextDestructive(text: string): boolean {
    const destructivePatterns = [
      /\bgit\s+reset\s+--hard/i,
      /\bdelete\s+(all|everything|the|this|file|directory)/i,
      /\bremove\s+(all|everything|the|this)/i,
      /\bdrop\s+(table|database|all)/i,
      /\bformat\s+(the|this|disk|drive)/i,
    ];
    return destructivePatterns.some((pattern) => pattern.test(text));
  }

  private detectTextOperatorRequired(text: string): boolean {
    const operatorPatterns = [
      /\bselfmod\b/i,
      /\benable\s+supervised\b/i,
      /\bwatchmode\b/i,
    ];
    return operatorPatterns.some((pattern) => pattern.test(text));
  }

  private pushSignal(signals: string[], signal: string, enabled: boolean): void {
    if (enabled) {
      signals.push(signal);
    }
  }
}
