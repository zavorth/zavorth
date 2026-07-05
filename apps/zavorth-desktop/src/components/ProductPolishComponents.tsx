import React, { type ReactNode } from 'react';

// StatusBadge Component
export const StatusBadge: React.FC<{
  status: 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}> = ({ status, children }) => {
  const colors = {
    success: { bg: 'rgba(82, 196, 26, 0.1)', color: '#52c41a', border: '#b7eb8f' },
    warning: { bg: 'rgba(250, 173, 20, 0.1)', color: '#faad14', border: '#ffe58f' },
    error: { bg: 'rgba(255, 77, 79, 0.1)', color: '#ff4d4f', border: '#ffccc7' },
    info: { bg: 'rgba(24, 144, 255, 0.1)', color: '#1890ff', border: '#91d5ff' },
  };

  const style = colors[status] || colors.info;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '12px',
        backgroundColor: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};

// RiskBadge Component
export const RiskBadge: React.FC<{
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}> = ({ level }) => {
  const configs = {
    LOW: { bg: '#e6ffed', color: '#28a745', label: 'Risco Baixo' },
    MEDIUM: { bg: '#fff9db', color: '#f59f00', label: 'Medium Risk' },
    HIGH: { bg: '#fff5f5', color: '#ff6b6b', label: 'Risco Alto' },
    CRITICAL: { bg: '#fff0f6', color: '#e64980', label: 'Critical Risk' },
  };

  const config = configs[level] || configs.LOW;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 'bold',
        borderRadius: '4px',
        backgroundColor: config.bg,
        color: config.color,
        textTransform: 'uppercase',
      }}
    >
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
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid var(--zvd-border, #e8e8e8)',
        backgroundColor: 'var(--zvd-surface, #ffffff)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      {title && <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>{title}</h4>}
      {children}
    </div>
  );
};

// EmptyState Component
export const EmptyState: React.FC<{
  title: string;
  description: string;
  icon?: string;
}> = ({ title, description, icon }) => {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        borderRadius: '8px',
        border: '1px dashed #d9d9d9',
        backgroundColor: '#fafafa',
        margin: '16px 0',
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon || '📁'}</div>
      <h4 style={{ margin: '0 0 8px 0', color: '#262626', fontSize: '15px' }}>{title}</h4>
      <p style={{ margin: 0, color: '#8c8c8c', fontSize: '13px', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
        {description}
      </p>
    </div>
  );
};

// InlineAlert Component
export const InlineAlert: React.FC<{
  type: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
}> = ({ type, title, message }) => {
  const configs = {
    info: { border: '#91d5ff', bg: '#e6f7ff', icon: 'ℹ️', color: '#0050b3' },
    warning: { border: '#ffe58f', bg: '#fffbe6', icon: '⚠️', color: '#ad6800' },
    error: { border: '#ffccc7', bg: '#fff1f0', icon: '❌', color: '#a8071a' },
  };

  const config = configs[type] || configs.info;

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '6px',
        border: `1px solid ${config.border}`,
        backgroundColor: config.bg,
        color: config.color,
        fontSize: '13px',
        lineHeight: '1.5',
      }}
    >
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
    <div style={{ marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1f1f1f' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '13px', color: '#8c8c8c' }}>{description}</p>
    </div>
  );
};

// ActionHint Component
export const ActionHint: React.FC<{
  message: string;
}> = ({ message }) => {
  return (
    <div style={{ marginTop: '8px', fontSize: '12px', color: '#595959', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: '#1890ff' }}>💡</span>
      <span>{message}</span>
    </div>
  );
};
