import {
  EXPERIENCE_PLAN_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceCommand,
  type ExperienceJourneyKind,
  type ExperiencePlan,
  type ExperiencePlanStep,
} from './ExperienceContracts.js';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function makeAction(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

function step(id: string, title: string, detail: string, status: ExperiencePlanStep['status'] = 'pending'): ExperiencePlanStep {
  return { id, title, detail, status };
}

export class NaturalCommandRouterService {
  public route(command: ExperienceCommand): ExperiencePlan {
    const text = String(command.text || '').trim();
    const normalized = normalizeText(text);
    const explicit = command.intent;
    const kind = this.resolveKind(normalized, explicit);
    const risk = this.resolveRisk(kind, normalized);
    const requiresApproval = this.requiresApproval(kind, normalized);
    const shouldExecuteAgent = this.shouldExecuteAgent(kind, normalized, explicit);
    const title = this.titleFor(kind);
    const summary = this.summaryFor(kind, text);
    const nextSafeAction = this.nextSafeActionFor(kind, requiresApproval);
    const actions = this.actionsFor(kind, text, command);

    return {
      contractVersion: EXPERIENCE_PLAN_CONTRACT_VERSION,
      id: `experience-plan:${kind}:${Date.now().toString(36)}`,
      kind,
      title,
      summary,
      nextSafeAction,
      risk,
      requiresApproval,
      shouldExecuteAgent,
      steps: this.stepsFor(kind, requiresApproval, shouldExecuteAgent),
      actions,
      metadata: {
        normalizedIntent: normalized,
        explicitIntent: explicit || null,
        surface: command.surface,
      },
    };
  }

  private resolveKind(normalized: string, explicit?: ExperienceCommand['intent']): ExperienceJourneyKind {
    if (explicit === 'open-zavorthControl') return 'zavorthControl';
    if (explicit === 'diagnose') return 'diagnostics';
    if (explicit === 'approve' || explicit === 'reject') return 'approval';
    if (explicit === 'learn') return 'learning';
    if (explicit === 'memory') return 'memory';
    if (explicit === 'setup') return 'first-run';

    if (/\b(aprovar|approve|rejeitar|reject)\b/.test(normalized)) return 'approval';
    if (/\b(aprendi|aprendizado|learning|learn|memoria|memory|preferencia|preference)\b/.test(normalized)) {
      return /\b(memoria|memory|recall|lembr)\b/.test(normalized) ? 'memory' : 'learning';
    }
    if (/\b(abrir|open|zavorthControl|painel|control|zavorthControl)\b/.test(normalized)) return 'zavorthControl';
    if (/\b(doctor|diagnostico|diagnose|status|bloqueado|blocked|erro|falha|health|ready)\b/.test(normalized)) {
      return /\b(bloqueado|blocked|por que|porque|why)\b/.test(normalized) ? 'explain-block' : 'diagnostics';
    }
    if (/\b(provider|modelo|model|openai|gemini|anthropic|openrouter|ollama)\b/.test(normalized)) return 'provider-setup';
    if (/\b(telegram|discord|slack|email|canal|channel|whatsapp|signal)\b/.test(normalized)) return 'channel-setup';
    if (/\b(seguranca|security|audit|auditar|vulnerabilidade|owasp|secrets?)\b/.test(normalized)) return 'security-audit';
    if (/\b(subagent|subagente|delegate|delegar|worker|parallel|paralelo|multiagent|multi-agent)\b/.test(normalized)) return 'code-task';
    if (/\b(skill|skills|habilidade|capability|capabilities|ferramenta|tooling)\b/.test(normalized)) return 'learning';
    if (/\b(release|ship|deploy|publicar|lancar)\b/.test(normalized)) return 'release';
    if (/\b(automatizar|automacao|schedule|scheduler|cron|rotina)\b/.test(normalized)) return 'automation';
    if (/\b(revisar|review|corrigir|fix|bug|feature|implementar|codigo|code|repo|workspace|testar|teste)\b/.test(normalized)) {
      return /\b(revisar|revise|review)\b/.test(normalized) ? 'workspace-review' : 'code-task';
    }
    if (/\b(setup|configurar|comecar|onboarding|primeiro uso|first run)\b/.test(normalized)) return 'first-run';
    return 'conversation';
  }

  private resolveRisk(kind: ExperienceJourneyKind, normalized: string): ExperienceAction['risk'] {
    if (kind === 'security-audit' || kind === 'diagnostics' || kind === 'zavorthControl' || kind === 'memory' || kind === 'learning') {
      return 'safe';
    }
    if (kind === 'approval') return 'attention';
    if (/\b(delete|deletar|remover|rm\s+-|formatar|publish|publicar|deploy|enviar|send|shell|powershell|npm|pnpm|yarn|git)\b/.test(normalized)) {
      return 'danger';
    }
    if (kind === 'code-task' || kind === 'automation' || kind === 'release' || kind === 'channel-setup' || kind === 'provider-setup') {
      return 'attention';
    }
    return 'safe';
  }

  private requiresApproval(kind: ExperienceJourneyKind, normalized: string): boolean {
    if (kind === 'approval') return false;
    if (kind === 'zavorthControl' || kind === 'diagnostics' || kind === 'memory' || kind === 'learning' || kind === 'conversation') {
      return false;
    }
    return /\b(delete|deletar|remover|rm\s+-|formatar|publish|publicar|deploy|enviar|send|instalar|install|shell|powershell)\b/.test(normalized);
  }

  private shouldExecuteAgent(kind: ExperienceJourneyKind, normalized: string, explicit?: ExperienceCommand['intent']): boolean {
    if (explicit === 'run') return true;
    if (kind === 'zavorthControl' || kind === 'diagnostics' || kind === 'approval' || kind === 'learning' || kind === 'memory') return false;
    if (kind === 'conversation') return normalized.length > 0;
    return true;
  }

  private titleFor(kind: ExperienceJourneyKind): string {
    const titles: Record<ExperienceJourneyKind, string> = {
      conversation: 'Natural conversation',
      'first-run': 'Guided first run',
      'provider-setup': 'Configure provider',
      'channel-setup': 'Connect channel',
      'workspace-review': 'Review workspace',
      'code-task': 'Run code task',
      'security-audit': 'Security audit',
      'explain-block': 'Explain blocker',
      approval: 'Resolve approval',
      memory: 'Query memory',
      learning: 'Review learning',
      zavorthControl: 'Open ZavorthControl',
      diagnostics: 'Diagnose runtime',
      release: 'Prepare release',
      automation: 'Automate routine',
    };
    return titles[kind];
  }

  private summaryFor(kind: ExperienceJourneyKind, text: string): string {
    const request = String(text || '').trim();
    if (kind === 'zavorthControl') return 'Open the main visual surface for Zavorth.';
    if (kind === 'diagnostics') return 'Read readiness, runtime and next safe-action signals.';
    if (kind === 'learning') return 'Show, approve, reject or export governed learning.';
    if (kind === 'memory') return 'Query memory signals and workspace continuity.';
    return request ? `Natural-first plan for: ${request}` : 'Natural-first plan ready for the request.';
  }

  private nextSafeActionFor(kind: ExperienceJourneyKind, requiresApproval: boolean): string {
    if (requiresApproval) return 'Review Trust Lens before any sensitive effect runs.';
    if (kind === 'zavorthControl') return 'Open /zavorthControl.';
    if (kind === 'provider-setup') return 'Open contextual provider setup and test the route before using it.';
    if (kind === 'channel-setup') return 'Open contextual channel setup, pair/allowlist the sender, and verify a proof receipt.';
    if (kind === 'automation') return 'Prepare a governed event hook or scheduled task with preview, receipt and rollback.';
    if (kind === 'code-task') return 'Use the LLM-first loop with safe tools, sandbox-first mutations and receipts.';
    if (kind === 'learning') return 'Review candidates before promoting future behavior.';
    if (kind === 'diagnostics') return 'Read the diagnosis and choose a guided repair.';
    return 'Run in governed mode and publish timeline/receipt.';
  }

  private stepsFor(
    kind: ExperienceJourneyKind,
    requiresApproval: boolean,
    shouldExecuteAgent: boolean,
  ): ExperiencePlanStep[] {
    const steps = [
      step('intent', 'Understand intent', `Selected route: ${kind}.`, 'done'),
      step('context', 'Load context', 'Unify runtime, memory, approvals and receipts.'),
    ];
    if (requiresApproval) {
      steps.push(step('approval', 'Prepare approval', 'Show risk, scope and sandbox alternative.', 'blocked'));
    }
    if (shouldExecuteAgent) {
      steps.push(step('execute', 'Run agent', 'Use the governed LLM/tool loop when useful.'));
      steps.push(step('receipt', 'Emit receipt', 'Record evidence, results and learning candidates.'));
    }
    if (kind === 'learning') {
      steps.push(step('learning', 'Review learning', 'Promote only user-approved candidates.'));
    }
    if (kind === 'code-task') {
      steps.push(step('sandbox', 'Validate safely', 'Use sandbox/rehearsal before any host mutation.'));
    }
    if (kind === 'automation') {
      steps.push(step('policy', 'Bind policy', 'Attach trigger, action, receipt and rollback before enabling automation.'));
    }
    return steps;
  }

  private actionsFor(kind: ExperienceJourneyKind, text: string, command: ExperienceCommand): ExperienceAction[] {
    const requestText = String(text || '').trim();
    const actions: ExperienceAction[] = [
      makeAction({
        id: 'experience.ask',
        label: 'Continue in natural language',
        kind: 'natural',
        command: requestText ? `zavorth ask "${requestText.replace(/"/g, '\\"')}"` : 'zavorth ask "<pedido>"',
        reason: 'Keeps CLI and ZavorthControl on the same experience route.',
      }),
    ];
    if (kind === 'zavorthControl') {
      actions.push(makeAction({
        id: 'zavorthControl.open',
        label: 'Open ZavorthControl',
        kind: 'navigation',
        command: 'zavorth open',
        route: '/zavorthControl',
        reason: 'ZavorthControl is the official visual surface.',
      }));
    }
    if (kind === 'diagnostics' || kind === 'explain-block') {
      actions.push(makeAction({
        id: 'runtime.doctor',
        label: 'Run diagnosis',
        kind: 'diagnostic',
        command: 'zavorth doctor',
        reason: 'Shows readiness and the next safe action.',
      }));
    }
    if (kind === 'learning') {
      actions.push(makeAction({
        id: 'learning.review',
        label: 'Review learning',
        kind: 'learning',
        command: 'zavorth learn',
        reason: 'Learning only changes future behavior after review.',
      }));
    }
    if (kind === 'provider-setup') {
      actions.push(makeAction({
        id: 'provider.contextual-setup',
        label: 'Configure provider',
        kind: 'diagnostic',
        command: 'zavorth setup',
        reason: 'Connects model, key reference, route test and fallback without exposing secrets in chat.',
      }));
      actions.push(makeAction({
        id: 'provider.routes',
        label: 'Inspect model routes',
        kind: 'diagnostic',
        command: 'zavorth providers',
        reason: 'Shows configured providers, gateway fallback and readiness.',
      }));
    }
    if (kind === 'channel-setup') {
      actions.push(makeAction({
        id: 'channel.contextual-setup',
        label: 'Connect channel',
        kind: 'diagnostic',
        command: 'zavorth channels',
        reason: 'Pairs/allowlists remote surfaces before they can reach tools.',
      }));
    }
    if (kind === 'code-task') {
      actions.push(makeAction({
        id: 'code.sandbox-first',
        label: 'Use sandbox-first execution',
        kind: 'natural',
        command: requestText ? `zavorth ask "${requestText.replace(/"/g, '\\"')}"` : 'zavorth ask "review this workspace"',
        reason: 'Lets the LLM plan, use safe tools, rehearse mutations and request approval only when needed.',
      }));
    }
    if (kind === 'automation') {
      actions.push(makeAction({
        id: 'automation.hooks',
        label: 'Prepare governed automation',
        kind: 'diagnostic',
        command: 'zavorth hooks',
        reason: 'Automation is event-driven and policy-bound before it can affect the workspace or channels.',
        risk: 'attention',
      }));
    }
    if (kind === 'approval' && command.approval?.id) {
      actions.push(makeAction({
        id: `approval.${command.approval.decision}`,
        label: command.approval.decision === 'approve' ? 'Approve action' : 'Reject action',
        kind: 'approval',
        command: `zavorth ${command.approval.decision} ${command.approval.id}`,
        reason: 'Resolves the runtime-governed approval.',
        risk: 'attention',
      }));
    }
    return actions;
  }
}
