import { useEffect, useState } from 'react';
import { errorMessage } from '../lib/errors';

export interface HostCommandApproval {
  operationId: string;
  workspaceId: string;
  commandPreview: string;
  argsPreview: string;
  cwdSuffix: string;
  shell: boolean;
  riskLevel: string;
  reasonRedacted: string;
  createdAt: string;
  expiresAt: string;
  requiresStrongConfirmation: boolean;
  strongConfirmationPhrase: string | null;
}

interface HostCommandApprovalModalProps {
  approvals: HostCommandApproval[];
  onResolve: (
    operationId: string,
    decision: 'approve' | 'deny',
    strongConfirmationInput?: string,
  ) => Promise<void>;
}

export function HostCommandApprovalModal({
  approvals = [],
  onResolve,
}: HostCommandApprovalModalProps) {
  const activeApproval = approvals[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (!activeApproval) return;
    setConfirmInput('');

    const calculateTimeLeft = () => {
      const expires = new Date(activeApproval.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [activeApproval]);

  if (!activeApproval) return null;

  const handleDecision = async (decision: 'approve' | 'deny') => {
    setLoading(true);
    setError(null);
    try {
      await onResolve(
        activeApproval.operationId,
        decision,
        activeApproval.requiresStrongConfirmation ? confirmInput : undefined,
      );
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to resolve host command approval.'));
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isCritical = activeApproval.riskLevel === 'CRITICAL';
  const requiresStrongPhrase = activeApproval.requiresStrongConfirmation;
  const isConfirmDisabled =
    requiresStrongPhrase && confirmInput !== activeApproval.strongConfirmationPhrase;

  return (
    <div className="write-approval-overlay" data-testid="host-command-approval-modal">
      <div className="write-approval-modal">
        <div className="write-approval-header">
          <div className="write-approval-icon" style={{ backgroundColor: isCritical ? '#d32f2f' : '#f57c00' }}>
            <span className="warning-symbol">⚠️</span>
          </div>
          <div className="write-approval-title-section">
            <h2 className="write-approval-title" style={{ color: isCritical ? '#f44336' : '#ff9800' }}>
              {isCritical ? 'CRITICAL: Allow Host Command...' : 'Allow Host Command Execution...'}
            </h2>
            <div className="write-approval-subtitle">
              Zavorth requests execution permission on host system
            </div>
          </div>
          <div className="write-approval-timer">
            Expires in <span className={`timer-count ${timeLeft < 30 ? 'critical' : ''}`}>{timeFormatted}</span>
          </div>
        </div>

        <div className="write-approval-body">
          <div className="write-approval-path-info" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="path-label">Redacted Preview:</span>
            <code className="path-value" style={{ width: '100%', wordBreak: 'break-all', marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', display: 'block' }}>
              {activeApproval.commandPreview}
            </code>
          </div>

          <div className="write-approval-path-info" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '12px' }}>
            <span className="path-label">Arguments Preview:</span>
            <code className="path-value" style={{ width: '100%', wordBreak: 'break-all', marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', display: 'block' }}>
              {activeApproval.argsPreview}
            </code>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#888' }}>CWD Suffix:</span>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{activeApproval.cwdSuffix}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#888' }}>Shell Mode:</span>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{activeApproval.shell ? 'Yes (shell:true)' : 'No'}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#888' }}>Risk Level:</span>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: isCritical ? '#f44336' : '#ff9800' }}>{activeApproval.riskLevel}</div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#888' }}>Reason:</span>
              <div style={{ fontSize: '13px', fontStyle: 'italic' }}>{activeApproval.reasonRedacted}</div>
            </div>
          </div>

          {requiresStrongPhrase && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244, 67, 54, 0.1)', border: '1px solid #f44336', borderRadius: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f44336', marginBottom: '8px' }}>
                Strong Confirmation Required
              </div>
              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                Please type <strong style={{ color: '#f44336' }}>{activeApproval.strongConfirmationPhrase}</strong> to approve this critical command:
              </div>
              <input
                type="text"
                data-testid="strong-confirmation-input"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Type ${activeApproval.strongConfirmationPhrase}`}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', background: '#222', color: '#fff' }}
              />
            </div>
          )}

          {error && (
            <div className="write-approval-error" style={{ marginTop: '12px' }}>
              Error: {error}
            </div>
          )}
        </div>

        <div className="write-approval-footer">
          <button
            className="btn-deny"
            onClick={() => handleDecision('deny')}
            disabled={loading}
          >
            Block Execution
          </button>
          <button
            className="btn-approve"
            data-testid="approve-button"
            onClick={() => handleDecision('approve')}
            disabled={loading || timeLeft <= 0 || isConfirmDisabled}
            style={{ backgroundColor: isCritical ? '#c62828' : undefined }}
          >
            Allow Execution
          </button>
        </div>
      </div>
    </div>
  );
}
