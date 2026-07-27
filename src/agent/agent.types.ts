export interface AgentJobRequest {
  jobId: string;
  sessionId: string;

  // Primary natural-language instruction from Core to the Agent.
  objective: string;

  // Curated context preloaded by Core to save tokens and research time.
  context: {
    workingDirectory: string;
    recentErrors?: string[];
    relevantFiles?: string[];
    environmentContext?: Record<string, any>;
  };

  // Operation constraints, including sandbox limits dictated by Core.
  constraints: {
    maxTokens: number;
    timeoutSeconds: number;
    allowNetwork: boolean;
    allowFileSystemWrite: boolean;
  };

  // Explicit tool allowlist provisioned by Core for this runtime.
  allowedTools: Array<'read_file' | 'write_file' | 'bash_read_only' | 'bash_unsafe' | 'network_fetch' | string>;

  // Surgical triggers: actions that force the agent to use the 'request_approval' tool.
  requireApprovalFor: Array<'commit' | 'deploy' | 'npm_install' | 'modify_production_db' | string>;
}

export interface AgentProgressEvent {
  jobId: string;
  timestamp: string;
  type: 'log' | 'tool_call' | 'approval_request' | 'error' | 'milestone';
  metadata: {
    message: string;
    toolName?: string;
    toolArgs?: any;

    // If the Agent found an action blocked by 'requireApprovalFor', it sends this:
    suspensionPayload?: {
      actionAttempted: string;
      reasonForApproval: string;
      impactSummary: string;
    };
  };
}

export interface AgentJobResult {
  jobId: string;
  status: 'success' | 'failed' | 'aborted_by_policy' | 'timeout';

  // Human-readable TL;DR for quick display in chat UI surfaces.
  executiveSummary: string;

  // Raw payload for consumption by other code processes.
  structuredOutput: {
    patchProposed?: string;
    filesAnalyzed: string[];
    confidenceScore: number;
    [key: string]: any;
  };

  // Vital feedback for the Core to penalize/rollback or charge the cost
  metrics: {
    totalTokens: number;
    toolCallsMade: number;
    durationMs: number;
  };
}

// Payload returned by Core when an agent requests 'approval_request'
export interface AgentApprovalResponse {
  jobId: string;
  approved: boolean;
  operatorFeedback?: string; // A human or policy can override execution guidance.
}
