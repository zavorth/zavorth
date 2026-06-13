import { useState } from 'react';

interface WorkspaceTaskMandateModalProps {
  proposedMandate: {
    mandateId: string;
    workspaceId: string;
    taskId?: string;
    description: string;
    targetDirectories: string[];
    allowedOperations: string[];
    allowedBinaries: string[];
    maxRiskLevel: string;
    allowPackageInstall: boolean;
    allowNetwork: boolean;
    createdAt: string;
  } | null;
  onResolve: (approved: boolean) => Promise<void>;
}

export function WorkspaceTaskMandateModal({
  proposedMandate,
  onResolve,
}: WorkspaceTaskMandateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!proposedMandate) return null;

  const handleResolve = async (approved: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await onResolve(approved);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve task mandate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="write-approval-overlay">
      <div className="write-approval-modal" style={{ maxWidth: '560px' }}>
        <div className="write-approval-header">
          <div className="write-approval-icon">
            <span className="warning-symbol" style={{ fontSize: '24px' }}>🛡️</span>
          </div>
          <div className="write-approval-title-section">
            <h2 className="write-approval-title">
              Approve Task Mandate?
            </h2>
            <div className="write-approval-subtitle">
              Authorize automated action plan for this task
            </div>
          </div>
        </div>

        <div className="write-approval-body" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '6px', color: '#fff' }}>
              Goal Description
            </div>
            <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>
              {proposedMandate.description}
            </div>
            {proposedMandate.taskId && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
                Task ID: <code>{proposedMandate.taskId}</code>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff', marginBottom: '6px' }}>
                Allowed Directories
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {proposedMandate.targetDirectories.map((dir, i) => (
                  <code key={i} style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                    {dir || '.'}
                  </code>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff', marginBottom: '6px' }}>
                Allowed Binaries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {proposedMandate.allowedBinaries.map((bin, i) => (
                  <span key={i} style={{ fontSize: '11px', background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {bin}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff', marginBottom: '8px' }}>
              Execution Constraints
            </div>
            <table style={{ width: '100%', fontSize: '12px', color: '#ccc', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 0', fontWeight: '500' }}>Operations Allowed:</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>
                    {proposedMandate.allowedOperations.map(op => op.split('.')[1] || op).join(', ')}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 0', fontWeight: '500' }}>Max Risk Level:</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: proposedMandate.maxRiskLevel === 'MEDIUM' ? '#f39c12' : '#2ecc71', fontWeight: 'bold' }}>
                    {proposedMandate.maxRiskLevel}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 0', fontWeight: '500' }}>Allow Package Install:</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: proposedMandate.allowPackageInstall ? '#2ecc71' : '#e74c3c' }}>
                    {proposedMandate.allowPackageInstall ? 'Yes' : 'No'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', fontWeight: '500' }}>Allow Network Access:</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', color: proposedMandate.allowNetwork ? '#2ecc71' : '#e74c3c' }}>
                    {proposedMandate.allowNetwork ? 'Yes' : 'No'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: '#888', fontStyle: 'italic', lineHeight: '1.4' }}>
            Approving this mandate gives Zavorth the ability to auto-run matches for up to 30 minutes inside target directories. Any actions outside this scope will still require individual approval.
          </div>

          {error && (
            <div className="write-approval-error" style={{ marginTop: '12px' }}>
              Error: {error}
            </div>
          )}
        </div>

        <div className="write-approval-footer">
          <button
            className="btn-deny"
            onClick={() => handleResolve(false)}
            disabled={loading}
          >
            Deny Mandate
          </button>
          <button
            className="btn-approve"
            onClick={() => handleResolve(true)}
            disabled={loading}
          >
            Approve Mandate
          </button>
        </div>
      </div>
    </div>
  );
}
