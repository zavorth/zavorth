import React, { useEffect, useState } from 'react';
import { StatusBadge, RiskBadge, SurfaceCard, InlineAlert, ActionHint } from './ProductPolishComponents.js';
import {
  getWorkspaceTrustStatus,
  loadActiveMandate,
  type RuntimeCapabilitiesSnapshot,
  type TaskMandate,
} from '../apiClient.js';
import type { RuntimeStatus } from '../global';
import { createLogger } from '../logger';

const logger = createLogger('shell');
import { asErrorLike } from '../lib/errors';

type CockpitConfig = {
  data?: Record<string, unknown>;
  config?: Record<string, unknown>;
  [key: string]: unknown;
};

type DiagnosticCheck = {
  status?: string;
  name?: string;
  message?: string;
  [key: string]: unknown;
};

type CockpitDiagnostics = {
  data?: { checks?: DiagnosticCheck[] };
  checks?: DiagnosticCheck[];
  [key: string]: unknown;
};

interface CockpitDashboardProps {
  workspaceId: string;
  workspacePath: string | null;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  status: RuntimeStatus;
  approvalsCount: number;
  onStart(): void | Promise<void>;
  onRepair(): void | Promise<void>;
}

export function CockpitDashboard({
  workspaceId,
  workspacePath,
  runtimeCapabilities,
  status,
  approvalsCount,
  onStart,
  onRepair
}: CockpitDashboardProps) {
  const [trusted, setTrusted] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [diagnostics, setDiagnostics] = useState<CockpitDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMandate, setActiveMandate] = useState<TaskMandate | null>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [trustRes, configRes, diagRes, mandateRes] = await Promise.all([
        getWorkspaceTrustStatus(workspaceId).catch(() => ({ ok: false, trusted: false })),
        fetch(`/api/v2/workspace/agent-config?workspaceId=${encodeURIComponent(workspaceId)}`).then(r => r.json() as Promise<CockpitConfig>).catch(() => ({} as CockpitConfig)),
        fetch(`/api/v2/workspace/agent-config/diagnostics?workspaceId=${encodeURIComponent(workspaceId)}`).then(r => r.json() as Promise<CockpitDiagnostics>).catch(() => ({} as CockpitDiagnostics)),
        loadActiveMandate(workspaceId).catch(() => null)
      ]);

      setTrusted(Boolean((trustRes as { trusted?: boolean }).trusted));
      const configPayload = configRes.data || configRes.config || null;
      setConfig(configPayload && typeof configPayload === 'object' ? configPayload as Record<string, unknown> : null);
      setDiagnostics(diagRes.data || diagRes || null);
      setActiveMandate(mandateRes || null);
    } catch (error: unknown) { const err = asErrorLike(error); logger.error('Error fetching cockpit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#8c8c8c', textAlign: 'center' }}>
        <span>Carregando cockpit do agente...</span>
      </div>
    );
  }

  // Determine Overall Status
  const isProviderConfigured = !!runtimeCapabilities?.providers?.connected?.length;
  const activeProvider = runtimeCapabilities?.providers?.selectedModelId ? runtimeCapabilities.providers.selectedModelId : 'None';
  const isRuntimeReady = status.running && isProviderConfigured && trusted;

  let overallStatus: 'success' | 'warning' | 'error' = 'warning';
  let overallTitle = 'Zavorth: Modo Restrito';
  let overallMessage = 'The agent is operating under strict policies. Every command outside the workspace requires manual approval.';

  if (isRuntimeReady) {
    overallStatus = 'success';
    overallTitle = 'Zavorth: Pronto para Operar';
    overallMessage = 'Workspace confiável e provedor de IA ativo. O agente está pronto para realizar tarefas.';
  } else if (!trusted) {
    overallStatus = 'error';
    overallTitle = 'Untrusted Workspace';
    overallMessage = 'To enable the agent natively and safely, you need to trust this workspace.';
  } else if (!isProviderConfigured) {
    overallStatus = 'warning';
    overallTitle = 'Aguardando Provedor de IA';
    overallMessage = 'Nenhuma chave de API ou provedor de IA configurado. Configure um provedor nas abas para iniciar.';
  }

  const diagnosticChecks = diagnostics?.checks || diagnostics?.data?.checks || [];
  const hasDiagnosticsWarnings = diagnosticChecks.some(
    (c) => c.status === 'fail' || c.status === 'warning',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="cockpit-dashboard">
      {/* Overall Status Banner */}
      <InlineAlert
        type={overallStatus === 'success' ? 'info' : overallStatus === 'warning' ? 'warning' : 'error'}
        title={overallTitle}
        message={overallMessage}
      />

      <SurfaceCard title="Solicitações Pendentes & Diagnósticos" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--zvd-text-muted, #595959)' }}>Aprovações Pendentes</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: approvalsCount > 0 ? '#ff4d4f' : '#52c41a' }}>
            {approvalsCount} pendentes
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--zvd-text-muted, #595959)' }}>Mandato de Tarefa Ativa</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: activeMandate ? '#52c41a' : '#faad14' }}>
            {activeMandate ? 'Configurado' : 'Nenhum'}
          </span>
        </div>

        {hasDiagnosticsWarnings && (
          <div style={{ marginTop: '8px', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--zvd-warning-bg, #fffbe6)', border: '1px solid var(--zvd-warning-border, #ffe58f)' }}>
            <span style={{ fontSize: '12px', color: '#ad6800' }}>
              O painel de diagnósticos possui alertas que precisam de atenção.
            </span>
          </div>
        )}

        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          <button
            onClick={onStart}
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              border: '1px solid var(--zvd-border)', 
              background: 'var(--zvd-border-soft)', 
              color: 'var(--zvd-text)',
              fontWeight: 500
            }}
          >
            Start Runtime
          </button>
          <button
            onClick={onRepair}
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              border: '1px solid var(--zvd-border)', 
              background: 'var(--zvd-border-soft)', 
              color: 'var(--zvd-text)',
              fontWeight: 500
            }}
          >
            Repair Access
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}
