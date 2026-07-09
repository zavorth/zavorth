import { config } from '../../config/index.js';
import type { SystemOverlordActionRecord } from '../../contracts/SystemOverlordContract.js';
import { logger } from '../../logger.js';
import type {
ExecuteSmokeAction,
  ExecuteSmokeActionInput,
  SmokeGatewayLike,
  SystemOverlordSmokeCapability,
  SystemOverlordSmokeItem,
} from './smokeTypes.js';

export function createSmokeActionExecutor(gateway: SmokeGatewayLike): ExecuteSmokeAction {
  return async (input: ExecuteSmokeActionInput): Promise<SystemOverlordActionRecord> => {
    return await gateway.execute({
      capability: input.capability,
      profile: input.profile,
      autonomyLevel: input.autonomyLevel,
      approved: input.approved,
      dryRun: false,
      timeoutMs: input.timeoutMs,
      objective: input.objective,
      command: input.command,
      requestedBy: 'system-overlord-smoke',
      surface: 'ops-smoke',
      workspace: config.projectRoot,
      metadata: {
        smoke: true,
      },
    });
  };
}

export function failFromSmokeAction(
  capability: SystemOverlordSmokeCapability,
  action: SystemOverlordActionRecord,
  summary: string,
): SystemOverlordSmokeItem {
  return {
    capability,
    status: 'failed',
    actionId: action.actionId,
    runtimeTarget: action.decision.runtimeTarget,
    summary,
    detail: String(action.stderr || action.stdout || '').trim() || null,
    error: action.errorMessage || action.errorCode || action.status,
    operatorNextStep: 'Revise o ledger do System Overlord e a policy/capability deste runtime antes de usar essa superficie em producao.',
  };
}

export function skipFromSmokeAction(
  capability: SystemOverlordSmokeCapability,
  action: SystemOverlordActionRecord,
  summary: string,
  operatorNextStep: string,
): SystemOverlordSmokeItem {
  return {
    capability,
    status: 'skipped',
    actionId: action.actionId,
    runtimeTarget: action.decision.runtimeTarget,
    summary,
    detail: String(action.stderr || action.stdout || '').trim() || null,
    error: action.errorMessage || null,
    operatorNextStep,
  };
}

export function shouldSkipOptionalSmokeRuntime(
  capability: SystemOverlordSmokeCapability,
  action: SystemOverlordActionRecord,
): boolean {
  const message = `${action.errorCode || ''} ${action.errorMessage || ''} ${action.stderr || ''}`.toLowerCase();
  if (capability === 'wsl.exec') {
    return action.errorCode === 'wsl_windows_required'
      || action.errorCode === 'spawn_failed'
      || /wsl/i.test(message)
      || /there is no distribution/i.test(message)
      || /windows subsystem for linux has no installed distributions/i.test(message);
  }
  if (capability === 'docker.exec') {
    return action.errorCode === 'spawn_failed'
      || /docker daemon/i.test(message)
      || /error during connect/i.test(message)
      || /is the docker daemon running/i.test(message)
      || /the system cannot find the file specified/i.test(message)
      || /cannot connect/i.test(message);
  }
  return false;
}

export function readSmokeStringArrayMetadata(
  action: SystemOverlordActionRecord,
  field: string,
): string[] {
  const value = action.metadata?.[field];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

export function parseSmokeJson(rawValue: string | null): Record<string, unknown> | null {
  const normalized = String(rawValue || '').trim();
  if (!normalized) {
    return null;
  }
  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch (error: unknown) {logger.warn('[smoke Actions] JSON parse failed', error); return null; }
}
