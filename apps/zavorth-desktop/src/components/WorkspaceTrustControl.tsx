import { useEffect, useState } from 'react';
import { getWorkspaceTrustStatus, resolveWorkspaceTrust } from '../apiClient';

interface WorkspaceTrustControlProps {
  workspaceId: string;
  workspaceRoot: string;
  onStatusChange?: () => void;
}

export function WorkspaceTrustControl({
  workspaceId,
  workspaceRoot,
  onStatusChange,
}: WorkspaceTrustControlProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trusted, setTrusted] = useState(false);
  const [allowRiskUpTo, setAllowRiskUpTo] = useState<'LOW' | 'MEDIUM'>('LOW');
  const [allowPackageInstall, setAllowPackageInstall] = useState(false);
  const [allowNetwork, setAllowNetwork] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWorkspaceTrustStatus(workspaceId);
      if (res.ok) {
        setTrusted(res.trusted);
        if (res.entry) {
          setAllowRiskUpTo(res.entry.allowRiskUpTo);
          setAllowPackageInstall(res.entry.allowPackageInstall);
          setAllowNetwork(res.entry.allowNetwork);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trust status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [workspaceId]);

  const handleToggleTrust = async () => {
    setLoading(true);
    setError(null);
    try {
      const newTrusted = !trusted;
      await resolveWorkspaceTrust({
        workspaceId,
        rootPath: workspaceRoot,
        trusted: newTrusted,
        allowRiskUpTo,
        allowPackageInstall,
        allowNetwork,
      });
      setTrusted(newTrusted);
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update trust status.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermissions = async (updatedFields: {
    allowRiskUpTo?: 'LOW' | 'MEDIUM';
    allowPackageInstall?: boolean;
    allowNetwork?: boolean;
  }) => {
    setLoading(true);
    setError(null);
    const newRisk = updatedFields.allowRiskUpTo ?? allowRiskUpTo;
    const newPkg = updatedFields.allowPackageInstall ?? allowPackageInstall;
    const newNet = updatedFields.allowNetwork ?? allowNetwork;

    try {
      await resolveWorkspaceTrust({
        workspaceId,
        rootPath: workspaceRoot,
        trusted: true,
        allowRiskUpTo: newRisk,
        allowPackageInstall: newPkg,
        allowNetwork: newNet,
      });
      setAllowRiskUpTo(newRisk);
      setAllowPackageInstall(newPkg);
      setAllowNetwork(newNet);
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update trust permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="zvd-trust-control-card" style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      marginTop: '12px',
      fontSize: '13px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: '600', color: trusted ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{trusted ? '🛡️' : '⚠️'}</span>
          <span>{trusted ? 'Trusted Workspace' : 'Restricted Workspace'}</span>
        </span>
        <button
          onClick={handleToggleTrust}
          disabled={loading}
          style={{
            background: trusted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: trusted ? '#ef4444' : '#10b981',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {trusted ? 'Revoke Trust' : 'Trust Workspace'}
        </button>
      </div>

      <p style={{ color: '#888', margin: '0 0 12px 0', fontSize: '11px', lineHeight: '1.4' }}>
        {trusted 
          ? 'Zavorth is allowed to run low/medium-risk commands automatically in this folder according to options below.'
          : 'Zavorth runs commands in Restricted Mode. Every execution requires manual approval.'
        }
      </p>

      {trusted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#aaa' }}>Max Auto Risk Level:</span>
            <select
              value={allowRiskUpTo}
              onChange={(e) => handleUpdatePermissions({ allowRiskUpTo: e.target.value as 'LOW' | 'MEDIUM' })}
              disabled={loading}
              style={{
                background: '#15161b',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '11px'
              }}
            >
              <option value="LOW">LOW Risk</option>
              <option value="MEDIUM">MEDIUM Risk</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowPackageInstall}
              onChange={(e) => handleUpdatePermissions({ allowPackageInstall: e.target.checked })}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <span>Allow Package Installs (npm/pnpm/yarn)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowNetwork}
              onChange={(e) => handleUpdatePermissions({ allowNetwork: e.target.checked })}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <span>Allow Medium Network Commands</span>
          </label>
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', marginTop: '8px', fontSize: '11px' }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
