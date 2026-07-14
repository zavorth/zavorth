import type {
  CompanionActionDescriptor,
  CompanionControlSnapshot,
  CompanionDescriptor,
  CompanionId,
  CompanionStatus,
  CompanionStateRecord,
} from '../contracts/CompanionControlContract.js';
import type { DesktopResourceItem, DesktopResourceSnapshot } from '../contracts/DesktopResourceContract.js';

type CompanionLifecyclePolicyRuntime = {
  now?: () => Date;
};

const COMPANION_IDS: CompanionId[] = ['wsl', 'docker-desktop', 'zavorthBridge', 'codex-companion'];

export class CompanionLifecyclePolicy {
  private readonly now: () => Date;

  constructor(runtime: CompanionLifecyclePolicyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(
    desktop: DesktopResourceSnapshot,
    lastActions: Partial<Record<CompanionId, CompanionStateRecord>> = {},
  ): CompanionControlSnapshot {
    const companions = COMPANION_IDS.map((companionId) => this.buildDescriptor(companionId, desktop, lastActions[companionId]));
    const warnings = companions
      .filter((entry) => entry.pressure === 'high' || entry.pressure === 'critical')
      .map((entry) => `${entry.label} esta em postura ${entry.pressure} (${entry.workingSetMb} MB).`)
      .slice(0, 8);
    const recommendations = companions
      .flatMap((entry) => entry.actions.filter((action) => action.available && !action.requiresApproval))
      .slice(0, 8)
      .map((action) => `${action.label}: ${action.description}`);

    return {
      generatedAt: desktop.generatedAt || this.now().toISOString(),
      companions,
      warnings,
      recommendations,
    };
  }

  public buildDescriptor(
    companionId: CompanionId,
    desktop: DesktopResourceSnapshot,
    lastAction?: CompanionStateRecord,
  ): CompanionDescriptor {
    const items = desktop.items.filter((entry) => entry.controlId === companionId);
    const workingSetMb = this.round(items.reduce((total, entry) => total + entry.metrics.workingSetMb, 0));
    const processCount = items.filter((entry) => entry.process).length;
    const activeWindowTitles = items
      .map((entry) => entry.process?.mainWindowTitle || '')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (companionId === 'wsl') {
      const runningDistros = desktop.signals.wsl.distros
        .filter((entry) => entry.state.toLowerCase() === 'running')
        .map((entry) => entry.name);
      const status: CompanionStatus = runningDistros.length > 0 ? 'running' : 'stopped';
      return {
        id: companionId,
        label: 'WSL',
        status,
        pressure: workingSetMb >= 256 ? 'high' : workingSetMb >= 96 ? 'moderate' : 'low',
        workingSetMb,
        processCount,
        summary:
          runningDistros.length > 0
            ? `WSL com ${runningDistros.length} distro(s) ativa(s): ${runningDistros.join(', ')}.`
            : desktop.signals.wsl.message || 'WSL parado.',
        details: [
          `Distros conhecidas: ${desktop.signals.wsl.distros.map((entry) => entry.name).join(', ') || 'nenhuma'}.`,
          lastAction ? `Ultima acao: ${lastAction.actionId} em ${lastAction.updatedAt}.` : 'Sem acao recente registrada.',
        ],
        activeWindowTitles,
        runningContainerCount: null,
        runningDistros,
        actions: this.buildActions(companionId, status, {
          runningDistros,
          workingSetMb,
          processCount,
          activeWindowTitles,
          runningContainerCount: null,
        }),
      };
    }

    if (companionId === 'docker-desktop') {
      const runningContainerCount = desktop.signals.docker.runningContainerCount;
      const status: CompanionStatus =
        desktop.signals.docker.detected
          ? (runningContainerCount || 0) > 0
            ? 'running'
            : processCount > 0
              ? 'idle'
              : desktop.signals.docker.status === 'idle'
                ? 'idle'
                : 'stopped'
          : 'unavailable';
      return {
        id: companionId,
        label: 'Docker Desktop',
        status,
        pressure: workingSetMb >= 256 ? 'high' : workingSetMb >= 96 ? 'moderate' : 'low',
        workingSetMb,
        processCount,
        summary:
          status === 'unavailable'
            ? 'Docker Desktop nao respondeu neste host.'
            : (runningContainerCount || 0) > 0
              ? `Docker Desktop com ${runningContainerCount} container(es) rodando.`
              : processCount > 0
                ? 'Docker Desktop ativo e aparentando ociosidade.'
                : 'Docker Desktop parado.',
        details: [
          desktop.signals.docker.contextName
            ? `Contexto Docker: ${desktop.signals.docker.contextName}.`
            : 'Contexto Docker indisponivel.',
          lastAction ? `Ultima acao: ${lastAction.actionId} em ${lastAction.updatedAt}.` : 'Sem acao recente registrada.',
        ],
        activeWindowTitles,
        runningContainerCount,
        runningDistros: [],
        actions: this.buildActions(companionId, status, {
          runningDistros: [],
          workingSetMb,
          processCount,
          activeWindowTitles,
          runningContainerCount,
        }),
      };
    }

    const status: CompanionStatus = processCount > 0 ? 'running' : 'stopped';
    const label = companionId === 'zavorthBridge' ? 'ZavorthBridge' : 'Codex';
    return {
      id: companionId,
      label,
      status,
      pressure: workingSetMb >= 256 ? 'high' : workingSetMb >= 96 ? 'moderate' : 'low',
      workingSetMb,
      processCount,
      summary:
        status === 'running'
          ? `${label} aparece ativo com ${processCount} processo(s) observavel(is).`
          : `${label} nao apareceu ativo nesta leitura.`,
      details: [
        activeWindowTitles.length > 0
          ? `Janelas: ${activeWindowTitles.join(' | ')}.`
          : `Nenhuma janela visivel do ${label}.`,
        lastAction ? `Ultima acao: ${lastAction.actionId} em ${lastAction.updatedAt}.` : 'Sem acao recente registrada.',
      ],
      activeWindowTitles,
      runningContainerCount: null,
      runningDistros: [],
      actions: this.buildActions(companionId, status, {
        runningDistros: [],
        workingSetMb,
        processCount,
        activeWindowTitles,
        runningContainerCount: null,
      }),
    };
  }

  private buildActions(
    companionId: CompanionId,
    status: CompanionStatus,
    runtime: {
      runningDistros: string[];
      workingSetMb: number;
      processCount: number;
      activeWindowTitles: string[];
      runningContainerCount: number | null;
    },
  ): CompanionActionDescriptor[] {
    const inspect: CompanionActionDescriptor = {
      actionId: 'inspect',
      label: 'Inspecionar',
      description: 'Ler o estado atual desse companion sem alterar nada.',
      safety: 'safe',
      requiresApproval: false,
      available: true,
      reason: 'Leitura segura.',
      command: `/companion inspect ${companionId}`,
    };

    if (companionId === 'wsl') {
      return [
        inspect,
        {
          actionId: 'hibernate',
          label: 'Hibernar',
          description: 'Desligar o WSL e devolver memoria ao host.',
          safety: runtime.runningDistros.length > 0 ? 'cautious' : 'safe',
          requiresApproval: runtime.runningDistros.length > 0,
          available: status === 'running',
          reason:
            status !== 'running'
              ? 'O WSL ja esta parado.'
              : runtime.runningDistros.length > 0
                ? `Ha distros ativas (${runtime.runningDistros.join(', ')}), entao vale confirmar antes de desligar.`
                : 'WSL sem carga visivel; hibernacao costuma ser segura.',
          command: `/companion hibernate ${companionId}`,
        },
        {
          actionId: 'resume',
          label: 'Retomar',
          description: 'Subir a distro padrao do WSL quando voce realmente precisar.',
          safety: 'safe',
          requiresApproval: false,
          available: status !== 'running',
          reason: status === 'running' ? 'O WSL ja esta ativo.' : 'Retomada leve da distro padrao.',
          command: `/companion resume ${companionId}`,
        },
      ];
    }

    if (companionId === 'docker-desktop') {
      const hasContainers = (runtime.runningContainerCount || 0) > 0;
      const hasResidualProcesses = runtime.processCount > 0 || runtime.workingSetMb > 0;
      return [
        inspect,
        {
          actionId: 'stop-idle',
          label: 'Parar ocioso',
          description: 'Fechar o Docker Desktop quando nao houver containers ativos.',
          safety: hasContainers ? 'approval-required' : 'safe',
          requiresApproval: hasContainers,
          available: status === 'running' || status === 'idle' || (status === 'unavailable' && hasResidualProcesses),
          reason:
            status === 'unavailable'
              ? hasResidualProcesses
                ? 'Ainda existem processos residuais do Docker Desktop; vale limpar o companion.'
                : 'Docker Desktop nao esta disponivel.'
              : hasContainers
                ? `There are ${runtime.runningContainerCount} container(es) rodando.`
                : 'Sem containers ativos; encerrar costuma ser seguro.',
          command: `/companion hibernate ${companionId}`,
        },
        {
          actionId: 'resume',
          label: 'Retomar',
          description: 'Abrir o Docker Desktop novamente.',
          safety: 'safe',
          requiresApproval: false,
          available: status === 'stopped' || status === 'unavailable',
          reason: status === 'running' || status === 'idle' ? 'Docker Desktop ja esta ativo.' : 'Retomada local do app.',
          command: `/companion resume ${companionId}`,
        },
      ];
    }

    if (companionId === 'zavorthBridge') {
      return [
        inspect,
        {
          actionId: 'trim',
          label: 'Modo leve',
          description: 'Revisar watchers, extensoes e repositorios abertos antes de encerrar o app.',
          safety: 'safe',
          requiresApproval: false,
          available: true,
          reason: 'Acao guiada sem kill cego.',
          command: `/companion trim ${companionId}`,
        },
        {
          actionId: 'restart-safe',
          label: 'Restart seguro',
          description: 'Pedir restart do ZavorthBridge apenas quando houver uma superficie interativa segura.',
          safety: runtime.activeWindowTitles.length > 0 ? 'approval-required' : 'cautious',
          requiresApproval: runtime.activeWindowTitles.length > 0,
          available: status === 'running',
          reason:
            status !== 'running'
              ? 'ZavorthBridge nao apareceu ativo.'
              : runtime.activeWindowTitles.length > 0
                ? 'Existe janela ativa; o restart deve ser confirmado antes.'
                : 'Restart supervisionado disponivel.',
          command: `/companion restart-safe ${companionId}`,
        },
      ];
    }

    return [
      inspect,
      {
        actionId: 'trim',
        label: 'Modo leve',
        description: 'Revisar sessoes e processos do companion antes de encerrar algo.',
        safety: 'safe',
        requiresApproval: false,
        available: true,
        reason: 'Acao guiada sem encerramento cego.',
        command: `/companion trim ${companionId}`,
      },
    ];
  }

  private round(value: number): number {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
}
