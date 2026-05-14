import type {
  UniversalToolExposure,
  UniversalToolRiskLevel,
} from './UniversalAgentRuntimeTypes.js';

export type ToolExecutionSemanticsTool = Pick<
  UniversalToolExposure,
  'id' | 'risk' | 'requiresApproval' | 'description'
>;

export type ToolExecutionSemanticsInput = {
  tool?: ToolExecutionSemanticsTool | null;
  toolId?: string | null;
  risk?: UniversalToolRiskLevel | null;
  retryable?: boolean | null;
  compensatable?: boolean | null;
  requiresPreview?: boolean | null;
  requires_preview?: boolean | null;
  requiresApproval?: boolean | null;
  requires_approval?: boolean | null;
  rollbackStrategy?: string | null;
  rollback_strategy?: string | null;
  externalSideEffect?: boolean | null;
  external_side_effect?: boolean | null;
  metadata?: Record<string, unknown>;
};

export type ToolExecutionSemanticsDecision = {
  toolId: string;
  risk: UniversalToolRiskLevel;
  retryable: boolean;
  compensatable: boolean;
  requiresPreview: boolean;
  requiresApproval: boolean;
  rollbackStrategy: string | null;
  externalSideEffect: boolean;
  policyTags: string[];
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  return value === 'safe' || value === 'attention' || value === 'danger' || value === 'unknown'
    ? value
    : 'unknown';
}

function firstBoolean(...values: Array<boolean | null | undefined>): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
}

function policyTags(input: Omit<ToolExecutionSemanticsDecision, 'policyTags' | 'metadata'>): string[] {
  return [
    `risk:${input.risk}`,
    input.retryable ? 'retryable' : 'not-retryable',
    input.compensatable ? 'compensatable' : 'not-compensatable',
    input.requiresPreview ? 'preview-required' : 'preview-not-required',
    input.requiresApproval ? 'approval-required' : 'approval-not-required',
    input.externalSideEffect ? 'external-side-effect' : 'local-or-readonly',
    input.rollbackStrategy ? `rollback:${input.rollbackStrategy}` : 'rollback:none',
  ];
}

export class ToolExecutionSemantics {
  public resolve(input: ToolExecutionSemanticsInput = {}): ToolExecutionSemanticsDecision {
    const toolId = normalizeText(input.toolId, normalizeText(input.tool?.id, 'unknown-tool'));
    const risk = normalizeRisk(input.risk || input.tool?.risk);
    const rollbackStrategy = normalizeText(input.rollbackStrategy, normalizeText(input.rollback_strategy)) || null;
    const requiresApproval = firstBoolean(
      input.requiresApproval,
      input.requires_approval,
      input.tool?.requiresApproval,
    ) ?? risk === 'danger';
    const requiresPreview = firstBoolean(
      input.requiresPreview,
      input.requires_preview,
    ) ?? (risk === 'danger' || risk === 'attention');
    const externalSideEffect = firstBoolean(
      input.externalSideEffect,
      input.external_side_effect,
    ) ?? (risk === 'danger' || risk === 'attention');
    const compensatable = input.compensatable ?? Boolean(rollbackStrategy);
    const retryable = input.retryable ?? (risk === 'safe' || risk === 'attention');
    const core = {
      toolId,
      risk,
      retryable,
      compensatable,
      requiresPreview,
      requiresApproval,
      rollbackStrategy,
      externalSideEffect,
    };

    return {
      ...core,
      policyTags: policyTags(core),
      metadata: {
        ...(input.metadata || {}),
        source: 'ToolExecutionSemantics',
        toolDescription: normalizeText(input.tool?.description) || null,
      },
    };
  }
}
