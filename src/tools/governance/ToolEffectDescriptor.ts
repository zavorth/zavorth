import type { ActionIntentKind } from '../../runtime/effects/ActionIntent.js';
import type { EffectResourceKind, EffectSensitivity } from '../../runtime/effects/EffectScope.js';

export type ToolEffectLevel =
  | 'observation'
  | 'draft'
  | 'workspace_mutation'
  | 'external_egress'
  | 'credential_or_config'
  | 'irreversible_or_destructive'
  | 'unknown';

export type ToolEffectDescriptor = {
  toolName: string;
  level: ToolEffectLevel;
  intentKind: ActionIntentKind;
  operation: string;
  defaultResourceKind: EffectResourceKind;
  defaultSensitivity?: EffectSensitivity;
  requiresEffectBoundary: boolean;
  safeObservation: boolean;
  description: string;
  aliases?: string[];
  argumentResourceHints?: string[];
  metadata?: Record<string, unknown>;
};

export function normalizeToolName(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function descriptorRequiresGovernance(descriptor: ToolEffectDescriptor): boolean {
  return descriptor.requiresEffectBoundary && !descriptor.safeObservation;
}

export function descriptorToIntentKind(level: ToolEffectLevel): ActionIntentKind {
  switch (level) {
    case 'observation':
      return 'tool_call';
    case 'draft':
      return 'draft';
    case 'workspace_mutation':
      return 'workspace_mutation';
    case 'external_egress':
      return 'external_egress';
    case 'credential_or_config':
      return 'credential_or_config';
    case 'irreversible_or_destructive':
      return 'irreversible_or_destructive';
    default:
      return 'tool_call';
  }
}
