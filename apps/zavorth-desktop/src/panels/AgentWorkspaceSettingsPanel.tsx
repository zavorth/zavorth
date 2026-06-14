import React, { useState, useEffect } from 'react';
import { WorkspaceRuntimeReadinessCard, WorkspaceRuntimeReadiness } from '../components/WorkspaceRuntimeReadinessCard';
import { WorkspacePolicyPreview, WorkspacePolicyPreviewData } from '../components/WorkspacePolicyPreview';

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

export const AgentWorkspaceSettingsPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [config, setConfig] = useState<AgentWorkspaceConfig | null>(null);
  const [readiness, setReadiness] = useState<WorkspaceRuntimeReadiness | null>(null);
  const [preview, setPreview] = useState<WorkspacePolicyPreviewData | null>(null);

  useEffect(() => {
    // In a real app this would fetch from /api/v2/workspace/agent-config
    fetch(`/api/v2/workspace/agent-config`)
      .then(r => r.json())
      .then(data => setConfig(data.config))
      .catch(console.error);
      
    fetch(`/api/v2/workspace/agent-config/readiness`)
      .then(r => r.json())
      .then(data => setReadiness(data))
      .catch(console.error);
  }, [workspaceId]);

  const handlePreview = async () => {
    if (!config) return;
    try {
      const r = await fetch(`/api/v2/workspace/agent-config/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await r.json();
      setPreview(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      await fetch(`/api/v2/workspace/agent-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      // Refresh readiness
      const r = await fetch(`/api/v2/workspace/agent-config/readiness`);
      setReadiness(await r.json());
    } catch (e) {
      console.error(e);
    }
  };

  if (!config) return <div>Carregando configurações...</div>;

  return (
    <div className="agent-workspace-settings-panel">
      <h2>Configurações do Workspace do Agente</h2>
      
      <div className="form-group">
        <label>Provider Padrão:</label>
        <input 
          type="text" 
          value={config.defaultProviderId || ''} 
          onChange={e => setConfig({ ...config, defaultProviderId: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Modelo Padrão:</label>
        <input 
          type="text" 
          value={config.defaultModelId || ''} 
          onChange={e => setConfig({ ...config, defaultModelId: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Autonomy Profile Padrão:</label>
        <select 
          value={config.defaultAutonomyProfile} 
          onChange={e => setConfig({ ...config, defaultAutonomyProfile: e.target.value as 'safe' | 'developer' })}
        >
          <option value="safe">Safe (Recomendado)</option>
          <option value="developer">Developer</option>
        </select>
      </div>

      <div className="checkboxes">
        <label>
          <input 
            type="checkbox" 
            checked={config.allowDeveloperMode} 
            onChange={e => setConfig({ ...config, allowDeveloperMode: e.target.checked })}
          /> Permitir Developer Mode
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={config.allowHostPowerMode} 
            onChange={e => setConfig({ ...config, allowHostPowerMode: e.target.checked })}
          /> Permitir Host Power Mode
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={config.allowPty} 
            onChange={e => setConfig({ ...config, allowPty: e.target.checked })}
          /> Permitir Sessões PTY
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={config.allowTaskMandates} 
            onChange={e => setConfig({ ...config, allowTaskMandates: e.target.checked })}
          /> Permitir Task Mandates
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={config.allowTemporaryDirectoryTrust} 
            onChange={e => setConfig({ ...config, allowTemporaryDirectoryTrust: e.target.checked })}
          /> Permitir Temporary Directory Trust
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={config.allowProviderFallback} 
            onChange={e => setConfig({ ...config, allowProviderFallback: e.target.checked })}
          /> Permitir Provider Fallback
        </label>
      </div>

      <WorkspaceRuntimeReadinessCard readiness={readiness} />

      <div className="actions">
        <button onClick={handlePreview}>Preview Policy</button>
        <button onClick={handleSave}>Salvar Configurações</button>
      </div>

      {preview && <WorkspacePolicyPreview preview={preview} />}
    </div>
  );
};
