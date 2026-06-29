import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../apiClient';

interface ActiveTrust {
  trustId: string;
  workspaceId: string;
  rootSuffix: string;
  rootHash: string;
  kind: 'system-temp' | 'user-selected-external';
  displayName: string;
  allowedOperations: string[];
  expiresAt: string;
  createdAt: string;
}

interface TemporaryDirectoryTrustStatusProps {
  workspaceId: string;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = Date.parse(expiresAt) - Date.now();
  if (diff <= 0) return 'Expired';
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Fase 21E-B — Temporary Directory Trust Status
 *
 * Displays active Temporary Directory/External Trusts in the sidebar with a revoke button.
 */
export function TemporaryDirectoryTrustStatus({ workspaceId }: TemporaryDirectoryTrustStatusProps) {
  const [trusts, setTrusts] = useState<ActiveTrust[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const fetchTrusts = useCallback(async () => {
    try {
      const result = await apiRequest<{ ok: boolean; trusts?: ActiveTrust[] }>({
        method: 'GET',
        path: '/api/v2/workspace/temporary-directory-trusts/active',
        query: { workspaceId }
      });
      if (result.ok && result.data?.ok) {
        setTrusts(result.data.trusts ?? []);
      }
    } catch {
      // silent
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTrusts();
    const interval = setInterval(fetchTrusts, 5000);
    return () => clearInterval(interval);
  }, [fetchTrusts]);

  // Tick every 30s to refresh time-left display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRevoke = async (trustId: string) => {
    setRevoking(trustId);
    try {
      await apiRequest({
        method: 'POST',
        path: '/api/v2/workspace/temporary-directory-trusts/revoke',
        body: { workspaceId, trustId }
      });
      setTrusts(prev => prev.filter(t => t.trustId !== trustId));
    } catch {
      // silent
    } finally {
      setRevoking(null);
    }
  };

  if (trusts.length === 0) return null;

  return (
    <div
      id="tmp-dir-trust-status"
      style={{
        margin: '8px 0',
        background: '#13131f',
        border: '1px solid #2a2a45',
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '12px',
        color: '#aaa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          color: '#c9b8ff',
          fontWeight: 600,
          fontSize: '12px',
        }}
      >
        <span>🗂️</span>
        <span>Directory Trusts ({trusts.length})</span>
      </div>

      {trusts.map(trust => (
        <div
          key={trust.trustId}
          id={`tmp-trust-item-${trust.trustId}`}
          style={{
            background: '#1a1a30',
            border: '1px solid #2a2a50',
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'monospace',
                color: '#80cfff',
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={trust.displayName}
            >
              {trust.displayName}
            </div>
            <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
              {trust.allowedOperations.map(op => op.replace('filesystem.', '')).join(', ')} · {formatTimeLeft(trust.expiresAt)} left
            </div>
          </div>
          <button
            id={`tmp-trust-revoke-${trust.trustId}`}
            onClick={() => handleRevoke(trust.trustId)}
            disabled={revoking === trust.trustId}
            title="Revoke this trust"
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: '1px solid #555',
              borderRadius: '5px',
              color: '#ff8080',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: revoking === trust.trustId ? 'not-allowed' : 'pointer',
              opacity: revoking === trust.trustId ? 0.5 : 1,
            }}
          >
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}
