import React, { useEffect, useState } from 'react';

interface TempDirTrustProposed {
  trustId: string;
  workspaceId: string;
  rootSuffix: string;
  rootHash: string;
  kind: 'system-temp' | 'user-selected-external';
  displayName: string;
  allowedOperations: string[];
  createdAt: string;
}

interface TemporaryDirectoryTrustModalProps {
  workspaceId: string;
  apiBase?: string;
}

export function TemporaryDirectoryTrustModal({ workspaceId, apiBase = '' }: TemporaryDirectoryTrustModalProps) {
  const [proposed, setProposed] = useState<TempDirTrustProposed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/v2/workspace/temporary-directory-trusts/pending?workspaceId=${encodeURIComponent(workspaceId)}`
        );
        const data = await res.json();
        if (!cancelled && data.ok) {
          setProposed(data.proposed ?? null);
        }
      } catch {
        // silent poll failure
      }
      if (!cancelled) {
        timer = setTimeout(poll, 2000);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspaceId, apiBase]);

  const handleResolve = async (approved: boolean) => {
    if (!proposed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/v2/workspace/temporary-directory-trusts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, trustId: proposed.trustId, approved }),
      });
      const data = await res.json();
      if (data.ok) {
        setProposed(null);
      } else {
        setError(data.error ?? 'Failed to resolve trust.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (!proposed) return null;

  const isExternal = proposed.kind === 'user-selected-external';

  return (
    <div
      id="tmp-dir-trust-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        id="tmp-dir-trust-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tmp-dir-trust-title"
        style={{
          background: '#1c1c2e',
          border: '1px solid #3b3b5c',
          borderRadius: '12px',
          padding: '28px 32px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          color: '#e0e0f0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '22px' }}>{isExternal ? '📁' : '🗂️'}</span>
          <h2
            id="tmp-dir-trust-title"
            style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#c9b8ff' }}
          >
            {isExternal ? 'External Folder Trust Request' : 'Temporary Directory Trust Request'}
          </h2>
        </div>

        {/* Description */}
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#aaa', lineHeight: 1.6 }}>
          The agent is requesting temporary filesystem access to {isExternal ? 'a user-selected external directory' : 'a system temporary directory'}.
          This trust is valid for up to <strong style={{ color: '#e0e0f0' }}>4 hours</strong> (or requested duration) and
          only covers filesystem operations listed below.
        </p>

        {/* Warning badge */}
        <div
          style={{
            background: isExternal ? '#1e2d3e' : '#2a1a3e',
            border: `1px solid ${isExternal ? '#3b6c8a' : '#7c5ccc'}`,
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '12px',
            color: isExternal ? '#80cfff' : '#c9a0ff',
          }}
        >
          <strong>Notice:</strong> This is a temporary directory trust.
          Command execution is <strong>never</strong> authorized by this trust.
          Files like <code>.env</code>, private keys, or <code>.git</code> folders remain strictly blocked.
        </div>

        {/* Trust details */}
        <div
          style={{
            background: '#111124',
            border: '1px solid #2a2a45',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#888' }}>Directory: </span>
            <span
              style={{
                fontFamily: 'monospace',
                background: '#1a1a35',
                padding: '2px 6px',
                borderRadius: '4px',
                color: '#80cfff',
              }}
            >
              {proposed.displayName}
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#888' }}>Trust ID: </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#666',
              }}
            >
              {proposed.trustId}
            </span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Allowed operations: </span>
            <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {proposed.allowedOperations.map(op => (
                <span
                  key={op}
                  style={{
                    background: '#1a2a1a',
                    border: '1px solid #2a4a2a',
                    color: '#80ff80',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                >
                  {op}
                </span>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#2a1a1a',
              border: '1px solid #cc4444',
              borderRadius: '6px',
              padding: '8px 12px',
              marginBottom: '16px',
              color: '#ff8080',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            id="tmp-dir-trust-deny-btn"
            onClick={() => handleResolve(false)}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #555',
              background: 'transparent',
              color: '#ccc',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Deny
          </button>
          <button
            id="tmp-dir-trust-approve-btn"
            onClick={() => handleResolve(true)}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? '#4a3a7a' : '#6c4dcc',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
