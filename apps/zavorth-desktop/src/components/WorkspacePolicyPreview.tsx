import React from 'react';
import { WorkspaceRuntimeReadinessIssue } from './WorkspaceRuntimeReadinessCard';
import { SurfaceCard, RiskBadge, InlineAlert } from './ProductPolishComponents';

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
    <div className={`policy-preview risk-${preview.riskLevel.toLowerCase()}`} style={{ marginTop: '16px' }}>
      <SurfaceCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Policy Preview (Risk: {preview.riskLevel})</h3>
          <RiskBadge level={preview.riskLevel} />
        </div>
        
        <div className="policy-details" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div><strong>Provider:</strong> {preview.providerId || 'None'}</div>
          <div><strong>Model:</strong> {preview.modelId || 'None'}</div>
          <div><strong>Autonomy Profile:</strong> {preview.autonomyProfile}</div>
          
          <div className="capabilities" style={{ marginTop: '4px' }}>
            <strong>Capabilities:</strong> {preview.allowedCapabilities.join(', ') || 'None'}
          </div>
          
          <div className="flags" style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px', borderRadius: '4px', backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}>
            <div>Developer Mode: {preview.allowDeveloperMode ? 'Allowed' : 'Blocked'}</div>
            <div>Host Power Mode: {preview.allowHostPowerMode ? 'Allowed' : 'Blocked'}</div>
            <div>PTY: {preview.allowPty ? 'Allowed' : 'Blocked'}</div>
            <div>Task Mandates: {preview.allowTaskMandates ? 'Allowed' : 'Blocked'}</div>
            <div>Temporary Directory Trust: {preview.allowTemporaryDirectoryTrust ? 'Allowed' : 'Blocked'}</div>
            <div>Provider Fallback: {preview.allowProviderFallback ? 'Allowed' : 'Blocked'}</div>
          </div>
        </div>

        {safeWarnings.length > 0 && (
          <div className="policy-warnings" style={{ marginTop: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Warnings</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {safeWarnings.map((warning, idx) => (
                <div key={idx} className={`warning ${warning.severity}`}>
                  <InlineAlert type="warning" message={warning.message} />
                </div>
              ))}
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
};
