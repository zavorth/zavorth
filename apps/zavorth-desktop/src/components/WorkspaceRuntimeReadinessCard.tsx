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

import { StatusBadge, SurfaceCard } from './ProductPolishComponents';

export const WorkspaceRuntimeReadinessCard: React.FC<{ readiness: WorkspaceRuntimeReadiness | null }> = ({ readiness }) => {
  if (!readiness) {
    return <div className="readiness-card loading">Loading readiness status...</div>;
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
    <div className={`readiness-card ${readiness.ready ? 'ready' : 'not-ready'}`} style={{ marginTop: '16px' }}>
      <SurfaceCard title={`Workspace Readiness: ${readiness.ready ? 'Ready' : 'Not Ready'}`}>
        <div className="readiness-flags" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <span className={readiness.providerReady ? 'success' : 'error'}>
            <StatusBadge status={readiness.providerReady ? 'success' : 'error'}>Provider</StatusBadge>
          </span>
          <span className={readiness.modelReady ? 'success' : 'warning'}>
            <StatusBadge status={readiness.modelReady ? 'success' : 'warning'}>Model</StatusBadge>
          </span>
          <span className={readiness.autonomyReady ? 'success' : 'warning'}>
            <StatusBadge status={readiness.autonomyReady ? 'success' : 'warning'}>Autonomy</StatusBadge>
          </span>
          <span className={readiness.policyReady ? 'success' : 'error'}>
            <StatusBadge status={readiness.policyReady ? 'success' : 'error'}>Policy</StatusBadge>
          </span>
        </div>
        
        {safeIssues.length > 0 && (
          <ul className="readiness-issues" style={{ paddingLeft: '20px', margin: 0 }}>
            {safeIssues.map((issue, idx) => (
              <li key={idx} className={`issue ${issue.severity}`} style={{ fontSize: '13px', margin: '4px 0' }}>
                <strong>{issue.code}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
};
