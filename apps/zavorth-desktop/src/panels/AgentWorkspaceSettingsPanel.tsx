import React, { useState, useEffect } from 'react';
import { WorkspaceRuntimeReadinessCard, WorkspaceRuntimeReadiness } from '../components/WorkspaceRuntimeReadinessCard';
import { WorkspacePolicyPreview, WorkspacePolicyPreviewData } from '../components/WorkspacePolicyPreview';
import { ActionHint } from '../components/ProductPolishComponents.js';
import { asErrorLike } from '../lib/errors';

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

/** Sanitizes an error before surfacing it in the UI; strips API keys and raw secrets. */
function sanitizeErrorMessage(raw: unknown): string {
  if (!raw) return 'Unknown error.';
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
    missing_key:            'API key is not configured for this provider.',
    provider_not_found:     'Provider not found. Check the settings.',
    capability_not_supported: 'Capability is not supported by the workspace. Check allowedCapabilities.',
    routing_error:          'Failed to route request to the provider. Try again.',
    no_providers_enabled:   'No provider enabled. Configure a provider first.',
  };
  return map[code] || 'Failed to connect to the provider. Check the settings.';
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
    } catch (error: unknown) { const err = asErrorLike(error); setErrorMessage(sanitizeErrorMessage(err));
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
      setSaveMessage('Settings saved successfully.');
      setStatus('ready');
    } catch (error: unknown) { const err = asErrorLike(error); setErrorMessage(sanitizeErrorMessage(err));
      setStatus('ready');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="agent-workspace-settings-panel loading" aria-busy="true">
        <p>Loading workspace settings...</p>
      </div>
    );
  }

  // ── Error state (config failed to load) ───────────────────────────────
  if (status === 'error' && !config) {
    return (
      <div className="agent-workspace-settings-panel error">
        <h2>Agent Workspace Settings</h2>
        <div className="error-message" role="alert">
          <strong>Failed to load settings:</strong> {errorMessage || 'Try reopening the workspace.'}
        </div>
      </div>
    );
  }

  if (!config) return null;

  // ── PTY dependency hint ────────────────────────────────────────────────
  const ptyRequiresHpm = config.allowPty && !config.allowHostPowerMode;

  return (
    <div className="agent-workspace-settings-panel">
      <h2>Agent Workspace Settings</h2>

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
          PTY sessions require Host Power Mode to be enabled.
        </div>
      )}

      <div className="form-group">
        <label>Default Provider:</label>
        <input
          type="text"
          value={config.defaultProviderId || ''}
          placeholder={config.defaultProviderId ? undefined : 'No provider configured'}
          onChange={e => setConfig({ ...config, defaultProviderId: e.target.value })}
          data-testid="input-provider-id"
        />
        {!config.defaultProviderId && (
          <span className="field-hint warning" data-testid="missing-provider-hint">
            No provider configured. Configure a provider in Provider Settings.
          </span>
        )}
      </div>

      <div className="form-group">
        <label>Default Model:</label>
        <input
          type="text"
          value={config.defaultModelId || ''}
          placeholder={config.defaultModelId ? undefined : 'No model configured'}
          onChange={e => setConfig({ ...config, defaultModelId: e.target.value })}
          data-testid="input-model-id"
        />
        {!config.defaultModelId && (
          <span className="field-hint warning" data-testid="missing-model-hint">
            No model configured. The system will use the provider default model.
          </span>
        )}
      </div>

      <div className="form-group">
        <label>Default Autonomy Profile:</label>
        <select
          value={config.defaultAutonomyProfile}
          onChange={e => setConfig({ ...config, defaultAutonomyProfile: e.target.value as 'safe' | 'developer' })}
          data-testid="select-autonomy-profile"
        >
          <option value="safe">Safe (Recommended)</option>
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
            /> Allow Developer Mode
          </label>
          <ActionHint message="Developer Mode is disabled. Enable it only for advanced, auditable flows." />
        </div>
        
        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.allowHostPowerMode}
              onChange={e => setConfig({ ...config, allowHostPowerMode: e.target.checked })}
              data-testid="check-host-power-mode"
            /> Allow Host Power Mode
          </label>
          <ActionHint message="Host Power Mode is disabled by default. Enable it only if you really need to execute actions outside the workspace." />
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={config.allowPty}
              onChange={e => setConfig({ ...config, allowPty: e.target.checked })}
              data-testid="check-pty"
            /> Allow PTY Sessions
          </label>
          <ActionHint message="PTY requires Host Power Mode. This restriction prevents interactive sessions outside the expected control path." />
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowTaskMandates}
              onChange={e => setConfig({ ...config, allowTaskMandates: e.target.checked })}
              data-testid="check-task-mandates"
            /> Allow Task Mandates
          </label>
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowTemporaryDirectoryTrust}
              onChange={e => setConfig({ ...config, allowTemporaryDirectoryTrust: e.target.checked })}
              data-testid="check-tmp-dir-trust"
            /> Allow Temporary Directory Trust
          </label>
        </div>

        <div style={{ padding: '8px', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={config.allowProviderFallback}
              onChange={e => setConfig({ ...config, allowProviderFallback: e.target.checked })}
              data-testid="check-provider-fallback"
            /> Allow Provider Fallback
          </label>
        </div>
      </div>

      <WorkspaceRuntimeReadinessCard readiness={readiness} />

      <div className="actions">
        <button onClick={handlePreview} disabled={status === 'saving'} data-testid="btn-preview">
          Preview Policy
        </button>
        <button onClick={handleSave} disabled={status === 'saving'} data-testid="btn-save">
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {preview && <WorkspacePolicyPreview preview={preview} />}
    </div>
  );
};
