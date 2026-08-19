import { useEffect, useState } from 'react';
import { loadWorkspaceWriteApprovalPayload } from '../apiClient';
import { errorMessage } from '../lib/errors';

interface WorkspaceWriteApprovalModalProps {
  approvals: Array<{
    operationId: string;
    toolName: string;
    pathSuffix: string;
    path: string | null;
    createdAt: string;
    expiresAt: string;
  }>;
  sessionId: string;
  workspacePath?: string | null;
  onResolve: (operationId: string, decision: 'approve' | 'deny') => Promise<void>;
}

export function WorkspaceWriteApprovalModal({
  approvals = [],
  sessionId,
  workspacePath,
  onResolve,
}: WorkspaceWriteApprovalModalProps) {
  const activeApproval = Array.isArray(approvals) && approvals.length > 0 ? approvals[0] : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    operationId: string;
    file: string;
    toolName: string;
    currentContent?: string;
    proposedContent?: string;
    currentContentExists: boolean;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!activeApproval) {
      setPayload(null);
      setError(null);
      return;
    }

    const fetchPayload = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await loadWorkspaceWriteApprovalPayload(
          activeApproval.operationId,
          sessionId,
          workspacePath || undefined
        );
        const raw = (res.data && typeof res.data === 'object' ? res.data : res) as Record<string, unknown>;
        setPayload({
          operationId: String(raw.operationId || activeApproval.operationId),
          file: String(raw.file || activeApproval.path || ''),
          toolName: String(raw.toolName || activeApproval.toolName),
          currentContent: typeof raw.currentContent === 'string' ? raw.currentContent : undefined,
          proposedContent: typeof raw.proposedContent === 'string' ? raw.proposedContent : undefined,
          currentContentExists: Boolean(raw.currentContentExists),
        });
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load proposed content payload.'));
      } finally {
        setLoading(false);
      }
    };

    fetchPayload();
  }, [activeApproval, sessionId, workspacePath]);

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

  const isWrite = activeApproval.toolName === 'workspace.filesystem.write';
  const isMkdir = activeApproval.toolName === 'workspace.filesystem.mkdir';

  const handleDecision = async (decision: 'approve' | 'deny') => {
    setLoading(true);
    try {
      await onResolve(activeApproval.operationId, decision);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to resolve write approval.'));
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
            <span className="warning-symbol">⚠️</span>
          </div>
          <div className="write-approval-title-section">
            <h2 className="write-approval-title">
              {isWrite ? 'Allow Zavorth to write this file...' : 'Allow Zavorth to create this directory...'}
            </h2>
            <div className="write-approval-subtitle">
              Security verification for file write operation
            </div>
          </div>
          <div className="write-approval-timer">
            Expires in <span className={`timer-count ${timeLeft < 30 ? 'critical' : ''}`}>{timeFormatted}</span>
          </div>
        </div>

        <div className="write-approval-body">
          <div className="write-approval-path-info">
            <span className="path-label">Target File Path:</span>
            <code className="path-value">{payload?.file || activeApproval.path || 'unknown'}</code>
          </div>

          {loading && <div className="write-approval-loading">Loading preview...</div>}

          {error && (
            <div className="write-approval-error">
              Error: {error}
            </div>
          )}

          {!loading && !error && payload && (
            <div className="write-approval-preview-container">
              {isWrite && (
                <>
                  {payload.currentContentExists ? (
                    <div className="write-approval-diff-wrapper">
                      <div className="diff-pane current-pane">
                        <div className="pane-header">Current Version</div>
                        <pre className="code-block">{payload.currentContent || '(Empty File)'}</pre>
                      </div>
                      <div className="diff-pane proposed-pane">
                        <div className="pane-header">Proposed Version</div>
                        <pre className="code-block">{payload.proposedContent || '(Empty Content)'}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="write-approval-new-file-wrapper">
                      <div className="pane-header">New File Content</div>
                      <pre className="code-block">{payload.proposedContent || '(Empty File)'}</pre>
                    </div>
                  )}
                </>
              )}
              {isMkdir && (
                <div className="write-approval-mkdir-info">
                  Zavorth is requesting permission to create a new directory at this path. No existing files will be modified.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="write-approval-footer">
          <button
            className="btn-deny"
            onClick={() => handleDecision('deny')}
            disabled={loading}
          >
            Block Operation
          </button>
          <button
            className="btn-approve"
            onClick={() => handleDecision('approve')}
            disabled={loading || timeLeft <= 0}
          >
            Allow Operation
          </button>
        </div>
      </div>
    </div>
  );
}
