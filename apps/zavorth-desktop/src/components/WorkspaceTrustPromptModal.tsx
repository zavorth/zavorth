import type { DesktopWorkspaceScope } from '../workspaceScopes';

interface WorkspaceTrustPromptModalProps {
  showTrustPrompt: boolean;
  activeWorkspaceScope: DesktopWorkspaceScope;
  trustLoading: boolean;
  onClose: () => void;
  onTrust: (allowRiskUpTo: 'LOW' | 'MEDIUM', allowPackageInstall: boolean, allowNetwork: boolean) => Promise<void>;
}

export function WorkspaceTrustPromptModal({
  showTrustPrompt,
  activeWorkspaceScope,
  trustLoading,
  onClose,
  onTrust,
}: WorkspaceTrustPromptModalProps) {
  if (!showTrustPrompt || !activeWorkspaceScope.path) {
    return null;
  }

  return (
    <div className="write-approval-overlay">
      <div className="write-approval-modal" style={{ maxWidth: '480px' }}>
        <div className="write-approval-header">
          <div className="write-approval-icon">
            <span className="warning-symbol">🛡️</span>
          </div>
          <div className="write-approval-title-section">
            <h2 className="write-approval-title">Trust this workspace?</h2>
            <div className="write-approval-subtitle">
              Configure execution permissions for this folder
            </div>
          </div>
        </div>

        <div className="write-approval-body">
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: '1.4' }}>
            You opened <strong>{activeWorkspaceScope.label}</strong>.
            If you trust this folder, Zavorth can execute development commands automatically.
          </p>

          <div style={{ padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '12px' }}>
            <code style={{ wordBreak: 'break-all', display: 'block' }}>{activeWorkspaceScope.path}</code>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: '600' }}>Recommended permissions (Developer Mode):</span>
            <ul style={{ margin: '0', paddingLeft: '20px', color: '#aaa', lineHeight: '1.5' }}>
              <li>Allows automatic execution of LOW risk commands (git status, test runner, etc.)</li>
              <li>Block all high/critical risk executions from auto-running (never auto-runs curl, wget, ssh, etc.)</li>
            </ul>
          </div>
        </div>

        <div className="write-approval-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-deny"
            onClick={onClose}
            disabled={trustLoading}
          >
            Keep Restricted
          </button>
          <button
            className="btn-approve"
            onClick={() => void onTrust('LOW', true, false)}
            disabled={trustLoading}
          >
            Trust and Enable Auto-run
          </button>
        </div>
      </div>
    </div>
  );
}
