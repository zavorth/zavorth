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
      .map((entry) => `${entry.label} is at postura ${entry.pressure} (${entry.workingSetMb} MB).`)
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
            ? `WSL com ${runningDistros.length} distro(s) active(s): ${runningDistros.join(', ')}.`
            : desktop.signals.wsl.message || 'WSL parado.',
        details: [
          `Known distros: ${desktop.signals.wsl.distros.map((entry) => entry.name).join(', ') || 'none'}.`,
          lastAction ? `Latest action: ${lastAction.actionId} at ${lastAction.updatedAt}.` : 'without recent registered action.',
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
            ? 'Docker Desktop did not respond on this host.'
            : (runningContainerCount || 0) > 0
              ? `Docker Desktop com ${runningContainerCount} container(es) rodando.`
              : processCount > 0
                ? 'Docker Desktop active e aparentando ociosidade.'
                : 'Docker Desktop parado.',
        details: [
          desktop.signals.docker.contextName ? `Contexto Docker: ${desktop.signals.docker.contextName}.`
            : 'Contexto Docker unavailable.',
          lastAction ? `Latest action: ${lastAction.actionId} at ${lastAction.updatedAt}.` : 'without recent registered action.',
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
          ? `${label} aparece active com ${processCount} process(s) observavel(is).`
          : `${label} did not appear active in this read.`,
      details: [
        activeWindowTitles.length > 0
          ? `Janelas: ${activeWindowTitles.join(' | ')}.`
          : `No visible window for ${label}.`,
        lastAction ? `Latest action: ${lastAction.actionId} at ${lastAction.updatedAt}.` : 'without recent registered action.',
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
      description: 'Ler o estado current desse companion without alterar nada.',
      safety: 'safe',
      requiresApproval: false,
      available: true,
      reason: 'Leitura safe.',
      command: `/companion inspect ${companionId}`,
    };

    if (companionId === 'wsl') {
      return [
        inspect,
        {
          actionId: 'hibernate',
          label: 'Hibernar',
          description: 'Shut down WSL and return memory to the host.',
          safety: runtime.runningDistros.length > 0 ? 'cautious' : 'safe',
          requiresApproval: runtime.runningDistros.length > 0,
          available: status === 'running',
          reason:
            status !== 'running'
              ? 'O WSL already is parado.'
              : runtime.runningDistros.length > 0
                ? `Ha distros actives (${runtime.runningDistros.join(', ')}), entao vale confirmar before desligar.`
                : 'WSL without visible load; hibernation is usually safe.',
          command: `/companion hibernate ${companionId}`,
        },
        {
          actionId: 'resume',
          label: 'resume',
          description: 'Subir a distro default do WSL when you realmente need.',
          safety: 'safe',
          requiresApproval: false,
          available: status !== 'running',
          reason: status === 'running' ? 'O WSL already is active.' : 'Resumesda leve da distro default.',
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
          description: 'Close Docker Desktop when there are no active containers.',
          safety: hasContainers ? 'approval-required' : 'safe',
          requiresApproval: hasContainers,
          available: status === 'running' || status === 'idle' || (status === 'unavailable' && hasResidualProcesses),
          reason:
            status === 'unavailable'
              ? hasResidualProcesses ? 'Docker Desktop residual processes still exist; cleaning the companion is worthwhile.'
                : 'Docker Desktop is not available.'
              : hasContainers ? `There are ${runtime.runningContainerCount} container(es) rodando.`
                : 'without containers actives; encerrar costuma ser seguro.',
          command: `/companion hibernate ${companionId}`,
        },
        {
          actionId: 'resume',
          label: 'resume',
          description: 'Abrir o Docker Desktop again.',
          safety: 'safe',
          requiresApproval: false,
          available: status === 'stopped' || status === 'unavailable',
          reason: status === 'running' || status === 'idle' ? 'Docker Desktop already is active.' : 'Resumesda local do app.',
          command: `/companion resume ${companionId}`,
        },
      ];
    }

    if (companionId === 'zavorthBridge') {
      return [
        inspect,
        {
          actionId: 'trim',
          label: 'Mode leve',
          description: 'review watchers, extensions e repositorys abertos before encerrar o app.',
          safety: 'safe',
          requiresApproval: false,
          available: true,
          reason: 'Action guiada without kill cego.',
          command: `/companion trim ${companionId}`,
        },
        {
          actionId: 'restart-safe',
          label: 'Restart seguro',
          description: 'Pedir restart do ZavorthBridge only when houver uma surface interactive safe.',
          safety: runtime.activeWindowTitles.length > 0 ? 'approval-required' : 'cautious',
          requiresApproval: runtime.activeWindowTitles.length > 0,
          available: status === 'running',
          reason:
            status !== 'running'
              ? 'ZavorthBridge did not appear active.'
              : runtime.activeWindowTitles.length > 0
                ? 'An active window exists; restart must be confirmed first.'
                : 'Restart supervised available.',
          command: `/companion restart-safe ${companionId}`,
        },
      ];
    }

    return [
      inspect,
      {
        actionId: 'trim',
        label: 'Mode leve',
        description: 'review companion sessions and processes before closing anything.',
        safety: 'safe',
        requiresApproval: false,
        available: true,
        reason: 'Action guiada without encerramento cego.',
        command: `/companion trim ${companionId}`,
      },
    ];
  }

  private round(value: number): number {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
}
