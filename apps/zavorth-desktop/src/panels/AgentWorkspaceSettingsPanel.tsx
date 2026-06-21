import React, { useState, useEffect } from 'react';
import { WorkspaceRuntimeReadinessCard, WorkspaceRuntimeReadiness } from '../components/WorkspaceRuntimeReadinessCard';
import { WorkspacePolicyPreview, WorkspacePolicyPreviewData } from '../components/WorkspacePolicyPreview';
import { ActionHint } from '../components/ProductPolishComponents.js';

export interface AgentWorkspaceConfig {
  workspaceId: string;
  defaultProviderId?: string;
  defaultModelId?: string;
  allowedCapabilities: string[];
  defaultAutonomyProfile: 'safe' | 'developer';
  allowDeveloperMode: boolean;
  allowHostPowerMode: boolean;
  allowPty: boolean;
  allowTaskMandates: boolean;
  allowTemporaryDirectoryTrust: boolean;
  allowProviderFallback: boolean;
}

type PanelStatus = 'loading' | 'ready' | 'error' | 'saving';

/** Sanitizes an error before surfacing it in the UI — strips API keys and raw secrets. */
function sanitizeErrorMessage(raw: unknown): string {
  if (!raw) return 'Erro desconhecido.';
  const msg = raw instanceof Error ? raw.message : String(raw);
  // Strip any accidental API key / bearer token from the message
  return msg
    .replace(/(sk-[a-zA-Z0-9_-]+)/g, '[REDACTED]')
    .replace(/(Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_BEARER]')
    .replace(/(Authorization:\s*[^\s]+)/gi, '[REDACTED_AUTH]')
    .substring(0, 200); // hard cap to prevent giant raw error blobs
}

/** Maps normalized error codes to human-readable messages. */
function describeProviderError(code: string): string {
  const map: Record<string, string> = {
    missing_key:            'Chave de API não configurada para este provider.',
    provider_not_found:     'Provider não encontrado. Verifique as configurações.',
    capability_not_supported: 'Capacidade não suportada pelo workspace. Verifique allowedCapabilities.',
    routing_error:          'Erro ao rotear requisição para o provider. Tente novamente.',
    no_providers_enabled:   'Nenhum provider habilitado. Configure um provider primeiro.',
  };
  return map[code] || 'Erro ao conectar ao provider. Verifique as configurações.';
}

export const AgentWorkspaceSettingsPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [config, setConfig] = useState<AgentWorkspaceConfig | null>(null);
  const [readiness, setReadiness] = useState<WorkspaceRuntimeReadiness | null>(null);
  const [preview, setPreview] = useState<WorkspacePolicyPreviewData | null>(null);
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    setErrorMessage(null);

    Promise.all([
      fetch(`/api/v2/workspace/agent-config?workspaceId=${encodeURIComponent(workspaceId)}`)
        .then(r => r.json())
        .then(data => setConfig(data.data || data.config)),
      fetch(`/api/v2/workspace/agent-config/readiness?workspaceId=${encodeURIComponent(workspaceId)}`)
        .then(r => r.json())
        .then(data => setReadiness(data.data || data)),
    ])
      .then(() => setStatus('ready'))
      .catch(e => {
        setStatus('error');
        setErrorMessage(sanitizeErrorMessage(e));
      });
  }, [workspaceId]);

  const handlePreview = async () => {
    if (!config) return;
    try {
      const r = await fetch(`/api/v2/workspace/agent-config/preview?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, config })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setErrorMessage(describeProviderError(err.error || 'routing_error'));
        return;
      }
      const data = await r.json();
      setPreview(data.data || data);
      setErrorMessage(null);
    } catch (e) {
      setErrorMessage(sanitizeErrorMessage(e));
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setStatus('saving');
    setSaveMessage(null);
    setErrorMessage(null);
    try {
      const r = await fetch(`/api/v2/workspace/agent-config?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, config })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setErrorMessage(describeProviderError(err.error || 'routing_error'));
        setStatus('ready');
        return;
      }
      // Refresh readiness after save
      const readinessResp = await fetch(`/api/v2/workspace/agent-config/readiness?workspaceId=${encodeURIComponent(workspaceId)}`);
      const readinessData = await readinessResp.json();
      setReadiness(readinessData.data || readinessData);
      setSaveMessage('Configurações salvas com sucesso.');
      setStatus('ready');
    } catch (e) {
      setErrorMessage(sanitizeErrorMessage(e));
      setStatus('ready');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="agent-workspace-settings-panel loading" aria-busy="true">
        <p>Carregando configurações do workspace...</p>
      </div>
    );
  }

  // ── Error state (config failed to load) ───────────────────────────────
  if (status === 'error' && !config) {
    return (
      <div className="agent-workspace-settings-panel error">
        <h2>Configurações do Workspace do Agente</h2>
        <div className="error-message" role="alert">
          <strong>Erro ao carregar configurações:</strong> {errorMessage || 'Tente reabrir o workspace.'}
        </div>
      </div>
    );
  }

  if (!config) return null;

  // ── PTY dependency hint ────────────────────────────────────────────────
  const ptyRequiresHpm = config.allowPty && !config.allowHostPowerMode;

  return (
    <div className="agent-workspace-settings-panel">
      <h2>Configurações do Workspace do Agente</h2>

      {/* Error banner (non-fatal) */}
      {errorMessage && (
        <div className="error-message" role="alert" data-testid="panel-error">
          {errorMessage}
        </div>
      )}

      {/* Save confirmation banner */}
      {saveMessage && (
        <div className="success-message" role="status" data-testid="panel-save-success">
          {saveMessage}
        </div>
      )}

      {/* PTY requires HPM hint */}
      {ptyRequiresHpm && (
        <div className="warning-message" role="alert" data-testid="pty-requires-hpm-warning">
          ⚠️ Sessões PTY requerem Host Power Mode habilitado para funcionar.
        </div>
      )}

      <div className="form-group">
        <label>Provider Padrão:</label>
        <input
          type="text"
          value={config.defaultProviderId || ''}
          placeholder={config.defaultProviderId ? undefined : 'Nenhum provider configurado'}
          onChange={e => setConfig({ ...config, defaultProviderId: e.target.value })}
          data-testid="input-provider-id"
        />
        {!config.defaultProviderId && (
          <span className="field-hint warning" data-testid="missing-provider-hint">
            Nenhum provider configurado. Configure um provider nas Configurações de Provider.
          </span>
        )}
      </div>

      <div className="form-group">
        <label>Modelo Padrão:</label>
        <input
          type="text"
          value={config.defaultModelId || ''}
          placeholder={config.defaultModelId ? undefined : 'Nenhum modelo configurado'}
          onChange={e => setConfig({ ...config, defaultModelId: e.target.value })}
          data-testid="input-model-id"
        />
        {!config.defaultModelId && (
          <span className="field-hint warning" data-testid="missing-model-hint">
            Nenhum modelo configurado. O sistema usará o modelo padrão do provider.
          </span>
        )}
      </div>

      <div className="form-group">
        <label>Autonomy Profile Padrão:</label>
        <select
          value={config.defaultAutonomyProfile}
          onChange={e => setConfig({ ...config, defaultAutonomyProfile: e.target.value as 'safe' | 'developer' })}
          data-testid="select-autonomy-profile"
        >
          <option value="safe">Safe (Recomendado)</option>
          <option value="developer">Developer</option>
        </select>
      </div>

      <div className="checkboxes" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.allowDeveloperMode}
              onChange={e => setConfig({ ...config, allowDeveloperMode: e.target.checked })}
              data-testid="check-developer-mode"
            /> Permitir Developer Mode
          </label>
          <ActionHint message="Developer Mode está desativado. Ative apenas para fluxos avançados e auditáveis." />
        </div>
        
        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.allowHostPowerMode}
              onChange={e => setConfig({ ...config, allowHostPowerMode: e.target.checked })}
              data-testid="check-host-power-mode"
            /> Permitir Host Power Mode
          </label>
          <ActionHint message="Host Power Mode está desativado por padrão. Ative apenas se você realmente precisar executar ações fora do workspace." />
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.allowPty}
              onChange={e => setConfig({ ...config, allowPty: e.target.checked })}
              data-testid="check-pty"
            /> Permitir Sessões PTY
          </label>
          <ActionHint message="PTY requer Host Power Mode. Essa restrição impede sessões interativas fora do controle esperado." />
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowTaskMandates}
              onChange={e => setConfig({ ...config, allowTaskMandates: e.target.checked })}
              data-testid="check-task-mandates"
            /> Permitir Task Mandates
          </label>
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowTemporaryDirectoryTrust}
              onChange={e => setConfig({ ...config, allowTemporaryDirectoryTrust: e.target.checked })}
              data-testid="check-tmp-dir-trust"
            /> Permitir Temporary Directory Trust
          </label>
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowProviderFallback}
              onChange={e => setConfig({ ...config, allowProviderFallback: e.target.checked })}
              data-testid="check-provider-fallback"
            /> Permitir Provider Fallback
          </label>
        </div>
      </div>

      <WorkspaceRuntimeReadinessCard readiness={readiness} />

      <div className="actions">
        <button onClick={handlePreview} disabled={status === 'saving'} data-testid="btn-preview">
          Preview Policy
        </button>
        <button onClick={handleSave} disabled={status === 'saving'} data-testid="btn-save">
          {status === 'saving' ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {preview && <WorkspacePolicyPreview preview={preview} />}
    </div>
  );
};
