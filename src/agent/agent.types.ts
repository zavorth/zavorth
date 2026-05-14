export interface AgentJobRequest {
  jobId: string;
  sessionId: string;
  
  // A instrução primária em linguagem natural do Core para o Agente
  objective: string;
  
  // Contexto curado e pré-carregado pelo Core (para economizar tokens e tempo de pesquisa)
  context: {
    workingDirectory: string;
    recentErrors?: string[];
    relevantFiles?: string[];
    environmentContext?: Record<string, any>;
  };

  // Restrições de Operação (Limites de Sandbox ditados pelo Core)
  constraints: {
    maxTokens: number;
    timeoutSeconds: number;
    allowNetwork: boolean;
    allowFileSystemWrite: boolean;
  };

  // Lista branca explícita de ferramentas que o Core provisiona para este runtime
  allowedTools: Array<'read_file' | 'write_file' | 'bash_read_only' | 'bash_unsafe' | 'network_fetch' | string>;

  // Gatilhos cirúrgicos: Ações que forçam o agente a usar o tool 'request_approval'
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
    
    // Se o Agente encontrou uma ação bloqueada pelo 'requireApprovalFor', ele manda isso:
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
  
  // O TL;DR legível para apresentar rapidamente na UI do chat (Telegram)
  executiveSummary: string;
  
  // Payload bruto para consumo em outros processos no código
  structuredOutput: {
    patchProposed?: string;
    filesAnalyzed: string[];
    confidenceScore: number;
    [key: string]: any;
  };

  // Feedback vital pro Core punir/dar rollback ou cobrar o custo
  metrics: {
    totalTokens: number;
    toolCallsMade: number;
    durationMs: number;
  };
}

// A Carga devolvida pelo Core quando um Agente pede 'approval_request'
export interface AgentApprovalResponse {
  jobId: string;
  approved: boolean;
  operatorFeedback?: string; // O humano (ou a policy) pode dar um override: "Não commita na master, faz checkout numa branch de fix primeiro"
}
