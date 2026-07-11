import { useEffect, useState } from 'react';
import { createLogger } from '../logger';
import { asErrorLike } from '../lib/errors';

const logger = createLogger('trust');

interface WorkspaceTaskMandateStatusProps {
  activeMandate: {
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
    expiresAt: string;
  } | null;
  onRevoke: () => Promise<void>;
}

export function WorkspaceTaskMandateStatus({
  activeMandate,
  onRevoke,
}: WorkspaceTaskMandateStatusProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeMandate) return;

    const calculateTimeLeft = () => {
      const expires = Date.parse(activeMandate.expiresAt);
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [activeMandate]);

  if (!activeMandate) {
    return (
      <div className="trust-control-card" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#888' }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <span>No active Task Mandate</span>
        </div>
      </div>
    );
  }

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await onRevoke();
    } catch (error: unknown) {
      const err = asErrorLike(error);

      logger.error('Failed to revoke mandate:', err);
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="trust-control-card" style={{ padding: '12px', background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.2)', borderRadius: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#2ecc71', fontWeight: 'bold' }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <span>Task Mandate Active</span>
        </div>
        <div style={{ fontSize: '12px', color: timeLeft < 60 ? '#e74c3c' : '#2ecc71', fontWeight: 'bold' }}>
          {timeFormatted}
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeMandate.description}>
        {activeMandate.description}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#888' }}>Allowed Directories:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {activeMandate.targetDirectories.map((dir, i) => (
            <code key={i} style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px', color: '#aaa' }}>
              {dir || '.'}
            </code>
          ))}
        </div>
      </div>

      <button
        onClick={handleRevoke}
        disabled={loading}
        style={{
          width: '100%',
          background: 'rgba(231, 76, 60, 0.2)',
          color: '#e74c3c',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: '4px',
          padding: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        Revoke Mandate
      </button>
    </div>
  );
}
