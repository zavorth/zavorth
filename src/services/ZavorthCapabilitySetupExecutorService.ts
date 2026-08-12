import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION,
  type CapabilitySetupActivationRequest,
  type CapabilitySetupExecutorInput,
  type CapabilitySetupExecutorReceipt,
  type CapabilitySetupExecutorResult,
  type CapabilitySetupExecutorSnapshot,
} from '../contracts/CapabilitySetupExecutorContract.js';
import type { CapabilityActivationFlowInput } from '../contracts/CapabilityActivationFlowContract.js';
import type { CapabilitySetupQueueTicket } from '../contracts/CapabilitySetupQueueContract.js';
import { ZavorthCapabilityActivationFlowService } from './ZavorthCapabilityActivationFlowService.js';
import {
  ZavorthCapabilitySetupQueueService,
  type ZavorthCapabilitySetupQueueRuntime,
} from './ZavorthCapabilitySetupQueueService.js';

export type ZavorthCapabilitySetupExecutorRuntime =
  ZavorthCapabilitySetupQueueRuntime
  & {
    requestLedgerPath?: string;
  };

export class ZavorthCapabilitySetupExecutorService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly requestLedgerPath: string;
  private readonly queue: ZavorthCapabilitySetupQueueService;
  private readonly activationFlow: ZavorthCapabilityActivationFlowService;

  constructor(runtime: ZavorthCapabilitySetupExecutorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.requestLedgerPath = this.resolveInsideRoot(runtime.requestLedgerPath || path.join(this.rootDir, 'data', 'capability-setup-activation-requests.jsonl'));
    this.queue = new ZavorthCapabilitySetupQueueService(runtime);
    this.activationFlow = new ZavorthCapabilityActivationFlowService(runtime);
  }

  public execute(input: CapabilitySetupExecutorInput): CapabilitySetupExecutorResult {
    const ticket = this.queue.getTicket(input.ticketId);
    if (!ticket) {
      return this.result(input, null, null, this.receipt(input.ticketId, 'ticket-missing', 'Ticket was not found.'), 'ticket_missing');
    }
    if (ticket.status === 'approved' || ticket.status === 'archived' || ticket.status === 'rejected') {
      return this.result(input, ticket, null, this.receipt(ticket.id, 'already-processed', `Ticket is already ${ticket.status}.`), 'already_processed');
    }

    const approvalId = input.ownerApprovalId || ticket.approvalId;
    let readyTicket = ticket;
    if (readyTicket.status === 'needs_approval' && approvalId && input.confirmOwnerControlledActivation) {
      readyTicket = this.queue.updateTicket({
        ticketId: ticket.id,
        action: 'attach-approval',
        approvalId,
        actorLabel: input.actorLabel || ticket.actorLabel,
      });
    }

    if (readyTicket.status !== 'ready_for_owner') {
      return this.result(input, readyTicket, null, this.receipt(readyTicket.id, 'ticket-not-ready', `Ticket is ${readyTicket.status}; resolve setup before executor handoff.`), 'blocked_not_ready');
    }

    if (!approvalId || !input.confirmOwnerControlledActivation) {
      return this.result(input, readyTicket, null, this.receipt(readyTicket.id, 'owner-approval-required', 'Owner approval and explicit confirmation are required.'), 'waiting_owner_approval');
    }

    const activationRequest = this.buildActivationRequest(readyTicket, approvalId, input.actorLabel || readyTicket.actorLabel);
    const dryRun = input.dryRun !== false;
    if (dryRun) {
      return this.result(input, readyTicket, activationRequest, this.receipt(readyTicket.id, 'activation-request-planned', 'Dry-run activation request planned; queue was not consumed.'), 'dry_run_ready');
    }

    this.appendActivationRequest(activationRequest);
    const approvedTicket = this.queue.updateTicket({
      ticketId: readyTicket.id,
      action: 'approve',
      approvalId,
      actorLabel: input.actorLabel || readyTicket.actorLabel,
    });
    return this.result(input, approvedTicket, activationRequest, this.receipt(readyTicket.id, 'activation-request-created', 'Owner-controlled activation request was created.'), 'activation_request_created');
  }

  public listRequests(limit = 20): CapabilitySetupExecutorSnapshot {
    const requests = this.readActivationRequests().slice(-Math.max(1, Math.min(500, Math.floor(limit)))).reverse();
    return {
      contractVersion: CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: {
        requestLedgerAppendOnly: true,
        ownerApprovalBeforeLive: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        externalRootsAllowed: false,
        requestLedgerPath: this.requestLedgerPath,
      },
      summary: {
        totalRequests: requests.length,
        latestRequestId: requests[0]?.id || null,
      },
      requests,
    };
  }

  public renderReport(limit = 20): string {
    const snapshot = this.listRequests(limit);
    const lines = [
      'Executor governado da queue de setup',
      `requests: ${snapshot.summary.totalRequests}`,
      '',
    ];
    if (snapshot.requests.length === 0) {
      lines.push('No request de activation controlada foi created ainda.');
    }
    for (const request of snapshot.requests) {
      lines.push(`- ${request.id}: ${request.targetItemId || 'without alvo'} | ticket=${request.ticketId}`);
      lines.push(`  comando: ${request.command}`);
    }
    return lines.join('\n');
  }

  private buildActivationRequest(
    ticket: CapabilitySetupQueueTicket,
    ownerApprovalId: string,
    actorLabel: string | null,
  ): CapabilitySetupActivationRequest {
    const flowSnapshot = this.activationFlow.buildSnapshot(this.toActivationInput(ticket, ownerApprovalId));
    const createdAt = this.now().toISOString();
    const id = `cap-activation-${this.hash(`${ticket.id}:${ownerApprovalId}:${createdAt}`).slice(0, 12)}`;
    return {
      id,
      createdAt,
      ticketId: ticket.id,
      packId: ticket.packId,
      targetItemId: ticket.targetItemId,
      actorLabel,
      ownerApprovalId,
      activationFlowStatus: flowSnapshot.status,
      command: this.buildCommand(ticket, ownerApprovalId),
      queueEventIds: ticket.events.map((event) => event.id),
      flowReceiptIds: flowSnapshot.receipts.map((receipt) => receipt.id),
      gates: {
        ticketReady: true,
        ownerApprovalPresent: true,
        ownerConfirmationPresent: true,
        dryRunOnly: true,
      },
      policy: {
        ownerApprovalBeforeLive: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        externalRootsAllowed: false,
        queueConsumed: true,
      },
    };
  }

  private toActivationInput(ticket: CapabilitySetupQueueTicket, ownerApprovalId: string): CapabilityActivationFlowInput {
    const providedSecrets = ticket.inputState.providedSecretRefs.reduce<Record<string, string>>((acc, ref) => {
      acc[ref] = '[SECRET_REF_PRESENT]';
      return acc;
    }, {});
    return {
      text: ticket.redactedText,
      packId: ticket.packId,
      targetItemId: ticket.targetItemId,
      actorLabel: ticket.actorLabel,
      approvalId: ownerApprovalId,
      providedSecrets,
      availableSecretRefs: ticket.inputState.availableSecretRefs,
      availableEnvKeys: ticket.inputState.availableEnvKeys,
      availableBinaries: ticket.inputState.availableBinaries,
      completedManualSteps: ticket.inputState.completedManualSteps,
      completedReadinessChecks: ticket.inputState.completedReadinessChecks,
      localRoutes: ticket.inputState.localRoutes,
    };
  }

  private buildCommand(ticket: CapabilitySetupQueueTicket, ownerApprovalId: string): string {
    const parts = [
      'npm run capability-activation-flow --',
      ticket.packId ? `--pack ${this.quote(ticket.packId)}` : null,
      ticket.targetItemId ? `--target ${this.quote(ticket.targetItemId)}` : null,
      `--approval-id ${this.quote(ownerApprovalId)}`,
      '--json',
    ].filter(Boolean);
    return parts.join(' ');
  }

  private result(
    input: CapabilitySetupExecutorInput,
    ticket: CapabilitySetupQueueTicket | null,
    activationRequest: CapabilitySetupActivationRequest | null,
    receipt: CapabilitySetupExecutorReceipt,
    status: CapabilitySetupExecutorResult['status'],
  ): CapabilitySetupExecutorResult {
    const dryRun = input.dryRun !== false || status !== 'activation_request_created';
    return {
      contractVersion: CAPABILITY_SETUP_EXECUTOR_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status,
      dryRun,
      ticket,
      activationRequest,
      receipt,
      safety: {
        ownerApprovalBeforeLive: true,
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        externalRootsAllowed: false,
        queueExecutorOnly: true,
      },
      narrative: this.narrative(status, ticket, activationRequest),
    };
  }

  private narrative(
    status: CapabilitySetupExecutorResult['status'],
    ticket: CapabilitySetupQueueTicket | null,
    activationRequest: CapabilitySetupActivationRequest | null,
  ): CapabilitySetupExecutorResult['narrative'] {
    if (status === 'activation_request_created') {
      return {
        headline: 'request de activation controlada created.',
        nextAction: 'Review the request ledger and execute live handoff only in the appropriate runtime plan.',
      };
    }
    if (status === 'dry_run_ready') {
      return {
        headline: 'request ready em dry-run.',
        nextAction: `Para criar o request, run com --execute --owner-approval-id ${activationRequest?.ownerApprovalId || '<approval-id>'}.`,
      };
    }
    if (status === 'waiting_owner_approval') {
      return {
        headline: 'Owner approval is still missing.',
        nextAction: 'Anexe um approval id e confirme explicitmente before consumir o ticket.',
      };
    }
    if (status === 'blocked_not_ready') {
      return {
        headline: `${ticket?.id || 'Ticket'} is not ready yet.`,
        nextAction: 'Volte para capability-setup-queue ou capability-setup-guide e resolva os passos pending.',
      };
    }
    if (status === 'already_processed') {
      return {
        headline: 'Ticket already foi processado.',
        nextAction: 'Use the request ledger for replay/audit instead of consuming the same ticket again.',
      };
    }
    return {
      headline: 'Ticket not found.',
      nextAction: 'Liste a queue e escolha um ticket existente.',
    };
  }

  private receipt(
    ticketId: string,
    action: CapabilitySetupExecutorReceipt['action'],
    summary: string,
  ): CapabilitySetupExecutorReceipt {
    const at = this.now().toISOString();
    return {
      id: `executor-receipt-${this.hash(`${ticketId}:${action}:${at}`).slice(0, 16)}`,
      at,
      ticketId,
      action,
      summary,
    };
  }

  private appendActivationRequest(request: CapabilitySetupActivationRequest): void {
    fs.mkdirSync(path.dirname(this.requestLedgerPath), { recursive: true });
    fs.appendFileSync(this.requestLedgerPath, `${JSON.stringify(request)}\n`, 'utf8');
  }

  private readActivationRequests(): CapabilitySetupActivationRequest[] {
    if (!fs.existsSync(this.requestLedgerPath)) {
      return [];
    }
    return fs.readFileSync(this.requestLedgerPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as CapabilitySetupActivationRequest);
  }

  private resolveInsideRoot(candidate: string): string {
    const absolute = path.resolve(candidate);
    const relative = path.relative(this.rootDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Capability setup executor path must stay inside Zavorth root: ${candidate}`);
    }
    return absolute;
  }

  private quote(value: string): string {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
