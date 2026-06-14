import React, { useState, useEffect } from 'react';
import { ProviderSecretInput } from './ProviderSecretInput.js';

export interface ProviderConfigPayload {
  providerId?: string;
  type: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'openai-compatible';
  displayName: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
  requiresApiKey: boolean;
  apiKey?: string;
  secretRef?: string;
}

interface ProviderSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProviderConfigPayload) => Promise<void>;
  providerToEdit?: ProviderConfigPayload | null;
}

const DEFAULT_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434',
  'openai-compatible': ''
};

export function ProviderSetupModal({ isOpen, onClose, onSave, providerToEdit }: ProviderSetupModalProps) {
  const [formData, setFormData] = useState<ProviderConfigPayload>({
    type: 'openai-compatible',
    displayName: '',
    baseUrl: '',
    defaultModel: '',
    enabled: true,
    requiresApiKey: true,
    apiKey: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (providerToEdit) {
        setFormData({ ...providerToEdit, apiKey: '' });
      } else {
        setFormData({
          type: 'openai-compatible',
          displayName: '',
          baseUrl: '',
          defaultModel: '',
          enabled: true,
          requiresApiKey: true,
          apiKey: '',
        });
      }
      setError(null);
      setTestResult(null);
    }
  }, [isOpen, providerToEdit]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: ProviderConfigPayload['type']) => {
    const isLocal = newType === 'ollama';
    setFormData(prev => ({
      ...prev,
      type: newType,
      baseUrl: DEFAULT_URLS[newType] || '',
      requiresApiKey: !isLocal,
      displayName: prev.displayName || (newType.charAt(0).toUpperCase() + newType.slice(1)),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save provider.');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // For a real test without saving first, we'd need to send the payload.
      // But the backend testConnection expects providerId.
      // So testing before saving might fail if provider doesn't exist yet, 
      // unless we save first. Let's enforce save first or allow test if providerId exists.
      if (!formData.providerId) {
        throw new Error('Please save the provider before testing the connection.');
      }
      
      const res = await fetch('/api/v2/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: formData.providerId })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setTestResult({
        ok: data.data.ok,
        message: data.data.message || (data.data.ok ? 'Connection successful.' : 'Connection failed.')
      });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Failed to run test' });
    } finally {
      setTesting(false);
    }
  };

  const isOllama = formData.type === 'ollama';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-gray-700">
        <div className="px-5 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-100">
            {providerToEdit ? 'Editar Provider' : 'Novo Provider'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">×</button>
        </div>

        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {error && <div className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400">Tipo de Provider</label>
            <select
              value={formData.type}
              onChange={e => handleTypeChange(e.target.value as any)}
              disabled={!!providerToEdit}
              className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-100 disabled:opacity-50"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openai-compatible">OpenAI Compatible (Custom/Local)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400">Nome de Exibição</label>
            <input
              type="text"
              required
              value={formData.displayName}
              onChange={e => setFormData({ ...formData, displayName: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400">URL Base</label>
            <input
              type="url"
              required={formData.type !== 'openai' && formData.type !== 'anthropic' && formData.type !== 'google' && formData.type !== 'openrouter'}
              value={formData.baseUrl || ''}
              onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder={DEFAULT_URLS[formData.type] || "https://..."}
              className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400">Modelo Padrão (Opcional)</label>
            <input
              type="text"
              value={formData.defaultModel || ''}
              onChange={e => setFormData({ ...formData, defaultModel: e.target.value })}
              placeholder="Ex: gpt-4o, claude-3-opus, llama3..."
              className="bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              id="requiresApiKey"
              checked={formData.requiresApiKey}
              disabled={isOllama}
              onChange={e => setFormData({ ...formData, requiresApiKey: e.target.checked })}
              className="rounded bg-gray-900 border-gray-700 text-blue-500"
            />
            <label htmlFor="requiresApiKey" className={`text-sm ${isOllama ? 'text-gray-500' : 'text-gray-300'}`}>
              Requer autenticação (API Key)
            </label>
          </div>

          {formData.requiresApiKey && (
            <div className="mt-2 p-3 bg-gray-900/50 border border-gray-700/50 rounded-lg">
              <ProviderSecretInput
                value={formData.apiKey || ''}
                onChange={val => setFormData({ ...formData, apiKey: val })}
                hasExistingSecret={!!formData.secretRef}
              />
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
              className="rounded bg-gray-900 border-gray-700 text-blue-500"
            />
            <label htmlFor="enabled" className="text-sm text-gray-300">
              Provider Ativo
            </label>
          </div>

          {testResult && (
            <div className={`text-sm p-2 rounded ${testResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.message}
            </div>
          )}

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !formData.providerId}
              className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 transition-colors"
              title={!formData.providerId ? 'Salve o provider antes de testar' : ''}
            >
              {testing ? 'Testando...' : 'Testar Conexão'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm px-4 py-2 rounded text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="text-sm px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
