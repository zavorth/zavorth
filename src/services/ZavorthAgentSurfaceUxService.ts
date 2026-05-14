import type {
  SurfaceResponse,
  SurfaceResponseAction,
  SurfaceResponseTone,
} from '../domain/surface/application/surface-response/index.js';
import { createSurfaceResponse } from '../domain/surface/application/surface-response/index.js';
import type { ZavorthNaturalInvocationPlan } from '../contracts/ZavorthNaturalInvocationContract.js';
import type {
  ZavorthSubagentRuntimeSession,
  ZavorthSubagentRuntimeSnapshot,
  ZavorthSubagentRuntimeStatus,
  ZavorthSubagentRuntimeTimelineEvent,
} from '../contracts/ZavorthSubagentRuntimeContract.js';

export class ZavorthAgentSurfaceUxService {
  public buildSubagentRuntimeResponse(
    snapshot: ZavorthSubagentRuntimeSnapshot,
  ): SurfaceResponse {
    const sessions = safeArray(snapshot.sessions);
    const timeline = safeArray(snapshot.timeline);
    const summary = snapshot.summary || {};
    const selectedSession = snapshot.selectedSessionId
      ? sessions.find((session) => session.sessionId === snapshot.selectedSessionId) || null
      : null;
    const autoProjection = snapshot.autoInvocationTelemetry?.dashboardProjection || null;
    const text = this.formatSubagentRuntimeText(snapshot, selectedSession);
    const actions = this.buildAgentActions(snapshot);

    return createSurfaceResponse({
      id: `zavorth-agents-${safeId(snapshot.action || 'status')}-${safeId(snapshot.generatedAt || 'now')}`,
      intent: 'status',
      title: 'Agentes do Zavorth',
      summary: [
        `Status ${snapshot.status || 'ready'}.`,
        `Sessoes ${numberValue(summary.sessions)}.`,
        `Runs ${numberValue(summary.runs)}.`,
        `Workers ${numberValue(summary.workerResults)}.`,
      ].join(' '),
      tone: toneForSubagentStatus(snapshot.status),
      blocks: [
        {
          kind: 'text',
          title: 'Leitura operacional',
          text,
        },
        {
          kind: 'table',
          table: {
            title: 'Sessoes recentes',
            columns: [
              { key: 'session', label: 'Sessao', width: 20 },
              { key: 'status', label: 'Status', width: 12 },
              { key: 'modo', label: 'Modo', width: 16 },
              { key: 'roles', label: 'Roles', width: 28 },
            ],
            rows: sessions.slice(0, 6).map((session) => ({
              session: session.sessionId,
              status: session.status,
              modo: `${session.mode}/${session.executionMode}`,
              roles: session.roleIds.join(', ') || 'auto',
            })),
            emptyText: 'Nenhuma sessao ainda. Use /agents spawn <tarefa>.',
          },
        },
        {
          kind: 'list',
          title: 'Timeline',
          items: timeline.slice(-5).map((event) => this.formatTimelineEvent(event)),
        },
        ...(autoProjection?.available
          ? [{
              kind: 'list' as const,
              title: 'Auto subagents',
              items: [
                autoProjection.summary,
                `selectedBy=${autoProjection.selectedBy}`,
                `roles=${autoProjection.roles.join(', ') || 'auto'}`,
                `proximo=${autoProjection.nextSafeAction}`,
              ],
            }]
          : []),
      ],
      actions,
      metadata: {
        source: snapshot.source || 'ZavorthSubagentRuntimeService',
        action: snapshot.action || null,
        selectedSessionId: snapshot.selectedSessionId || null,
        selectedRunId: snapshot.selectedRunId || null,
        liveRuns: numberValue(summary.liveRuns),
        workerResults: numberValue(summary.workerResults),
        autoInvocationDecisions: numberValue(summary.autoInvocationDecisions),
      },
    });
  }

  public buildNaturalInvocationResponse(
    plan: ZavorthNaturalInvocationPlan,
  ): SurfaceResponse {
    const actions = this.buildNaturalInvocationActions(plan);
    const execution = plan.execution?.subagentRuntime || null;
    const sandbox = plan.execution?.sandboxLifecycle || null;
    const executionSummary = execution
      ? `Execucao: ${execution.status}; live=${numberValue(execution.summary?.liveRuns)}; resultados=${numberValue(execution.summary?.workerResults)}.`
      : 'Execucao: ainda nao iniciada nesta resposta.';
    const sandboxSummary = sandbox
      ? `Sandbox: ${sandbox.intent}; runtime=${sandbox.selectedRuntime}; status=${sandbox.status}; approval=${sandbox.approval.required ? 'required' : 'not-required'}.`
      : 'Sandbox: not selected.';

    return createSurfaceResponse({
      id: `zavorth-natural-invoke-${safeId(plan.primaryAction)}-${safeId(plan.generatedAt)}`,
      intent: 'generic',
      title: 'Zavorth Natural Invoke',
      summary: `${plan.narrative?.summary || 'Pedido roteado.'} Status ${plan.status}.`,
      tone: toneForNaturalStatus(plan.status),
      blocks: [
        {
          kind: 'text',
          title: 'Plano escolhido',
          text: [
            `Status: ${plan.status}`,
            `Acao: ${plan.primaryAction}`,
            `Confianca: ${plan.confidence}`,
            `Canal: ${plan.channel}`,
            `Pedido: ${plan.requestText}`,
            `Skill: ${plan.selectedSkillName || 'nenhuma'}`,
            `Agentes: ${plan.selectedSubagentMode || 'nenhum'} | roles=${plan.selectedRoleIds.join(', ') || 'auto'}`,
            executionSummary,
            sandboxSummary,
            `Proximo passo: ${plan.narrative?.nextAction || 'Use uma das acoes sugeridas.'}`,
          ].join('\n'),
        },
        {
          kind: 'table',
          table: {
            title: 'Candidatos',
            columns: [
              { key: 'tipo', label: 'Tipo', width: 12 },
              { key: 'nome', label: 'Nome', width: 26 },
              { key: 'conf', label: 'Conf.', width: 8, align: 'right' },
              { key: 'approval', label: 'Aprov.', width: 8 },
            ],
            rows: safeArray(plan.candidates).slice(0, 5).map((candidate) => ({
              tipo: candidate.kind,
              nome: candidate.label,
              conf: candidate.confidence.toFixed(2),
              approval: candidate.requiresApproval ? 'sim' : 'nao',
            })),
            emptyText: 'Nenhum candidato adicional foi necessario.',
          },
        },
        {
          kind: 'list',
          title: 'Comandos equivalentes',
          items: safeArray(plan.surfaceCommands)
            .slice(0, 6)
            .map((command) => `${command.label}: ${command.command}`),
        },
      ],
      actions,
      metadata: {
        primaryAction: plan.primaryAction,
        selectedSkillName: plan.selectedSkillName,
        selectedSubagentMode: plan.selectedSubagentMode,
        approvalRequired: plan.approval?.required === true,
      },
    });
  }

  private formatSubagentRuntimeText(
    snapshot: ZavorthSubagentRuntimeSnapshot,
    selectedSession: ZavorthSubagentRuntimeSession | null,
  ): string {
    const summary = snapshot.summary || {};
    const lines = [
      'Zavorth Agents',
      '',
      `Status: ${snapshot.status || 'ready'}`,
      `Action: ${snapshot.action || 'subagents.list'}`,
      `Mode: ${snapshot.mode || 'oneshot'}`,
      `Sessions: ${numberValue(summary.sessions)} | active: ${numberValue(summary.activeSessions)}`,
      `Runs: ${numberValue(summary.runs)} | completed: ${numberValue(summary.completedRuns)} | approval: ${numberValue(summary.approvalRequiredRuns)} | denied: ${numberValue(summary.deniedRuns)}`,
      `Workers: liveRuns=${numberValue(summary.liveRuns)} results=${numberValue(summary.workerResults)} failed=${numberValue(summary.failedWorkerResults)}`,
    ];

    if (selectedSession) {
      lines.push(
        '',
        'Selected:',
        `- session: ${selectedSession.sessionId}`,
        `- status: ${selectedSession.status}`,
        `- roles: ${selectedSession.roleIds.join(', ') || 'auto'}`,
      );
      const lastMessages = safeArray(selectedSession.messages).slice(-3);
      for (const message of lastMessages) {
        lines.push(`- ${message.role}: ${firstLine(message.text, 160)}`);
      }
    }

    lines.push(
      '',
      'Comandos uteis:',
      '- /agents status',
      '- /agents spawn <tarefa>',
      '- /agents read latest',
      '- /agents summarize latest',
      '- /agents cancel latest',
      '',
      'Policy: subagentes read-only podem rodar quando pedidos; escrita, rede sensivel e I/O live exigem aprovacao.',
    );
    return lines.join('\n');
  }

  private buildAgentActions(snapshot: ZavorthSubagentRuntimeSnapshot): SurfaceResponseAction[] {
    const selected = snapshot.selectedSessionId || 'latest';
    return [
      commandAction('agents-status', 'Status', '/agents status', 'primary'),
      commandAction('agents-spawn', 'Novo agente', '/agents spawn use subagentes para revisar em modo read-only', 'success'),
      commandAction('agents-read', 'Ler ultimo', `/agents read ${selected}`, 'secondary'),
      commandAction('agents-summary', 'Resumir', `/agents summarize ${selected}`, 'secondary'),
      commandAction('agents-cancel', 'Cancelar', `/agents cancel ${selected}`, 'danger'),
    ];
  }

  private buildNaturalInvocationActions(plan: ZavorthNaturalInvocationPlan): SurfaceResponseAction[] {
    const request = firstLine(plan.requestText, 80);
    const actions: SurfaceResponseAction[] = [
      commandAction('invoke-plan', 'Planejar', `/invoke "${request}" --plan`, 'primary'),
      commandAction('agents-status', 'Agentes', '/agents status', 'secondary'),
      commandAction('skills-search', 'Skills', `/skills search "${request}"`, 'secondary'),
    ];

    if (plan.primaryAction === 'spawn_subagent' || plan.primaryAction === 'spawn_team') {
      actions.push(commandAction('agents-spawn-selected', 'Spawn', `/agents spawn "${request}"`, 'success'));
    }
    if (plan.actions.includes('sandbox_lifecycle')) {
      actions.push(commandAction('sandbox-plan-selected', 'Sandbox', `/sandbox "${request}"`, 'success'));
    }
    if (plan.selectedSkillName) {
      actions.push(commandAction('skills-use-selected', 'Usar skill', `/skills use ${plan.selectedSkillName}`, 'success'));
    }
    if (plan.approval?.required) {
      actions.push({
        ...commandAction('approval-required', 'Aprovacao', '/perm pending', 'danger'),
        confirmationRequired: true,
        description: plan.approval.reason || 'Aprovacao exigida pela policy.',
      });
    }

    return actions;
  }

  private formatTimelineEvent(event: ZavorthSubagentRuntimeTimelineEvent): string {
    return `${event.kind}: ${event.status} | ${event.sessionId || 'runtime'} | ${firstLine(event.detail, 120)}`;
  }
}

function commandAction(
  id: string,
  label: string,
  command: string,
  style: SurfaceResponseAction['style'],
): SurfaceResponseAction {
  return {
    id,
    label,
    kind: 'command',
    command,
    callbackData: command,
    style,
  };
}

function toneForSubagentStatus(status: ZavorthSubagentRuntimeStatus | undefined): SurfaceResponseTone {
  switch (status) {
    case 'completed':
    case 'ready':
      return 'success';
    case 'running':
      return 'info';
    case 'approval-required':
      return 'warning';
    case 'failed':
    case 'denied':
    case 'blocked':
    case 'not-found':
      return 'danger';
    default:
      return 'neutral';
  }
}

function toneForNaturalStatus(status: string): SurfaceResponseTone {
  switch (status) {
    case 'ready':
      return 'success';
    case 'planned':
    case 'ambiguous':
      return 'warning';
    case 'approval-required':
      return 'warning';
    case 'denied':
      return 'danger';
    default:
      return 'neutral';
  }
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstLine(value: unknown, maxLength = 180): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function safeId(value: unknown): string {
  const text = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || 'item';
}
