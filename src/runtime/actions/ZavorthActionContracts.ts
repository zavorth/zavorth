import type { ZavorthMutationRiskLevel } from '../../contracts/ZavorthMutationPlaneContract.js';

export type ZavorthActionOperation =
  | 'action.schema.lookup'
  | 'action.status'
  | 'action.preview'
  | 'action.apply'
  | 'action.receipts';

export type ZavorthActionRisk = 'safe' | 'attention' | 'danger' | 'unknown';

export type ZavorthActionSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export type ZavorthActionHandlerInput = {
  actionId: string;
  operation: Exclude<ZavorthActionOperation, 'action.schema.lookup' | 'action.receipts'>;
  args: Record<string, unknown>;
  root: string;
  actorId?: string | null;
  sourceSurface?: string | null;
  approvalId?: string | null;
  trustedOperatorConfirmation?: boolean;
};

export type ZavorthActionReceipt = {
  id: string;
  actionId: string;
  operation: string;
  status: 'previewed' | 'applied' | 'approval_required' | 'blocked' | 'failed';
  createdAt: string;
  sourceSurface: string | null;
  actorId: string | null;
  summary: string;
  data?: Record<string, unknown>;
};

export type ZavorthActionResult = {
  ok: boolean;
  actionId: string;
  operation: ZavorthActionOperation;
  status: 'ok' | 'preview' | 'applied' | 'approval_required' | 'blocked' | 'not_found';
  summary: string;
  lines: string[];
  data?: Record<string, unknown>;
  receipt?: ZavorthActionReceipt;
};

export type ZavorthActionDefinition = {
  id: string;
  title: string;
  description: string;
  aliases: string[];
  domains: string[];
  surface: Array<'cli' | 'dashboard' | 'tui' | 'api' | 'channel' | 'llm'>;
  risk: ZavorthActionRisk;
  mutationDomain?: string;
  mutationRisk?: ZavorthMutationRiskLevel;
  requiresPreview: boolean;
  requiresApproval: boolean;
  inputSchema: ZavorthActionSchema;
  outputSchema: ZavorthActionSchema;
  handler: (input: ZavorthActionHandlerInput) => Promise<ZavorthActionResult> | ZavorthActionResult;
};

export type ZavorthActionLookupResult = {
  actionId: string;
  title: string;
  description: string;
  risk: ZavorthActionRisk;
  requiresPreview: boolean;
  requiresApproval: boolean;
  domains: string[];
  aliases: string[];
  score: number;
};

export type ZavorthActionGatewayInput = {
  operation: ZavorthActionOperation;
  actionId?: string | null;
  query?: string | null;
  domain?: string | null;
  args?: Record<string, unknown> | null;
  approvalId?: string | null;
  trustedOperatorConfirmation?: boolean;
  actorId?: string | null;
  sourceSurface?: string | null;
};
