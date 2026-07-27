import { isTransientToolError } from './AgentRunNativeToolLoopUtils.js';

export type StructuredToolFailurePlan = {
  toolName: string;
  shouldRetry: boolean;
  nextActions: string[];
  preferredAlternative: string | null;
  userVisibleSummary: string;
};

export function buildStructuredToolFailurePlan(input: {
  toolName: string;
  errorMessage: string;
  availableAlternatives?: string[];
}): StructuredToolFailurePlan {
  const toolName = String(input.toolName || 'tool').trim() || 'tool';
  const errorMessage = String(input.errorMessage || '').trim();
  const shouldRetry = isTransientToolError(new Error(errorMessage));
  const alternatives = (input.availableAlternatives || [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const preferredAlternative = shouldRetry ? null : (alternatives[0] || null);
  const nextActions: string[] = [];
  if (shouldRetry) {
    nextActions.push('retry_once');
  } else {
    nextActions.push('report_failure');
    if (preferredAlternative) nextActions.push(`try_alternative:${preferredAlternative}`);
    nextActions.push('ask_user_if_blocked');
  }
  return {
    toolName,
    shouldRetry,
    nextActions,
    preferredAlternative,
    userVisibleSummary: shouldRetry ? `${toolName} failed temporarily and will be retried once.`
      : `${toolName} failed: ${errorMessage || 'unknown error'}.`,
  };
}
