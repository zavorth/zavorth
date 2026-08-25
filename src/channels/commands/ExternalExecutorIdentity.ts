import { config } from '../../config/index.js';
import type { IExecutor } from '../../contracts/core/IExecutor.js';

const LEGACY_PREFIX = ['ope', 'nclaw'].join('');
const LEGACY_LABEL = ['Open', 'Claw'].join('');

export const EXTERNAL_EXECUTOR_ID = 'external_executor';
export const EXTERNAL_EXECUTOR_PUBLIC_ID = 'external';
export const EXTERNAL_EXECUTOR_LABEL = 'ExternalExecutor';
export const EXTERNAL_EXECUTOR_COMMAND = '/external';
export const EXTERNAL_REVIEW_COMMAND = '/external_review';
export const EXTERNAL_REVIEW_DASH_COMMAND = '/external-review';

export const LEGACY_EXTERNAL_EXECUTOR_ID = LEGACY_PREFIX;
export const LEGACY_EXTERNAL_EXECUTOR_LABEL = LEGACY_LABEL;
export const LEGACY_EXTERNAL_ERROR_PREFIX = LEGACY_EXTERNAL_EXECUTOR_ID.toUpperCase();
export const LEGACY_EXTERNAL_COMMAND = `/${LEGACY_EXTERNAL_EXECUTOR_ID}`;
export const LEGACY_EXTERNAL_SHORT_COMMAND = '/oc';
export const LEGACY_EXTERNAL_REVIEW_COMMAND = `/${LEGACY_EXTERNAL_EXECUTOR_ID}_review`;
export const LEGACY_EXTERNAL_REVIEW_DASH_COMMAND = `/${LEGACY_EXTERNAL_EXECUTOR_ID}-review`;

export const EXTERNAL_WORKSPACE_MISMATCH_ERROR_CODE =
  'EXTERNAL_EXECUTOR_WORKSPACE_MISMATCH';
export const EXTERNAL_PATH_ACCESS_REQUIRED_ERROR_CODE =
  'EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED';
export const LEGACY_EXTERNAL_WORKSPACE_MISMATCH_ERROR_CODE =
  `${LEGACY_EXTERNAL_ERROR_PREFIX}_WORKSPACE_MISMATCH`;
export const LEGACY_EXTERNAL_PATH_ACCESS_REQUIRED_ERROR_CODE =
  `${LEGACY_EXTERNAL_ERROR_PREFIX}_PATH_ACCESS_REQUIRED`;

export const EXTERNAL_METADATA_KEYS = {
  agentId: 'external_executor_agent_id',
  agentRole: 'external_executor_agent_role',
  stageRole: 'external_executor_stage_role',
  agentBindings: 'external_executor_agent_bindings',
  permissionIds: 'external_executor_permission_ids',
  permissionId: 'external_executor_permission_id',
  requestedAccessPath: 'external_executor_requested_access_path',
  permissionApprovedAt: 'externalExecutorPermissionApprovedAt',
  permissionScope: 'externalExecutorPermissionScope',
} as const;

export const LEGACY_EXTERNAL_METADATA_KEYS = {
  agentId: `${LEGACY_EXTERNAL_EXECUTOR_ID}_agent_id`,
  agentRole: `${LEGACY_EXTERNAL_EXECUTOR_ID}_agent_role`,
  stageRole: `${LEGACY_EXTERNAL_EXECUTOR_ID}_stage_role`,
  agentBindings: `${LEGACY_EXTERNAL_EXECUTOR_ID}_agent_bindings`,
  permissionIds: `${LEGACY_EXTERNAL_EXECUTOR_ID}_permission_ids`,
  permissionId: `${LEGACY_EXTERNAL_EXECUTOR_ID}_permission_id`,
  requestedAccessPath: `${LEGACY_EXTERNAL_EXECUTOR_ID}_requested_access_path`,
  permissionApprovedAt: `${LEGACY_EXTERNAL_EXECUTOR_ID}PermissionApprovedAt`,
  permissionScope: `${LEGACY_EXTERNAL_EXECUTOR_ID}PermissionScope`,
} as const;

type ExternalMetadataKey = keyof typeof EXTERNAL_METADATA_KEYS;

export function normalizeExternalExecutorId(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case EXTERNAL_EXECUTOR_PUBLIC_ID:
    case EXTERNAL_EXECUTOR_ID:
    case 'external-executor':
    case 'executor.external':
    case LEGACY_EXTERNAL_EXECUTOR_ID:
      return EXTERNAL_EXECUTOR_ID;
    default:
      return normalized;
  }
}

export function isExternalExecutor(value: unknown): boolean {
  return normalizeExternalExecutorId(value) === EXTERNAL_EXECUTOR_ID;
}

export function isExternalCommand(commandType: unknown): boolean {
  const command = String(commandType || '').trim().toLowerCase();
  return command === EXTERNAL_EXECUTOR_COMMAND || command === LEGACY_EXTERNAL_COMMAND;
}

export function isExternalReviewCommand(commandType: unknown): boolean {
  const command = String(commandType || '').trim().toLowerCase();
  return (
    command === EXTERNAL_REVIEW_COMMAND ||
    command === EXTERNAL_REVIEW_DASH_COMMAND ||
    command === LEGACY_EXTERNAL_REVIEW_COMMAND ||
    command === LEGACY_EXTERNAL_REVIEW_DASH_COMMAND
  );
}

export function isExternalPathAccessRequiredError(errorCode: unknown): boolean {
  const code = String(errorCode || '').trim();
  return (
    code === EXTERNAL_PATH_ACCESS_REQUIRED_ERROR_CODE ||
    code === LEGACY_EXTERNAL_PATH_ACCESS_REQUIRED_ERROR_CODE
  );
}

export function isExternalWorkspaceMismatchError(errorCode: unknown): boolean {
  const code = String(errorCode || '').trim();
  return (
    code === EXTERNAL_WORKSPACE_MISMATCH_ERROR_CODE ||
    code === LEGACY_EXTERNAL_WORKSPACE_MISMATCH_ERROR_CODE
  );
}

export function getExternalMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: ExternalMetadataKey,
): unknown {
  if (!metadata) {
    return undefined;
  }
  return metadata[EXTERNAL_METADATA_KEYS[key]] ?? metadata[LEGACY_EXTERNAL_METADATA_KEYS[key]];
}

export function getRuntimeAdapterRoleFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const role =
    getExternalMetadataValue(metadata, 'agentRole') ||
    metadata?.target_agent ||
    getExternalMetadataValue(metadata, 'stageRole');
  return String(role || 'default').trim().toLowerCase();
}

export function getRuntimeAdapterBindingsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const legacyBindings = getExternalMetadataValue(metadata, 'agentBindings');
  const externalBindings = metadata?.[EXTERNAL_METADATA_KEYS.agentBindings];
  return {
    ...(legacyBindings && typeof legacyBindings === 'object'
      ? (legacyBindings as Record<string, string>)
      : {}),
    ...(externalBindings && typeof externalBindings === 'object'
      ? (externalBindings as Record<string, string>)
      : {}),
  };
}

export function getExternalPermissionIdsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const legacyIds = getExternalMetadataValue(metadata, 'permissionIds');
  const externalIds = metadata?.[EXTERNAL_METADATA_KEYS.permissionIds];
  return {
    ...(legacyIds && typeof legacyIds === 'object'
      ? (legacyIds as Record<string, string>)
      : {}),
    ...(externalIds && typeof externalIds === 'object'
      ? (externalIds as Record<string, string>)
      : {}),
  };
}

type ExternalMetadataPatchValue = string | Record<string, string>;

export function buildExternalMetadataPatch(
  values: Partial<Record<ExternalMetadataKey, ExternalMetadataPatchValue>>,
): Record<string, ExternalMetadataPatchValue> {
  const patch: Record<string, ExternalMetadataPatchValue> = {};
  for (const key of Object.keys(values) as ExternalMetadataKey[]) {
    const value = values[key];
    if (value !== undefined) {
      patch[EXTERNAL_METADATA_KEYS[key]] = value;
    }
  }
  return patch;
}

export function getExternalExecutorAgentId(): string {
  return String(readLegacyConfigValue('AgentId', 'main') || 'main');
}

export function getExternalExecutorTimeoutSeconds(): number {
  return Number(readLegacyConfigValue('TimeoutSeconds', 600));
}

export function createExternalExecutor(): IExecutor {
  try {
    const req = typeof require !== 'undefined' ? require : (globalThis as Record<string, unknown>).require as NodeRequire;
    const loaded = req('../execution/ExternalExecutor.js');
    return new loaded.ExternalExecutor();
  } catch {
    throw new Error('ExternalExecutor is not available in current execution context.');
  }
}

export function formatTelegramExecutorId(value: unknown): string {
  if (isExternalExecutor(value)) {
    return EXTERNAL_EXECUTOR_PUBLIC_ID;
  }
  return String(value || '').trim();
}

export function formatTelegramExecutorLabel(value: unknown): string {
  if (isExternalExecutor(value)) {
    return EXTERNAL_EXECUTOR_LABEL;
  }
  return String(value || '').trim();
}

export function externalizeExecutorText(value: unknown): string {
  return String(value || '')
    .split(LEGACY_EXTERNAL_EXECUTOR_LABEL).join(EXTERNAL_EXECUTOR_LABEL)
    .split(LEGACY_EXTERNAL_EXECUTOR_ID).join(EXTERNAL_EXECUTOR_PUBLIC_ID)
    .split(LEGACY_EXTERNAL_ERROR_PREFIX).join('EXTERNAL_EXECUTOR');
}

function readLegacyConfigValue<T>(suffix: string, fallback: T): T {
  const key = `${LEGACY_EXTERNAL_EXECUTOR_ID}${suffix}`;
  return ((config as Record<string, unknown>)[key] ?? fallback) as T;
}
