import React, { useEffect, useState } from 'react';
import { StatusBadge, RiskBadge, SurfaceCard, InlineAlert, ActionHint } from './ProductPolishComponents.js';
import { getWorkspaceTrustStatus, loadActiveMandate } from '../apiClient.js';

interface CockpitDashboardProps {
  workspaceId: string;
  workspacePath: string | null;
  runtimeCapabilities: any;
  status: any;
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
  const [config, setConfig] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMandate, setActiveMandate] = useState<any>(null);

  const fetchData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [trustRes, configRes, diagRes, mandateRes] = await Promise.all([
        getWorkspaceTrustStatus(workspaceId).catch(() => ({ ok: false, trusted: false })),
        fetch(`/api/v2/workspace/agent-config?workspaceId=${encodeURIComponent(workspaceId)}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/v2/workspace/agent-config/diagnostics?workspaceId=${encodeURIComponent(workspaceId)}`).then(r => r.json()).catch(() => ({})),
        loadActiveMandate(workspaceId).catch(() => null)
      ]);

      setTrusted(trustRes.trusted || false);
      setConfig(configRes.data || configRes.config || null);
      setDiagnostics(diagRes.data || diagRes || null);
      setActiveMandate(mandateRes || null);
    } catch (e) {
      console.error('Error fetching cockpit data:', e);
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
  const activeProvider = runtimeCapabilities?.providers?.selectedModelId ? runtimeCapabilities.providers.selectedModelId : 'Nenhum';
  const isRuntimeReady = status.running && isProviderConfigured && trusted;

  let overallStatus: 'success' | 'warning' | 'error' = 'warning';
  let overallTitle = 'Zavorth: Modo Restrito';
  let overallMessage = 'O agente está operando sob políticas rígidas. Todo comando fora do workspace necessita aprovação manual.';

  if (isRuntimeReady) {
    overallStatus = 'success';
    overallTitle = 'Zavorth: Pronto para Operar';
    overallMessage = 'Workspace confiável e provedor de IA ativo. O agente está pronto para realizar tarefas.';
  } else if (!trusted) {
    overallStatus = 'error';
    overallTitle = 'Workspace Não Confiável';
    overallMessage = 'Para habilitar o agente de forma nativa e segura, você precisa confiar neste workspace.';
  } else if (!isProviderConfigured) {
    overallStatus = 'warning';
    overallTitle = 'Aguardando Provedor de IA';
    overallMessage = 'Nenhuma chave de API ou provedor de IA foi configurado. Configure um provedor para iniciar.';
  }

  const hasDiagnosticsWarnings = diagnostics?.checks?.some((c: any) => c.status === 'fail' || c.status === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }} className="cockpit-dashboard">
      {/* Overall Status Banner */}
      <InlineAlert
        type={overallStatus === 'success' ? 'info' : overallStatus === 'warning' ? 'warning' : 'error'}
        title={overallTitle}
        message={overallMessage}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Column: Status Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SurfaceCard title="Saúde do Sistema & Runtime">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Runtime Reachable</span>
                <StatusBadge status={status.running ? 'success' : 'error'}>
                  {status.running ? 'Conectado' : 'Desconectado'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Workspace Confianca</span>
                <StatusBadge status={trusted ? 'success' : 'error'}>
                  {trusted ? 'Trusted' : 'Restricted'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Provedor Ativo</span>
                <StatusBadge status={isProviderConfigured ? 'success' : 'warning'}>
                  {isProviderConfigured ? 'Pronto' : 'Pendente'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Modelo de IA</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{activeProvider}</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button
                onClick={onStart}
                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff' }}
              >
                Start Runtime
              </button>
              <button
                onClick={onRepair}
                style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff' }}
              >
                Repair Access
              </button>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Controles e Postura de Segurança">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Developer Mode</span>
                <StatusBadge status={config?.allowDeveloperMode ? 'warning' : 'success'}>
                  {config?.allowDeveloperMode ? 'Habilitado' : 'Bloqueado'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Host Power Mode (HPM)</span>
                <StatusBadge status={config?.allowHostPowerMode ? 'warning' : 'success'}>
                  {config?.allowHostPowerMode ? 'Habilitado' : 'Bloqueado'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>PTY Sessions</span>
                <StatusBadge status={config?.allowPty ? 'warning' : 'success'}>
                  {config?.allowPty ? 'Habilitado' : 'Bloqueado'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Temp Dir Trust</span>
                <StatusBadge status={config?.allowTemporaryDirectoryTrust ? 'success' : 'success'}>
                  {config?.allowTemporaryDirectoryTrust ? 'Habilitado' : 'Desabilitado'}
                </StatusBadge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Task Mandates</span>
                <StatusBadge status={config?.allowTaskMandates ? 'success' : 'success'}>
                  {config?.allowTaskMandates ? 'Ativo' : 'Inativo'}
                </StatusBadge>
              </div>
            </div>
            <ActionHint message="Safe defaults: Privilégios perigosos desativados por padrão." />
          </SurfaceCard>
        </div>

        {/* Right Column: Diagnostics, Approvals and Onboarding */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SurfaceCard title="Aprovações e Diagnósticos">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Aprovações Pendentes</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: approvalsCount > 0 ? '#ff4d4f' : '#52c41a' }}>
                  {approvalsCount} pendente(s)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#595959' }}>Mandate Ativo</span>
                <StatusBadge status={activeMandate ? 'success' : 'warning'}>
                  {activeMandate ? 'Configurado' : 'Nenhum'}
                </StatusBadge>
              </div>

              {hasDiagnosticsWarnings && (
                <div style={{ marginTop: '8px', padding: '8px', borderRadius: '4px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f' }}>
                  <span style={{ fontSize: '12px', color: '#ad6800' }}>
                    ⚠️ O painel de diagnósticos possui alertas que requerem atenção.
                  </span>
                </div>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Next Steps - Guia de Onboarding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: trusted ? 0.6 : 1 }}>
                <span>1️⃣</span>
                <span>Escolha um workspace e conceda permissão de <strong>Trust</strong>.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: isProviderConfigured ? 0.6 : 1 }}>
                <span>2️⃣</span>
                <span>Configure credenciais de provedor no menu <strong>Providers</strong>.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: config?.defaultModelId ? 0.6 : 1 }}>
                <span>3️⃣</span>
                <span>Selecione o provider e o modelo padrão do sistema.</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>4️⃣</span>
                <span>Verifique a saúde do runtime na aba <strong>Beta Checklist</strong>.</span>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
