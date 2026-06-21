import { useEffect, useState } from 'react';

interface WorkspaceCommandApprovalModalProps {
  approvals: Array<{
    operationId: string;
    workspaceId: string;
    command: string;
    createdAt: string;
    expiresAt: string;
  }>;
  onResolve: (operationId: string, decision: 'approve' | 'deny') => Promise<void>;
}

export function WorkspaceCommandApprovalModal({
  approvals,
  onResolve,
}: WorkspaceCommandApprovalModalProps) {
  const activeApproval = approvals[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Expiration countdown timer
  useEffect(() => {
    if (!activeApproval) return;

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
      await onResolve(activeApproval.operationId, decision);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve command approval.');
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="write-approval-overlay">
      <div className="write-approval-modal">
        <div className="write-approval-header">
          <div className="write-approval-icon">
            <span className="warning-symbol">💻</span>
          </div>
          <div className="write-approval-title-section">
            <h2 className="write-approval-title">
              Allow Zavorth to run this command?
            </h2>
            <div className="write-approval-subtitle">
              Security verification for command execution
            </div>
          </div>
          <div className="write-approval-timer">
            Expires in <span className={`timer-count ${timeLeft < 30 ? 'critical' : ''}`}>{timeFormatted}</span>
          </div>
        </div>

        <div className="write-approval-body">
          <div className="write-approval-path-info" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="path-label">Command Line:</span>
            <code className="path-value" style={{ width: '100%', wordBreak: 'break-all', marginTop: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              {activeApproval.command}
            </code>
          </div>

          <div style={{ marginTop: '16px', fontSize: '13px', color: '#888' }}>
            Running host commands might affect files, network connections, or the operating system. Please verify before approving.
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
            onClick={() => handleDecision('deny')}
            disabled={loading}
          >
            Block Command
          </button>
          <button
            className="btn-approve"
            onClick={() => handleDecision('approve')}
            disabled={loading || timeLeft <= 0}
          >
            Allow Command
          </button>
        </div>
      </div>
    </div>
  );
}
