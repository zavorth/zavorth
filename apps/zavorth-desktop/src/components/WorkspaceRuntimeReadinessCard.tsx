import React from 'react';

export interface WorkspaceRuntimeReadinessIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface WorkspaceRuntimeReadiness {
  workspaceId: string;
  ready: boolean;
  providerReady: boolean;
  modelReady: boolean;
  autonomyReady: boolean;
  policyReady: boolean;
  issues: WorkspaceRuntimeReadinessIssue[];
}

export const WorkspaceRuntimeReadinessCard: React.FC<{ readiness: WorkspaceRuntimeReadiness | null }> = ({ readiness }) => {
  if (!readiness) {
    return <div className="readiness-card loading">Carregando status de prontidão...</div>;
  }

  // Prevent leaking any sensitive info by filtering message text just in case (though it should be sanitized at API level)
  const safeIssues = readiness.issues.map(issue => {
    let safeMessage = issue.message;
    // Hard check to strip API keys / secret references if they ever slip through
    safeMessage = safeMessage.replace(/(sk-[a-zA-Z0-9_-]+)/g, '[REDACTED_SECRET]');
    safeMessage = safeMessage.replace(/(Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_BEARER]');
    return { ...issue, message: safeMessage };
  });

  return (
    <div className={`readiness-card ${readiness.ready ? 'ready' : 'not-ready'}`}>
      <h3>Workspace Readiness: {readiness.ready ? 'Ready' : 'Not Ready'}</h3>
      <div className="readiness-flags">
        <span className={readiness.providerReady ? 'success' : 'error'}>Provider</span>
        <span className={readiness.modelReady ? 'success' : 'warning'}>Model</span>
        <span className={readiness.autonomyReady ? 'success' : 'warning'}>Autonomy</span>
        <span className={readiness.policyReady ? 'success' : 'error'}>Policy</span>
      </div>
      
      {safeIssues.length > 0 && (
        <ul className="readiness-issues">
          {safeIssues.map((issue, idx) => (
            <li key={idx} className={`issue ${issue.severity}`}>
              <strong>{issue.code}:</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
