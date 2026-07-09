import { randomUUID } from 'crypto';
import type {
  AgentMeshExecutionRequest,
  AgentMeshExecutionReceipt,
  AgentMeshExecutionStatus,
  AgentMeshToolCallRecord,
} from '../contracts/AgentMeshExecutionContract.js';
import type { AgentMeshPolicyDecision } from '../contracts/AgentMeshConsentContract.js';
import type { AgentMeshOrchestrationService } from './AgentMeshOrchestrationService.js';
import type { AgentMeshLedgerService } from './AgentMeshLedgerService.js';
import { AgentMeshPolicyService } from './AgentMeshPolicyService.js';
import {
  AgentMeshDriverRegistryService,
  AgentMeshDriverUnavailableException,
} from './AgentMeshDriverRegistryService.js';
import { sanitizeAgentMeshText } from './AgentMeshRedactionService.js';

export class ConsentRequiredException extends Error {
  constructor(agentId: string) {
    super(`Execution blocked: Consent is required but not granted for Agent ID: ${agentId}`);
    this.name = 'ConsentRequiredException';
  }
}

export class SandboxViolationException extends Error {
  constructor(message: string) {
    super(`Execution blocked by Sandbox Policy: ${message}`);
    this.name = 'SandboxViolationException';
  }
}

export class AgentMeshExecutionService {
  private readonly orchestrationService: AgentMeshOrchestrationService;
  private readonly ledgerService: AgentMeshLedgerService;
  private readonly policy: AgentMeshPolicyService;
  private readonly driverRegistry: AgentMeshDriverRegistryService;

  constructor(options: {
    orchestrationService: AgentMeshOrchestrationService;
    ledgerService: AgentMeshLedgerService;
    policy?: AgentMeshPolicyService;
    driverRegistry?: AgentMeshDriverRegistryService;
  }) {
    this.orchestrationService = options.orchestrationService;
    this.ledgerService = options.ledgerService;
    this.policy = options.policy || new AgentMeshPolicyService();
    this.driverRegistry = options.driverRegistry || new AgentMeshDriverRegistryService();
  }

  public async execute(request: AgentMeshExecutionRequest): Promise<AgentMeshExecutionReceipt> {
    const startTime = Date.now();
    const receiptId = `receipt-${randomUUID()}`;
    const toolCallRecords: AgentMeshToolCallRecord[] = [];
    let finalStatus: AgentMeshExecutionStatus = 'failed_execution';
    let finalSummary = 'Execution failed.';
    const sandboxViolations: string[] = [];
    const budgetViolations: string[] = [];
    let driverProtocol: string | null = null;
    let policyDecision: AgentMeshPolicyDecision = {
      decision: 'blocked',
      reasons: ['Execution was not evaluated.'],
      requiredPermissions: [],
      deniedPermissions: [],
      criticalPermissions: [],
    };

    try {
      const consent = this.orchestrationService.getConsent(request.targetBridgeId);
      const bridge = this.orchestrationService.getBridge(request.targetBridgeId);
      driverProtocol = bridge?.primaryProtocol || null;
      policyDecision = this.policy.evaluateExecution({ request, consent });

      if (!this.orchestrationService.isAuthorized(request.targetBridgeId)) {
        finalStatus = 'blocked_missing_consent';
        finalSummary = 'Execution blocked due to missing, expired or revoked consent.';
        throw new ConsentRequiredException(request.targetBridgeId);
      }

      if (policyDecision.decision === 'blocked') {
        finalStatus = 'blocked_by_policy';
        finalSummary = 'Execution blocked by Agent Mesh policy.';
        throw new SandboxViolationException(policyDecision.reasons.join(' '));
      }

      this.validateSandboxPolicyBeforeExecution(request);

      const plannedToolCalls = (request.sandbox.enforceDryRunFirstIfSupported ? 1 : 0)
        + (request.isDryRunPreview ? 0 : 1);
      if (plannedToolCalls > request.budget.maxToolCalls) {
        finalStatus = 'interrupted_budget_exceeded';
        finalSummary = 'Execution interrupted because it exceeded the tool-call budget.';
        budgetViolations.push(`Exceeded maxToolCalls: ${request.budget.maxToolCalls}`);
      } else if (request.sandbox.enforceDryRunFirstIfSupported) {
        toolCallRecords.push({
          toolName: 'system_dry_run_preview',
          durationMs: 50,
          sandboxVerdict: 'simulated_dry_run',
        });
      }

      if (finalStatus === 'interrupted_budget_exceeded') {
        // Receipt is emitted below.
      } else if (request.isDryRunPreview) {
        finalStatus = 'completed_successfully';
        finalSummary = 'Dry-run preview completed successfully. No side effects were applied.';
      } else {
        const context = await this.orchestrationService.buildDriverContext(request.targetBridgeId);
        if (!context || !this.driverRegistry.has(context.protocol)) {
          finalStatus = 'failed_driver_unavailable';
          finalSummary = 'No available Agent Mesh protocol driver could execute this bridge.';
          throw new AgentMeshDriverUnavailableException(finalSummary);
        } else {
          this.validateDriverPolicyBeforeExecution(request, context.connectionValue);
          const driverResult = await this.driverRegistry.execute(context, request);
          const driverToolCalls = Math.max(1, driverResult.toolCallsMade);
          if (driverToolCalls > request.budget.maxToolCalls) {
            finalStatus = 'interrupted_budget_exceeded';
            finalSummary = 'Execution interrupted because the driver exceeded the tool-call budget.';
            budgetViolations.push(`Driver reported ${driverToolCalls} tool calls; maxToolCalls is ${request.budget.maxToolCalls}.`);
          } else {
            for (let index = 0; index < driverToolCalls; index += 1) {
              toolCallRecords.push({
                toolName: index === 0 ? 'runtime_adapter_driver_action' : `runtime_adapter_driver_action_${index + 1}`,
                durationMs: Math.max(1, Math.floor((Date.now() - startTime) / driverToolCalls)),
                sandboxVerdict: 'allowed',
              });
            }
            finalStatus = driverResult.partial ? 'completed_partially' : 'completed_successfully';
            finalSummary = driverResult.summary;
          }
        }
      }
    } catch (error: any) {
      if (error instanceof AgentMeshDriverUnavailableException) {
        finalStatus = 'failed_driver_unavailable';
        finalSummary = sanitizeReceiptText(error.message);
      } else if (isTimeoutLikeDriverError(error)) {
        finalStatus = 'interrupted_timeout';
        finalSummary = 'Execution was interrupted because the protocol driver exceeded the time budget.';
        budgetViolations.push(`Exceeded maxExecutionTimeMs: ${request.budget.maxExecutionTimeMs}`);
      } else if (error instanceof ConsentRequiredException) {
        finalStatus = 'blocked_missing_consent';
      } else if (error instanceof SandboxViolationException) {
        if (finalStatus !== 'blocked_by_policy') {
          finalStatus = 'blocked_by_sandbox';
        }
        sandboxViolations.push(sanitizeReceiptText(error.message));
      } else {
        finalStatus = 'failed_execution';
      }
      finalSummary = sanitizeReceiptText(error instanceof Error ? error.message : String(error));
    }

    const receipt: AgentMeshExecutionReceipt = {
      id: receiptId,
      executionRequestId: request.id,
      bridgeId: request.targetBridgeId,
      timestamp: new Date().toISOString(),
      traceId: cleanNullable(request.traceId),
      sessionId: cleanNullable(request.sessionId),
      requestedBy: cleanText(request.requestedBy, 'unknown-requester'),
      surface: cleanText(request.surface, 'agent-mesh'),
      status: finalStatus,
      policyDecision,
      metrics: {
        totalDurationMs: Date.now() - startTime,
        toolCallsMade: toolCallRecords.length,
      },
      toolCallRecords,
      finalResponseSummary: sanitizeReceiptText(finalSummary),
      sandboxViolations: sandboxViolations.map(sanitizeReceiptText),
      budgetViolations: budgetViolations.map(sanitizeReceiptText),
      requiredPermissions: policyDecision.requiredPermissions.slice(),
      redactionApplied: true,
      driverProtocol,
    };

    this.ledgerService.recordReceipt(receipt);

    return receipt;
  }

  private validateSandboxPolicyBeforeExecution(request: AgentMeshExecutionRequest): void {
    if (request.sandbox.noSecretSerialization !== true) {
      throw new SandboxViolationException('Policy MUST enforce noSecretSerialization.');
    }
    if (!request.sandbox.allowNetworkAccess && request.sandbox.allowedNetworkDomains.length > 0) {
      throw new SandboxViolationException('Network access is disabled but domains were requested.');
    }
    if (!request.sandbox.allowFileSystemWrites && request.sandbox.allowedWritePaths.length > 0) {
      throw new SandboxViolationException('Filesystem writes are disabled but write paths were requested.');
    }
    if (request.sandbox.allowFileSystemWrites && request.sandbox.allowedWritePaths.length === 0) {
      throw new SandboxViolationException('Filesystem writes require explicit allowedWritePaths.');
    }
    if (request.budget.maxExecutionTimeMs <= 0) {
      throw new SandboxViolationException('Execution budget requires maxExecutionTimeMs greater than zero.');
    }
    if (request.budget.maxToolCalls < 0) {
      throw new SandboxViolationException('Execution budget requires maxToolCalls to be zero or greater.');
    }
    for (const [name, ref] of Object.entries(request.secretRefs || {})) {
      if (!/^secret-ref:[a-z0-9_.:-]+$/i.test(ref)) {
        throw new SandboxViolationException(`Invalid secret ref for ${name}.`);
      }
    }
  }

  private validateDriverPolicyBeforeExecution(
    request: AgentMeshExecutionRequest,
    connectionValue: string | null,
  ): void {
    if (!connectionValue || !/^https?:\/\//i.test(connectionValue)) {
      return;
    }
    if (!request.sandbox.allowNetworkAccess) {
      throw new SandboxViolationException('Protocol driver requires network access but sandbox disabled it.');
    }
    const host = new URL(connectionValue).hostname.toLowerCase();
    const allowed = request.sandbox.allowedNetworkDomains.map((domain) => domain.toLowerCase());
    if (allowed.length > 0 && !allowed.includes(host)) {
      throw new SandboxViolationException(`Protocol driver host ${host} is not in allowedNetworkDomains.`);
    }
  }
}

export function sanitizeReceiptText(value: unknown): string {
  return sanitizeAgentMeshText(value);
}

function isTimeoutLikeDriverError(error: unknown): boolean {
  return error instanceof Error && /timed out|timeout|exceeded/i.test(error.message);
}

function cleanText(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cleanNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
