import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION,
  type CapabilitySetupQueueCreateInput,
  type CapabilitySetupQueueEventAction,
  type CapabilitySetupQueueInputState,
  type CapabilitySetupQueuePriority,
  type CapabilitySetupQueueReceipt,
  type CapabilitySetupQueueSnapshot,
  type CapabilitySetupQueueTicket,
  type CapabilitySetupQueueTicketStatus,
  type CapabilitySetupQueueUpdateInput,
} from '../contracts/CapabilitySetupQueueContract.js';
import type {
  CapabilitySetupConversationInput,
  CapabilitySetupConversationSnapshot,
} from '../contracts/CapabilitySetupConversationContract.js';
import {
  ZavorthCapabilitySetupConversationService,
  type ZavorthCapabilitySetupConversationRuntime,
} from './ZavorthCapabilitySetupConversationService.js';

export type ZavorthCapabilitySetupQueueRuntime =
  ZavorthCapabilitySetupConversationRuntime
  & {
    rootDir?: string;
    statePath?: string;
    ledgerPath?: string;
  };

type QueueFile = {
  contractVersion: typeof CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION;
  updatedAt: string;
  tickets: CapabilitySetupQueueTicket[];
};

const SECRET_PATTERNS: RegExp[] = [
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{12,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi,
];

const SAFE_SECRET_PLACEHOLDER = '[SECRET_REF_PRESENT]';

export class ZavorthCapabilitySetupQueueService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly statePath: string;
  private readonly ledgerPath: string;
  private readonly conversation: ZavorthCapabilitySetupConversationService;

  constructor(runtime: ZavorthCapabilitySetupQueueRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.statePath = this.resolveInsideRoot(runtime.statePath || path.join(this.rootDir, 'data', 'capability-setup-queue.json'));
    this.ledgerPath = this.resolveInsideRoot(runtime.ledgerPath || path.join(this.rootDir, 'data', 'capability-setup-queue-ledger.jsonl'));
    this.conversation = new ZavorthCapabilitySetupConversationService(runtime);
  }

  public createTicket(input: CapabilitySetupQueueCreateInput = {}): CapabilitySetupQueueTicket {
    const createdAt = this.now().toISOString();
    const conversationSnapshot = this.conversation.buildSnapshot(input);
    const inputState = this.toInputState(input, conversationSnapshot);
    const id = input.ticketId?.trim() || this.buildTicketId(inputState, createdAt);
    const baseTicket = this.toTicket({
      id,
      createdAt,
      updatedAt: createdAt,
      priority: input.priority || 'normal',
      inputState,
      conversationSnapshot,
      previousEvents: [],
    });
    const receipt = this.buildReceipt(baseTicket.id, 'ticket-created', input.actorLabel || null, `Ticket created for ${baseTicket.targetItemId || baseTicket.packId || 'capability setup'}.`);
    const ticket = {
      ...baseTicket,
      events: [receipt],
    };
    const state = this.readState();
    const existing = state.tickets.findIndex((candidate) => candidate.id === ticket.id);
    if (existing >= 0) {
      throw new Error(`Capability setup ticket already exists: ${ticket.id}`);
    }
    state.tickets.push(ticket);
    this.writeState(state.tickets);
    this.appendLedger(receipt);
    return ticket;
  }

  public updateTicket(input: CapabilitySetupQueueUpdateInput): CapabilitySetupQueueTicket {
    const state = this.readState();
    const index = state.tickets.findIndex((ticket) => ticket.id === input.ticketId);
    if (index < 0) {
      throw new Error(`Capability setup ticket not found: ${input.ticketId}`);
    }

    const previous = state.tickets[index];
    const updatedInputState = this.applyUpdate(previous.inputState, input);
    const previousEvents = previous.events;
    const updatedAt = this.now().toISOString();
    const conversationSnapshot = input.action === 'reject' || input.action === 'archive' || input.action === 'approve'
      ? null
      : this.conversation.buildSnapshot(this.toConversationInput(updatedInputState));
    const action = this.toEventAction(input.action);
    const receipt = this.buildReceipt(previous.id, action, input.actorLabel || previous.actorLabel, this.eventSummary(action, input));
    const ticket = conversationSnapshot
      ? this.toTicket({
        id: previous.id,
        createdAt: previous.createdAt,
        updatedAt,
        priority: previous.priority,
        inputState: updatedInputState,
        conversationSnapshot,
        previousEvents: [...previousEvents, receipt],
      })
      : {
        ...previous,
        updatedAt,
        status: this.closedStatusForAction(input.action),
        inputState: updatedInputState,
        events: [...previousEvents, receipt],
      };

    state.tickets[index] = ticket;
    this.writeState(state.tickets);
    this.appendLedger(receipt);
    return ticket;
  }

  public listTickets(filter: { status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed' } = {}): CapabilitySetupQueueSnapshot {
    const state = this.readState();
    const tickets = state.tickets.filter((ticket) => this.matchesFilter(ticket, filter.status));
    return this.toSnapshot(tickets);
  }

  public getTicket(ticketId: string): CapabilitySetupQueueTicket | null {
    const state = this.readState();
    return state.tickets.find((ticket) => ticket.id === ticketId) || null;
  }

  public renderReport(filter: { status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed' } = {}): string {
    const snapshot = this.listTickets(filter);
    const lines = [
      snapshot.narrative.headline,
      `Total: ${snapshot.summary.total} | Abertos: ${snapshot.summary.open} | Prontos: ${snapshot.summary.readyForOwner} | Fechados: ${snapshot.summary.closed}`,
      '',
    ];
    if (snapshot.tickets.length === 0) {
      lines.push('There is no tickets de setup nessa visao.');
    }
    for (const ticket of snapshot.tickets) {
      lines.push(`- ${ticket.id} [${ticket.status}] ${ticket.headline}`);
      lines.push(`  proximo: ${ticket.nextQuestion}`);
      lines.push(`  recurso: ${ticket.targetItemId || 'nao escolhido'} | pacote: ${ticket.packId || 'sem pacote'}`);
    }
    lines.push('', snapshot.narrative.nextAction);
    return lines.join('\n');
  }

  public getStoragePaths(): { statePath: string; ledgerPath: string } {
    return {
      statePath: this.statePath,
      ledgerPath: this.ledgerPath,
    };
  }

  private toTicket(input: {
    id: string;
    createdAt: string;
    updatedAt: string;
    priority: CapabilitySetupQueuePriority;
    inputState: CapabilitySetupQueueInputState;
    conversationSnapshot: CapabilitySetupConversationSnapshot;
    previousEvents: CapabilitySetupQueueReceipt[];
  }): CapabilitySetupQueueTicket {
    return {
      id: input.id,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      priority: input.priority,
      status: input.conversationSnapshot.status,
      conversationStatus: input.conversationSnapshot.status,
      packId: input.conversationSnapshot.request.packId,
      targetItemId: input.conversationSnapshot.request.targetItemId,
      actorLabel: input.inputState.actorLabel,
      audience: input.conversationSnapshot.audience,
      redactedText: input.conversationSnapshot.request.redactedText,
      headline: input.conversationSnapshot.reply.headline,
      nextQuestion: input.conversationSnapshot.reply.nextQuestion,
      tasks: input.conversationSnapshot.tasks,
      secureRequests: input.conversationSnapshot.secureRequests,
      approvalId: input.conversationSnapshot.flowSnapshot.activation.approvalId,
      flowStatus: input.conversationSnapshot.flowSnapshot.status,
      flowReceiptIds: input.conversationSnapshot.flowSnapshot.receipts.map((receipt) => receipt.id),
      inputState: input.inputState,
      events: input.previousEvents,
      safety: {
        persistentQueue: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        ownerApprovalBeforeLive: true,
      },
    };
  }

  private toSnapshot(tickets: CapabilitySetupQueueTicket[]): CapabilitySetupQueueSnapshot {
    const closedStatuses: CapabilitySetupQueueTicketStatus[] = ['approved', 'rejected', 'archived'];
    const summary = {
      total: tickets.length,
      open: tickets.filter((ticket) => !closedStatuses.includes(ticket.status)).length,
      waitingSecrets: tickets.filter((ticket) => ticket.status === 'needs_secret').length,
      waitingReadiness: tickets.filter((ticket) => ticket.status === 'needs_readiness').length,
      waitingApproval: tickets.filter((ticket) => ticket.status === 'needs_approval').length,
      readyForOwner: tickets.filter((ticket) => ticket.status === 'ready_for_owner').length,
      closed: tickets.filter((ticket) => closedStatuses.includes(ticket.status)).length,
    };
    return {
      contractVersion: CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: {
        persistentQueue: true,
        appendOnlyLedger: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        ownerApprovalBeforeLive: true,
        statePath: this.statePath,
        ledgerPath: this.ledgerPath,
      },
      summary,
      tickets,
      narrative: {
        headline: 'Fila de configuracao do Zavorth Capability Hub',
        nextAction: summary.open > 0
          ? 'Continue o primeiro ticket aberto ou filtre pelo status que precisa de atencao.'
          : 'Crie um novo ticket quando quiser configurar outro recurso.',
      },
    };
  }

  private toInputState(
    input: CapabilitySetupQueueCreateInput,
    conversationSnapshot: CapabilitySetupConversationSnapshot,
  ): CapabilitySetupQueueInputState {
    const availableSecretRefs = this.unique(input.availableSecretRefs || []);
    const providedSecretRefs = this.unique([
      ...Object.keys(input.providedSecrets || {}),
      ...availableSecretRefs,
    ]);
    return {
      text: conversationSnapshot.request.redactedText || (input.text ? this.redact(input.text) : null),
      packId: input.packId || conversationSnapshot.request.packId,
      targetItemId: input.targetItemId || conversationSnapshot.request.targetItemId,
      actorLabel: input.actorLabel ? this.redact(input.actorLabel) : null,
      audience: input.audience || 'everyday',
      approvalId: input.approvalId || null,
      providedSecretRefs,
      availableSecretRefs,
      availableEnvKeys: this.unique(input.availableEnvKeys || []),
      availableBinaries: this.unique(input.availableBinaries || []),
      completedManualSteps: this.unique(input.completedManualSteps || []),
      completedReadinessChecks: this.unique(input.completedReadinessChecks || []),
      localRoutes: input.localRoutes || {},
    };
  }

  private toConversationInput(inputState: CapabilitySetupQueueInputState): CapabilitySetupConversationInput {
    const providedSecrets = inputState.providedSecretRefs.reduce<Record<string, string>>((acc, ref) => {
      acc[ref] = SAFE_SECRET_PLACEHOLDER;
      return acc;
    }, {});
    return {
      text: inputState.text,
      packId: inputState.packId,
      targetItemId: inputState.targetItemId,
      actorLabel: inputState.actorLabel,
      audience: inputState.audience,
      approvalId: inputState.approvalId,
      providedSecrets,
      availableSecretRefs: inputState.availableSecretRefs,
      availableEnvKeys: inputState.availableEnvKeys,
      availableBinaries: inputState.availableBinaries,
      completedManualSteps: inputState.completedManualSteps,
      completedReadinessChecks: inputState.completedReadinessChecks,
      localRoutes: inputState.localRoutes,
    };
  }

  private applyUpdate(
    previous: CapabilitySetupQueueInputState,
    input: CapabilitySetupQueueUpdateInput,
  ): CapabilitySetupQueueInputState {
    const next: CapabilitySetupQueueInputState = {
      ...previous,
      actorLabel: input.actorLabel ? this.redact(input.actorLabel) : previous.actorLabel,
      availableSecretRefs: [...previous.availableSecretRefs],
      providedSecretRefs: [...previous.providedSecretRefs],
      completedManualSteps: [...previous.completedManualSteps],
      completedReadinessChecks: [...previous.completedReadinessChecks],
      localRoutes: { ...previous.localRoutes },
    };
    if (input.action === 'attach-secret-ref' && input.secretRef) {
      next.availableSecretRefs = this.unique([...next.availableSecretRefs, input.secretRef]);
      next.providedSecretRefs = this.unique([...next.providedSecretRefs, input.secretRef]);
    }
    if (input.action === 'complete-manual-step' && input.manualStep) {
      next.completedManualSteps = this.unique([...next.completedManualSteps, input.manualStep]);
    }
    if (input.action === 'complete-readiness-check' && input.readinessCheck) {
      next.completedReadinessChecks = this.unique([...next.completedReadinessChecks, input.readinessCheck]);
    }
    if (input.action === 'attach-approval' && input.approvalId) {
      next.approvalId = input.approvalId;
    }
    if (input.action === 'approve' && input.approvalId) {
      next.approvalId = input.approvalId;
    }
    return next;
  }

  private readState(): QueueFile {
    if (!fs.existsSync(this.statePath)) {
      return {
        contractVersion: CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION,
        updatedAt: this.now().toISOString(),
        tickets: [],
      };
    }
    const parsed = JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as QueueFile;
    return {
      contractVersion: CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION,
      updatedAt: parsed.updatedAt || this.now().toISOString(),
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
    };
  }

  private writeState(tickets: CapabilitySetupQueueTicket[]): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    const payload: QueueFile = {
      contractVersion: CAPABILITY_SETUP_QUEUE_CONTRACT_VERSION,
      updatedAt: this.now().toISOString(),
      tickets,
    };
    const serialized = JSON.stringify(payload, null, 2);
    fs.writeFileSync(this.statePath, `${serialized}\n`, 'utf8');
  }

  private appendLedger(receipt: CapabilitySetupQueueReceipt): void {
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    fs.appendFileSync(this.ledgerPath, `${JSON.stringify(receipt)}\n`, 'utf8');
  }

  private buildReceipt(
    ticketId: string,
    action: CapabilitySetupQueueEventAction,
    actorLabel: string | null,
    summary: string,
  ): CapabilitySetupQueueReceipt {
    return {
      id: `receipt-${this.hash(`${ticketId}:${action}:${this.now().toISOString()}:${summary}`).slice(0, 16)}`,
      ticketId,
      action,
      at: this.now().toISOString(),
      actorLabel: actorLabel ? this.redact(actorLabel) : null,
      summary: this.redact(summary),
    };
  }

  private buildTicketId(inputState: CapabilitySetupQueueInputState, createdAt: string): string {
    const seed = `${inputState.packId || 'pack'}:${inputState.targetItemId || 'target'}:${createdAt}`;
    return `setup-${this.hash(seed).slice(0, 12)}`;
  }

  private eventSummary(action: CapabilitySetupQueueEventAction, input: CapabilitySetupQueueUpdateInput): string {
    if (action === 'secret-ref-attached') {
      return `Secret reference attached: ${input.secretRef || 'unknown ref'}.`;
    }
    if (action === 'manual-step-completed') {
      return `Manual step completed: ${input.manualStep || 'unknown step'}.`;
    }
    if (action === 'readiness-check-completed') {
      return `Readiness check completed: ${input.readinessCheck || 'unknown check'}.`;
    }
    if (action === 'approval-attached') {
      return `Owner approval attached: ${input.approvalId || 'approval ref'}.`;
    }
    if (action === 'approved') {
      return `Ticket approved for controlled activation: ${input.approvalId || 'approval ref'}.`;
    }
    if (action === 'rejected') {
      return `Ticket rejected: ${input.reason || 'no reason provided'}.`;
    }
    if (action === 'archived') {
      return `Ticket archived: ${input.reason || 'no reason provided'}.`;
    }
    return 'Ticket refreshed.';
  }

  private toEventAction(action: CapabilitySetupQueueUpdateInput['action']): CapabilitySetupQueueEventAction {
    const mapping: Record<CapabilitySetupQueueUpdateInput['action'], CapabilitySetupQueueEventAction> = {
      refresh: 'refreshed',
      'attach-secret-ref': 'secret-ref-attached',
      'complete-manual-step': 'manual-step-completed',
      'complete-readiness-check': 'readiness-check-completed',
      'attach-approval': 'approval-attached',
      approve: 'approved',
      reject: 'rejected',
      archive: 'archived',
    };
    return mapping[action];
  }

  private closedStatusForAction(action: CapabilitySetupQueueUpdateInput['action']): 'approved' | 'rejected' | 'archived' {
    if (action === 'approve') {
      return 'approved';
    }
    if (action === 'reject') {
      return 'rejected';
    }
    return 'archived';
  }

  private matchesFilter(
    ticket: CapabilitySetupQueueTicket,
    status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed',
  ): boolean {
    if (!status) {
      return true;
    }
    if (status === 'closed') {
      return ticket.status === 'approved' || ticket.status === 'rejected' || ticket.status === 'archived';
    }
    if (status === 'open') {
      return ticket.status !== 'approved' && ticket.status !== 'rejected' && ticket.status !== 'archived';
    }
    return ticket.status === status;
  }

  private resolveInsideRoot(candidate: string): string {
    const absolute = path.resolve(candidate);
    const relative = path.relative(this.rootDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Capability setup queue path must stay inside Zavorth root: ${candidate}`);
    }
    return absolute;
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private redact(value: string): string {
    return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, (...args: unknown[]) => {
      const match = String(args[0] || '');
      const captured = args.length > 3 && typeof args[1] === 'string' ? args[1] : null;
      if (captured) {
        return match.replace(captured, '[SECRET_REDACTED]');
      }
      return '[SECRET_REDACTED]';
    }), value);
  }
}
