import React from 'react';
import { WorkspaceRuntimeReadinessIssue } from './WorkspaceRuntimeReadinessCard';

export interface WorkspacePolicyPreviewData {
  providerId?: string;
  modelId?: string;
  allowedCapabilities: string[];
  autonomyProfile: string;
  allowDeveloperMode: boolean;
  allowHostPowerMode: boolean;
  allowPty: boolean;
  allowTaskMandates: boolean;
  allowTemporaryDirectoryTrust: boolean;
  allowProviderFallback: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  warnings: WorkspaceRuntimeReadinessIssue[];
}

export const WorkspacePolicyPreview: React.FC<{ preview: WorkspacePolicyPreviewData | null }> = ({ preview }) => {
  if (!preview) {
    return <div className="policy-preview loading">Carregando preview...</div>;
  }

  // Prevent leaking any sensitive info by filtering message text
  const safeWarnings = preview.warnings.map(issue => {
    let safeMessage = issue.message;
    safeMessage = safeMessage.replace(/(sk-[a-zA-Z0-9_-]+)/g, '[REDACTED_SECRET]');
    safeMessage = safeMessage.replace(/(Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_BEARER]');
    return { ...issue, message: safeMessage };
  });

  return (
    <div className={`policy-preview risk-${preview.riskLevel.toLowerCase()}`}>
      <h3>Policy Preview (Risk: {preview.riskLevel})</h3>
      
      <div className="policy-details">
        <div><strong>Provider:</strong> {preview.providerId || 'None'}</div>
        <div><strong>Model:</strong> {preview.modelId || 'None'}</div>
        <div><strong>Autonomy Profile:</strong> {preview.autonomyProfile}</div>
        
        <div className="capabilities">
          <strong>Capabilities:</strong> {preview.allowedCapabilities.join(', ') || 'None'}
        </div>
        
        <div className="flags">
          <div>Developer Mode: {preview.allowDeveloperMode ? 'Allowed' : 'Blocked'}</div>
          <div>Host Power Mode: {preview.allowHostPowerMode ? 'Allowed' : 'Blocked'}</div>
          <div>PTY: {preview.allowPty ? 'Allowed' : 'Blocked'}</div>
          <div>Task Mandates: {preview.allowTaskMandates ? 'Allowed' : 'Blocked'}</div>
          <div>Temporary Directory Trust: {preview.allowTemporaryDirectoryTrust ? 'Allowed' : 'Blocked'}</div>
          <div>Provider Fallback: {preview.allowProviderFallback ? 'Allowed' : 'Blocked'}</div>
        </div>
      </div>

      {safeWarnings.length > 0 && (
        <div className="policy-warnings">
          <h4>Warnings</h4>
          <ul>
            {safeWarnings.map((warning, idx) => (
              <li key={idx} className={`warning ${warning.severity}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
