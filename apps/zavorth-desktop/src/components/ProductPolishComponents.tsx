import React, { type ReactNode } from 'react';

// StatusBadge Component
export const StatusBadge: React.FC<{
  status: 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}> = ({ status, children }) => {
  return (
    <span className={`zvd-status-badge is-${status}`}>
      {children}
    </span>
  );
};

// RiskBadge Component
export const RiskBadge: React.FC<{
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}> = ({ level }) => {
  const configs = {
    LOW: { label: 'Low Risk', className: 'zvd-status-badge is-success' },
    MEDIUM: { label: 'Medium Risk', className: 'zvd-status-badge is-warning' },
    HIGH: { label: 'High Risk', className: 'zvd-status-badge is-error' },
    CRITICAL: { label: 'Critical Risk', className: 'zvd-status-badge is-error' },
  };

  const config = configs[level] || configs.LOW;

  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
};

// SurfaceCard Component
export const SurfaceCard: React.FC<{
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}> = ({ title, children, style }) => {
  return (
    <div className="zvd-surface-card" style={style}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
};


export { EmptyState } from '../primitives/ui';
export { InfinityLoader as InfinityStateLoader, InfinityLoader as LemniscateStateLoader } from './InfinityLoader.js';
export const RecoveryOverlay: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div className="zvd-recovery-overlay">{children}</div>;


// InlineAlert Component
export const InlineAlert: React.FC<{
  type: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
}> = ({ type, title, message }) => {
  const configs = {
    info: { icon: 'ℹ️' },
    warning: { icon: '⚠️' },
    error: { icon: '❌' },
  };

  const config = configs[type] || configs.info;

  return (
    <div className={`zvd-inline-alert is-${type}`}>
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{config.icon}</span>
      <div>
        {title && <strong style={{ display: 'block', marginBottom: '4px' }}>{title}</strong>}
        <span>{message}</span>
      </div>
    </div>
  );
};

// SectionHeader Component
export const SectionHeader: React.FC<{
  title: string;
  description: string;
}> = ({ title, description }) => {
  return (
    <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--zvd-border)', paddingBottom: '8px' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--zvd-text)' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--zvd-text-muted, #7c7c7c)' }}>{description}</p>
    </div>
  );
};

// ActionHint Component
export const ActionHint: React.FC<{
  message: string;
}> = ({ message }) => {
  return (
    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--zvd-text-muted, #7c7c7c)', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: 'var(--zvd-accent, #ff7a2f)' }}>💡</span>
      <span>{message}</span>
    </div>
  );
};
