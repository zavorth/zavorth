import React, { useState, useEffect } from 'react';
import { Settings, Plus, Server, Edit2, Trash2, Key, CheckCircle2, XCircle, ChevronRight, HelpCircle } from 'lucide-react';
import { ProviderConfigPayload } from '../components/ProviderSetupModal.js';

export function ProviderSettingsPanel() {
  const [providers, setProviders] = useState<ProviderConfigPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state for Master/Detail
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  // Mode: 'view' or 'edit' or 'create'
  const [detailMode, setDetailMode] = useState<'view' | 'edit' | 'create'>('view');
  
  // Tab state: 'keys' or 'accounts'
  const [activeTab, setActiveTab] = useState<'keys' | 'accounts'>('keys');

  // Form state for creating/editing
  const [formData, setFormData] = useState<ProviderConfigPayload>({
    type: 'openai',
    displayName: '',
    baseUrl: '',
    defaultModel: '',
    enabled: true,
    requiresApiKey: true,
    apiKey: '',
  });

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Default values mapping
  const DEFAULT_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: 'http://localhost:11434',
    'openai-compatible': ''
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/v2/providers');
      if (!res.ok) throw new Error('Failed to fetch providers');
      const data = await res.json();
      const list = data.data || [];
      setProviders(list);
      
      // Select the first one by default if nothing is selected yet
      if (list.length > 0 && !selectedProviderId) {
        setSelectedProviderId(list[0].providerId);
        setFormData({ ...list[0], apiKey: '' });
        setDetailMode('view');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSelectProvider = (p: ProviderConfigPayload) => {
    setSelectedProviderId(p.providerId || null);
    setFormData({ ...p, apiKey: '' });
    setDetailMode('view');
    setTestResult(null);
  };

  const handleNewProvider = () => {
    setSelectedProviderId(null);
    setFormData({
      type: 'openai',
      displayName: 'New Provider',
      baseUrl: DEFAULT_URLS['openai'],
      defaultModel: '',
      enabled: true,
      requiresApiKey: true,
      apiKey: '',
    });
    setDetailMode('create');
    setTestResult(null);
  };

  const handleTypeChange = (newType: ProviderConfigPayload['type']) => {
    const isLocal = newType === 'ollama';
    setFormData(prev => ({
      ...prev,
      type: newType,
      baseUrl: DEFAULT_URLS[newType] || '',
      requiresApiKey: !isLocal,
      displayName: prev.displayName && prev.displayName !== 'New Provider' ? prev.displayName : (newType.charAt(0).toUpperCase() + newType.slice(1)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v2/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to save provider');
      }
      const savedRes = await res.json();
      const savedProvider = savedRes.data;
      
      // Reset selected ID and reload
      const newId = savedProvider?.providerId || formData.providerId;
      if (newId) {
        setSelectedProviderId(newId);
      }
      await fetchProviders();
      setDetailMode('view');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm('Are you sure you want to remove this provider? The key will be deleted.')) return;
    try {
      const res = await fetch(`/api/v2/providers/${providerId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete provider');
      
      setSelectedProviderId(null);
      await fetchProviders();
    } catch (err: any) {
      alert('Failed to remove: ' + err.message);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v2/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId })
      });
      const data = await res.json();
      if (data.ok && data.data?.ok) {
        setTestResult({ ok: true, message: 'Connection tested successfully.' });
      } else {
        setTestResult({ ok: false, message: 'Connection failed: ' + (data.data?.message || data.error) });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: 'Failed to test: ' + err.message });
    } finally {
      setTesting(false);
    }
  };

  const selectedProvider = providers.find(p => p.providerId === selectedProviderId);

  const styles = `
    .zvd-providers-layout {
      display: flex;
      height: 100%;
      min-height: 480px;
      border: 1px solid var(--zvd-stroke-hairline);
      border-radius: 12px;
      overflow: hidden;
      background: var(--zvd-surface);
      box-shadow: var(--zvd-shadow-elevation);
    }
    .zvd-providers-master {
      width: 260px;
      border-right: 1px solid var(--zvd-stroke-hairline);
      background: var(--zvd-sidebar);
      display: flex;
      flex-direction: column;
    }
    .zvd-providers-master-header {
      padding: 16px;
      border-bottom: 1px solid var(--zvd-stroke-hairline);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zvd-providers-tabs {
      display: flex;
      background: var(--zvd-border-soft);
      padding: 3px;
      border-radius: 6px;
    }
    .zvd-providers-tab-btn {
      flex: 1;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      text-align: center;
      background: transparent;
      color: var(--zvd-muted);
      border: none;
      cursor: pointer;
      transition: all 120ms ease;
    }
    .zvd-providers-tab-btn--active {
      background: var(--zvd-surface);
      color: var(--zvd-text);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .zvd-providers-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zvd-provider-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      background: transparent;
      color: var(--zvd-text);
      border: none;
      text-align: left;
      transition: all 120ms ease;
    }
    .zvd-provider-item:hover {
      background: var(--zvd-border-soft);
    }
    .zvd-provider-item--active {
      background: var(--zvd-accent-soft);
      color: var(--zvd-accent);
    }
    .zvd-provider-item-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .zvd-provider-item-dot--active {
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e;
    }
    .zvd-provider-item-dot--inactive {
      background: var(--zvd-muted);
    }
    .zvd-provider-item-info {
      flex: 1;
      min-width: 0;
    }
    .zvd-provider-item-name {
      font-weight: 550;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .zvd-provider-item-type {
      font-size: 11px;
      color: var(--zvd-muted);
      margin-top: 1px;
    }
    .zvd-providers-master-footer {
      padding: 12px;
      border-top: 1px solid var(--zvd-stroke-hairline);
    }
    .zvd-providers-add-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      background: var(--zvd-accent);
      color: #fff;
      border: none;
      cursor: pointer;
      transition: opacity 120ms ease;
    }
    .zvd-providers-add-btn:hover {
      opacity: 0.9;
    }
    .zvd-providers-detail {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--zvd-surface);
      overflow-y: auto;
    }
    .zvd-providers-blank-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: var(--zvd-muted);
      text-align: center;
    }
    .zvd-providers-detail-header {
      padding: 24px;
      border-bottom: 1px solid var(--zvd-stroke-hairline);
      display: flex;
      justify-content: space-between;
      align-items: start;
    }
    .zvd-providers-detail-title-block h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 650;
      color: var(--zvd-text);
    }
    .zvd-providers-detail-title-block p {
      margin: 4px 0 0;
      font-size: 13px;
      color: var(--zvd-muted);
    }
    .zvd-providers-detail-actions {
      display: flex;
      gap: 8px;
    }
    .zvd-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 550;
      cursor: pointer;
      border: none;
      transition: all 120ms ease;
    }
    .zvd-btn-primary {
      background: var(--zvd-accent);
      color: #fff;
    }
    .zvd-btn-primary:hover {
      opacity: 0.9;
    }
    .zvd-btn-secondary {
      background: var(--zvd-sidebar);
      border: 1px solid var(--zvd-stroke-hairline);
      color: var(--zvd-text);
    }
    .zvd-btn-secondary:hover {
      background: var(--zvd-border-soft);
    }
    .zvd-btn-danger {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .zvd-btn-danger:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    .zvd-providers-detail-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 600px;
    }
    .zvd-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .zvd-field-group label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--zvd-muted);
    }
    .zvd-input, .zvd-select {
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--zvd-stroke-hairline);
      border-radius: 8px;
      padding: 0 12px;
      font-size: 13px;
      background: var(--zvd-sidebar);
      color: var(--zvd-text);
      outline: none;
      transition: border-color 120ms ease;
    }
    .zvd-input:focus, .zvd-select:focus {
      border-color: var(--zvd-accent);
    }
    .zvd-checkbox-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      cursor: pointer;
      user-select: none;
    }
    .zvd-checkbox-row input {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      accent-color: var(--zvd-accent);
    }
    .zvd-checkbox-row span {
      font-size: 13px;
      font-weight: 520;
    }
    .zvd-test-result-box {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
    }
    .zvd-test-result-box--success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .zvd-test-result-box--error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .zvd-loading-text {
      padding: 24px;
      color: var(--zvd-muted);
      font-size: 14px;
    }
    .zvd-oauth-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zvd-oauth-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border: 1px solid var(--zvd-stroke-hairline);
      border-radius: 12px;
      background: var(--zvd-sidebar);
    }
    .zvd-oauth-info h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .zvd-oauth-info p {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--zvd-muted);
    }
  `;

  if (loading) {
    return <div className="zvd-loading-text">Loading providers...</div>;
  }

  return (
    <div className="flex flex-col gap-4 mt-4 w-full">
      <style>{styles}</style>
      
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="zvd-providers-layout">
        {/* Left Column (Master List) */}
        <div className="zvd-providers-master">
          <div className="zvd-providers-master-header">
            <div className="zvd-providers-tabs">
              <button 
                type="button"
                className={`zvd-providers-tab-btn ${activeTab === 'keys' ? 'zvd-providers-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('keys')}
              >
                API Keys
              </button>
              <button 
                type="button"
                className={`zvd-providers-tab-btn ${activeTab === 'accounts' ? 'zvd-providers-tab-btn--active' : ''}`}
                onClick={() => setActiveTab('accounts')}
              >
                Accounts
              </button>
            </div>
          </div>

          {activeTab === 'keys' ? (
            <>
              <div className="zvd-providers-list">
                {providers.map(p => (
                  <button
                    key={p.providerId}
                    type="button"
                    className={`zvd-provider-item ${selectedProviderId === p.providerId ? 'zvd-provider-item--active' : ''}`}
                    onClick={() => handleSelectProvider(p)}
                  >
                    <div className={`zvd-provider-item-dot ${p.enabled ? 'zvd-provider-item-dot--active' : 'zvd-provider-item-dot--inactive'}`} />
                    <div className="zvd-provider-item-info">
                      <div className="zvd-provider-item-name">{p.displayName}</div>
                      <div className="zvd-provider-item-type">{p.type}</div>
                    </div>
                    <ChevronRight size={14} className="opacity-40" />
                  </button>
                ))}
              </div>
              <div className="zvd-providers-master-footer">
                <button 
                  type="button"
                  className="zvd-providers-add-btn" 
                  onClick={handleNewProvider}
                >
                  <Plus size={16} />
                  Add Provider
                </button>
              </div>
            </>
          ) : (
            <div className="zvd-providers-list" style={{ padding: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--zvd-muted)', lineHeight: '1.4' }}>
                Manage cloud authentication profiles for automatic synchronization.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (Details View) */}
        <div className="zvd-providers-detail">
          {activeTab === 'keys' ? (
            detailMode === 'view' && selectedProvider ? (
              // View mode details
              <>
                <div className="zvd-providers-detail-header">
                  <div className="zvd-providers-detail-title-block">
                    <h3>{selectedProvider.displayName}</h3>
                    <p>Type: {selectedProvider.type}</p>
                  </div>
                  <div className="zvd-providers-detail-actions">
                    <button 
                      type="button"
                      className="zvd-btn zvd-btn-secondary" 
                      onClick={() => setDetailMode('edit')}
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button 
                      type="button"
                      className="zvd-btn zvd-btn-danger" 
                      onClick={() => handleDelete(selectedProvider.providerId!)}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="zvd-providers-detail-body">
                  <div className="zvd-field-group">
                    <label>Base URL</label>
                    <div className="zvd-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--zvd-border-soft)' }}>
                      {selectedProvider.baseUrl || 'Default URL'}
                    </div>
                  </div>

                  {selectedProvider.defaultModel && (
                    <div className="zvd-field-group">
                      <label>Default Model</label>
                      <div className="zvd-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--zvd-border-soft)' }}>
                        {selectedProvider.defaultModel}
                      </div>
                    </div>
                  )}

                  <div className="zvd-field-group">
                    <label>Authentication Status</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      {selectedProvider.requiresApiKey ? (
                        selectedProvider.configured ? (
                          <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={16} /> Configured
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <XCircle size={16} /> Missing Credentials
                          </span>
                        )
                      ) : (
                        <span style={{ color: 'var(--zvd-muted)' }}>No API Key Required</span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      disabled={testing}
                      onClick={() => handleTestConnection(selectedProvider.providerId!)}
                      className="zvd-btn zvd-btn-secondary"
                    >
                      {testing ? 'Testing...' : 'Test Connection'}
                    </button>

                    {testResult && (
                      <div className={`zvd-test-result-box ${testResult.ok ? 'zvd-test-result-box--success' : 'zvd-test-result-box--error'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (detailMode === 'edit' || detailMode === 'create') ? (
              // Edit / Create mode form
              <>
                <div className="zvd-providers-detail-header">
                  <div className="zvd-providers-detail-title-block">
                    <h3>{detailMode === 'create' ? 'Add AI Provider' : `Edit ${formData.displayName}`}</h3>
                    <p>Specify connection options and model endpoints.</p>
                  </div>
                  <div className="zvd-providers-detail-actions">
                    <button 
                      type="button"
                      disabled={saving}
                      className="zvd-btn zvd-btn-primary" 
                      onClick={handleSave}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      type="button"
                      disabled={saving}
                      className="zvd-btn zvd-btn-secondary" 
                      onClick={() => {
                        if (detailMode === 'create' && providers.length > 0) {
                          setSelectedProviderId(providers[0].providerId || null);
                          setFormData({ ...providers[0], apiKey: '' });
                        }
                        setDetailMode('view');
                        setTestResult(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="zvd-providers-detail-body">
                  <div className="zvd-field-group">
                    <label>Provider Type</label>
                    <select
                      className="zvd-select"
                      value={formData.type}
                      onChange={e => handleTypeChange(e.target.value as any)}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai-compatible">Custom (OpenAI Compatible)</option>
                    </select>
                  </div>

                  <div className="zvd-field-group">
                    <label>Display Name</label>
                    <input
                      type="text"
                      className="zvd-input"
                      value={formData.displayName}
                      onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="e.g. OpenAI Production"
                    />
                  </div>

                  <div className="zvd-field-group">
                    <label>Base URL</label>
                    <input
                      type="text"
                      className="zvd-input"
                      value={formData.baseUrl || ''}
                      onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                      placeholder="e.g. https://api.openai.com/v1"
                    />
                  </div>

                  <div className="zvd-field-group">
                    <label>Default Model</label>
                    <input
                      type="text"
                      className="zvd-input"
                      value={formData.defaultModel || ''}
                      onChange={e => setFormData({ ...formData, defaultModel: e.target.value })}
                      placeholder="e.g. gpt-4o"
                    />
                  </div>

                  {formData.requiresApiKey && (
                    <div className="zvd-field-group">
                      <label>API Key / Secret</label>
                      <input
                        type="password"
                        className="zvd-input"
                        value={formData.apiKey || ''}
                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder={detailMode === 'edit' ? '•••••••• (Leave blank to keep current)' : 'sk-...'}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-2">
                    <label className="zvd-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                      />
                      <span>Enable this provider</span>
                    </label>

                    <label className="zvd-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.requiresApiKey}
                        onChange={e => setFormData({ ...formData, requiresApiKey: e.target.checked })}
                      />
                      <span>Requires API Key authentication</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div className="zvd-providers-blank-state">
                <Server size={48} className="mb-4 opacity-40" />
                <p>Select a provider from the list to view settings.</p>
              </div>
            )
          ) : (
            // Accounts OAuth tab view
            <>
              <div className="zvd-providers-detail-header">
                <div className="zvd-providers-detail-title-block">
                  <h3>Cloud Sync Accounts</h3>
                  <p>Link profiles to sync models and preferences automatically.</p>
                </div>
              </div>
              <div className="zvd-providers-detail-body">
                <div className="zvd-oauth-list">
                  <div className="zvd-oauth-row">
                    <div className="zvd-oauth-info">
                      <h4>Nous Profile</h4>
                      <p>Sync all provider keys and settings configurations in one click.</p>
                    </div>
                    <button type="button" className="zvd-btn zvd-btn-secondary">Connect</button>
                  </div>

                  <div className="zvd-oauth-row">
                    <div className="zvd-oauth-info">
                      <h4>Google Account</h4>
                      <p>Used to read and write context files and search indexes on Drive.</p>
                    </div>
                    <button type="button" className="zvd-btn zvd-btn-secondary">Connect</button>
                  </div>

                  <div className="zvd-oauth-row">
                    <div className="zvd-oauth-info">
                      <h4>GitHub OAuth</h4>
                      <p>Authorize repository push, pull, and issue editing permissions.</p>
                    </div>
                    <button type="button" className="zvd-btn zvd-btn-secondary">Connect</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
