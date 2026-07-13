import {
  CAPABILITY_CONSOLE_CONTRACT_VERSION,
  type CapabilityConsoleCommandHint,
  type CapabilityConsoleInput,
  type CapabilityConsoleSnapshot,
  type CapabilityConsoleView,
} from '../contracts/CapabilityConsoleContract.js';
import type { CapabilityPackReadinessInput } from '../contracts/CapabilityPackReadinessContract.js';
import { ZavorthCapabilityHubService, type ZavorthCapabilityHubRuntime } from './ZavorthCapabilityHubService.js';
import {
  ZavorthCapabilityPackCatalogService,
  type ZavorthCapabilityPackCatalogRuntime,
} from './ZavorthCapabilityPackCatalogService.js';
import {
  ZavorthCapabilityPackReadinessDoctorService,
  type ZavorthCapabilityPackReadinessDoctorRuntime,
} from './ZavorthCapabilityPackReadinessDoctorService.js';
import {
  ZavorthCapabilitySetupQueueService,
  type ZavorthCapabilitySetupQueueRuntime,
} from './ZavorthCapabilitySetupQueueService.js';
import {
  ZavorthCapabilitySetupExecutorService,
  type ZavorthCapabilitySetupExecutorRuntime,
} from './ZavorthCapabilitySetupExecutorService.js';
import { tService } from '../i18n/services.js';



export type ZavorthCapabilityConsoleRuntime =
  ZavorthCapabilityHubRuntime
  & ZavorthCapabilityPackCatalogRuntime
  & ZavorthCapabilityPackReadinessDoctorRuntime
  & ZavorthCapabilitySetupQueueRuntime
  & ZavorthCapabilitySetupExecutorRuntime;

export class ZavorthCapabilityConsoleService {
  private readonly now: () => Date;
  private readonly hub: ZavorthCapabilityHubService;
  private readonly packs: ZavorthCapabilityPackCatalogService;
  private readonly readiness: ZavorthCapabilityPackReadinessDoctorService;
  private readonly queue: ZavorthCapabilitySetupQueueService;
  private readonly executor: ZavorthCapabilitySetupExecutorService;

  constructor(runtime: ZavorthCapabilityConsoleRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.hub = new ZavorthCapabilityHubService(runtime);
    this.packs = new ZavorthCapabilityPackCatalogService(runtime);
    this.readiness = new ZavorthCapabilityPackReadinessDoctorService(runtime);
    this.queue = new ZavorthCapabilitySetupQueueService(runtime);
    this.executor = new ZavorthCapabilitySetupExecutorService(runtime);
  }

  public buildSnapshot(input: CapabilityConsoleInput = {}): CapabilityConsoleSnapshot {
    const view = input.view || 'overview';
    const hub = this.hub.buildSnapshot({
      query: input.query || undefined,
      selectedId: input.targetItemId || undefined,
      includeItems: input.includeItems !== false,
    });
    const packs = this.packs.buildSnapshot({
      packId: input.packId || null,
      category: input.category || null,
      includeManifests: view === 'packs' || view === 'readiness' || Boolean(input.packId),
    });
    const readiness = input.includeReadiness === false
      ? null
      : this.readiness.buildSnapshot(this.readinessInput(input));
    const queue = this.queue.listTickets({
      status: input.status || undefined,
    });
    const requests = this.executor.listRequests(input.limit || 20);
    const summary = {
      visibleCatalogItems: hub.summary.visible,
      totalCatalogItems: hub.summary.total,
      packs: packs.summary.visible,
      packItems: packs.summary.manifestItems,
      openTickets: queue.summary.open,
      readyTickets: queue.summary.readyForOwner,
      activationRequests: requests.summary.totalRequests,
      readinessReady: readiness?.summary.ready || 0,
      readinessBlocked: readiness?.summary.blocked || 0,
    };

    return {
      contractVersion: CAPABILITY_CONSOLE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      view,
      policy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        singleUserSurface: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        ownerApprovalBeforeLive: true,
        externalRootsAllowed: false,
      },
      summary,
      hub,
      packs,
      readiness,
      queue,
      requests,
      commandHints: this.commandHints(input),
      approvalSurface: {
        diffPreviewSupported: true,
        runObservatoryCommand: 'zavorth observatory --json',
        approveApplyInstruction: 'Revise a Previa de alteracao e peça ao Zavorth: aplicar rascunho <planId>.',
        rollbackInstruction: 'Depois do apply, use o rollback artifact apontado no Run Observatory.',
      },
      narrative: this.narrative(view, summary),
    };
  }

  public renderConsole(input: CapabilityConsoleInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Capability Console',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Catalogo: ${snapshot.summary.visibleCatalogItems}/${snapshot.summary.totalCatalogItems} itens visiveis`,
      `Packs: ${snapshot.summary.packs} pack(s), ${snapshot.summary.packItems} item(s) declarativo(s)`,
      `Tickets: ${snapshot.summary.openTickets} aberto(s), ${snapshot.summary.readyTickets} pronto(s)`,
      `Pedidos: ${snapshot.summary.activationRequests} pedido(s) de ativacao controlada`,
    ];

    if (snapshot.readiness) {
      lines.push(`Readiness: ${snapshot.summary.readinessReady} pronto(s), ${snapshot.summary.readinessBlocked} bloqueado(s)`);
    }

    if (snapshot.view === 'catalog' || snapshot.view === 'overview') {
      lines.push('', 'Destaques:');
      for (const item of snapshot.hub.featured.slice(0, 6)) {
        lines.push(`- ${item.kind}:${item.id} ${item.label} | ${item.readiness}`);
      }
    }

    if (snapshot.view === 'packs' || snapshot.view === 'overview') {
      lines.push('', 'Packs:');
      for (const pack of snapshot.packs.packs.slice(0, 6)) {
        lines.push(`- ${pack.id}: ${pack.label} (${pack.manifest.items.length} itens)`);
      }
    }

    if ((snapshot.view === 'readiness' || snapshot.view === 'overview') && snapshot.readiness) {
      lines.push('', 'Readiness pendente:');
      for (const item of snapshot.readiness.items.filter((entry) => entry.status !== 'ready_for_activation_request').slice(0, 6)) {
        lines.push(`- ${item.itemId}: ${item.status} | ${item.nextAction}`);
      }
    }

    if (snapshot.view === 'queue' || snapshot.view === 'overview') {
      lines.push('', 'Tickets:');
      if (snapshot.queue.tickets.length === 0) {
        lines.push('- Nenhum ticket na visao atual.');
      }
      for (const ticket of snapshot.queue.tickets.slice(0, 6)) {
        lines.push(`- ${ticket.id}: ${ticket.status} | ${ticket.targetItemId || 'sem alvo'}`);
      }
    }

    if (snapshot.view === 'requests' || snapshot.view === 'overview') {
      lines.push('', 'Pedidos recentes:');
      if (snapshot.requests.requests.length === 0) {
        lines.push('- Nenhum pedido criado ainda.');
      }
      for (const request of snapshot.requests.requests.slice(0, 6)) {
        lines.push(`- ${request.id}: ${request.targetItemId || 'sem alvo'} | ticket=${request.ticketId}`);
      }
    }

    lines.push('', 'Preview e approval:');
    lines.push(`- Run Observatory: ${snapshot.approvalSurface.runObservatoryCommand}`);
    lines.push(`- Aplicar: ${snapshot.approvalSurface.approveApplyInstruction}`);
    lines.push(`- Rollback: ${snapshot.approvalSurface.rollbackInstruction}`);

    lines.push('', 'Comandos uteis:');
    for (const hint of snapshot.commandHints) {
      lines.push(`- ${hint.label}: ${hint.command}`);
    }
    lines.push('', `Proximo: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private readinessInput(input: CapabilityConsoleInput): CapabilityPackReadinessInput {
    return {
      packId: input.packId || null,
      targetItemId: input.targetItemId || null,
      availableSecretRefs: input.availableSecretRefs,
      availableEnvKeys: input.availableEnvKeys,
      availableBinaries: input.availableBinaries,
      completedManualSteps: input.completedManualSteps,
      completedReadinessChecks: input.completedReadinessChecks,
      localRoutes: input.localRoutes,
    };
  }

  private commandHints(input: CapabilityConsoleInput): CapabilityConsoleCommandHint[] {
    const pack = input.packId ? ` --pack ${this.quote(input.packId)}` : '';
    const target = input.targetItemId ? ` --target ${this.quote(input.targetItemId)}` : '';
    return [
      {
        id: 'setup-guide',
        label: 'Configurar com linguagem simples',
        command: `npm run capability-setup-guide --${pack}${target}`.trim(),
        destructive: false,
        requiresOwnerApproval: false,
      },
      {
        id: 'setup-queue',
        label: 'Ver fila de configuracao',
        command: 'npm run capability-setup-queue -- --status open',
        destructive: false,
        requiresOwnerApproval: false,
      },
      {
        id: 'setup-executor',
        label: 'Criar pedido controlado',
        command: 'npm run capability-setup-executor -- --ticket <ticket-id> --owner-approval-id <approval-id> --confirm-owner-controlled-activation',
        destructive: false,
        requiresOwnerApproval: true,
      },
    ];
  }

  private narrative(
    view: CapabilityConsoleView,
    summary: CapabilityConsoleSnapshot['summary'],
  ): CapabilityConsoleSnapshot['narrative'] {
    if (summary.readyTickets > 0) {
      return {
        headline: tService('console.ready_tickets', { count: String(summary.readyTickets) }),
        operatorSummary: tService('console.ready_operator_summary'),
        nextAction: tService('console.ready_next_action'),
      };
    }
    if (summary.openTickets > 0) {
      return {
        headline: tService('console.open_tickets', { count: String(summary.openTickets) }),
        operatorSummary: tService('console.continue_pending_steps'),
        nextAction: tService('console.open_next_action'),
      };
    }
    return {
      headline: tService('console.idle_headline', { view }),
      operatorSummary: tService('console.idle_operator_summary'),
      nextAction: tService('console.idle_next_action'),
    };
  }

  private quote(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
}
