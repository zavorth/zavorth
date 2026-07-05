import { useState, useEffect } from 'react';
import { IconSparkles, IconCheck, IconServer, IconChevronRight, IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { ProviderSecretInput } from './ProviderSecretInput';

interface OnboardingOverlayProps {
  isOpen: boolean;
  onCompleted: () => void;
}

type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama';

export function OnboardingOverlay({ isOpen, onCompleted }: OnboardingOverlayProps) {
  const [step, setStep] = useState(1);
  const [providerType, setProviderType] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [displayName, setDisplayName] = useState('OpenAI');
  
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');

  useEffect(() => {
    if (localStorage.getItem('zvd:onboarded') === 'true') {
      onCompleted();
    }
  }, [onCompleted]);

  if (!isOpen) return null;

  const handleProviderSelect = (type: ProviderType) => {
    setProviderType(type);
    const urls: Record<ProviderType, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      openrouter: 'https://openrouter.ai/api/v1',
      ollama: 'http://localhost:11434',
    };
    const names: Record<ProviderType, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google Gemini',
      openrouter: 'OpenRouter',
      ollama: 'Ollama Local',
    };
    setBaseUrl(urls[type]);
    setDisplayName(names[type]);
    setApiKey('');
    setTestResult(null);
    setError(null);
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.zavorthDesktop?.connectGooglePersonalOps();
      if (res?.ok) {
        setTestResult({ ok: true, message: 'Google Personal Ops conectado!' });
        setStep(3);
      } else {
        throw new Error(res?.error || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch('/api/v2/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: providerType,
          displayName,
          baseUrl,
          requiresApiKey: providerType !== 'ollama',
          apiKey: providerType !== 'ollama' ? apiKey : undefined,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const providerId = data.data?.providerId;
      if (!providerId) throw new Error('Falha ao obter ID do provider.');

      const testRes = await fetch('/api/v2/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const testData = await testRes.json();
      
      if (testData.ok && testData.data?.ok) {
        setTestResult({ ok: true, message: 'Conectado com sucesso!' });
        
        const capRes = await fetch('/api/runtime/capabilities');
        const capData = await capRes.json();
        if (capData.ok && capData.data?.providers?.selectableModelIds) {
          const mIds: string[] = capData.data.providers.selectableModelIds;
          const filtered = mIds.filter(id => id.startsWith(providerType));
          setModels(filtered);
          if (filtered.length > 0) {
            setSelectedModel(filtered[0]);
          }
        }
        
        setTimeout(() => setStep(3), 1000);
      } else {
        throw new Error(testData.data?.message || testData.error || 'Connection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar ou testar.');
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      if (selectedModel) {
        await fetch('/api/experience/runtime-state/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'route-model',
            approved: true,
            sessionId: 'desktop-main',
            source: 'zavorth-desktop-onboarding',
            payload: {
              dynamicRouting: {
                modelId: selectedModel,
                providerId: providerType,
                intent: 'onboarding-picker',
                reason: 'Onboarding selection',
                fallbackModelIds: models.filter(id => id !== selectedModel),
                risk: 'low',
              },
            },
          }),
        });
      }
      localStorage.setItem('zvd:onboarded', 'true');
      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Falha ao concluir onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="zvd-onboarding-overlay">
      <style>{`
        .zvd-onboarding-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #0f0f10;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5f5f7;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          animation: zvdFadeIn 300ms ease;
        }
        .zvd-onboarding-card {
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 20px;
          width: 90%;
          max-width: 580px;
          min-height: 480px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 30px 60px rgba(0,0,0,0.8);
          overflow: hidden;
          animation: zvdPopUp 400ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .zvd-onboarding-header {
          padding: 30px 40px;
          border-bottom: 1px solid #27272a;
          text-align: center;
        }
        .zvd-onboarding-header h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .zvd-onboarding-header h1 span {
          color: var(--zvd-accent, #d86b2a);
        }
        .zvd-onboarding-header p {
          margin: 8px 0 0;
          font-size: 14px;
          color: #a1a1aa;
        }
        .zvd-onboarding-body {
          padding: 30px 40px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .zvd-onboarding-footer {
          padding: 20px 40px;
          background: #121214;
          border-top: 1px solid #27272a;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .zvd-onboarding-dots {
          display: flex;
          gap: 8px;
        }
        .zvd-onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3f3f46;
          transition: background 250ms ease;
        }
        .zvd-onboarding-dot--active {
          background: var(--zvd-accent, #d86b2a);
        }
        .zvd-onboarding-button {
          background: var(--zvd-accent, #d86b2a);
          border: none;
          color: #fff;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: opacity 150ms ease;
        }
        .zvd-onboarding-button:hover:not(:disabled) {
          opacity: 0.9;
        }
        .zvd-onboarding-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .zvd-onboarding-button--secondary {
          background: transparent;
          border: 1px solid #3f3f46;
          color: #d4d4d8;
        }
        .zvd-onboarding-providers-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        .zvd-onboarding-provider-card {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 12px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 200ms ease;
        }
        .zvd-onboarding-provider-card:hover {
          border-color: #3f3f46;
          background: #242426;
        }
        .zvd-onboarding-provider-card--active {
          border-color: var(--zvd-accent, #d86b2a);
          background: rgba(216, 107, 42, 0.05);
        }
        .zvd-onboarding-provider-card h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
        }
        .zvd-onboarding-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .zvd-onboarding-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .zvd-onboarding-form-group label {
          font-size: 12px;
          font-weight: 650;
          color: #a1a1aa;
        }
        .zvd-onboarding-input {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 10px 14px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .zvd-onboarding-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-onboarding-test-status {
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
        }
        .zvd-onboarding-test-status--success {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .zvd-onboarding-test-status--error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .zvd-onboarding-model-select {
          background: #202022;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }
        .zvd-onboarding-model-select:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        @keyframes zvdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zvdPopUp {
          from { transform: scale(0.95) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
      <div className="zvd-onboarding-card">
        <div className="zvd-onboarding-header">
          <h1>Zavorth<span>Desktop</span></h1>
          <p>
            {step === 1 && 'Welcome. Let us configure your first artificial intelligence provider.'}
            {step === 2 && 'Insira suas credenciais para conectar.'}
            {step === 3 && 'Escolha o modelo principal e comece a produzir.'}
          </p>
        </div>

        <div className="zvd-onboarding-body">
          {error && (
            <div className="zvd-onboarding-test-status zvd-onboarding-test-status--error mb-4">
              <IconAlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-3">Escolha um Provedor</label>
                <div className="zvd-onboarding-providers-grid">
                  {(['openai', 'anthropic', 'google', 'openrouter', 'ollama'] as ProviderType[]).map(type => (
                    <div
                      key={type}
                      className={`zvd-onboarding-provider-card ${providerType === type ? 'zvd-onboarding-provider-card--active' : ''}`}
                      onClick={() => handleProviderSelect(type)}
                    >
                      <IconServer size={24} className="text-gray-400" />
                      <h3>
                        {type === 'openai' && 'OpenAI'}
                        {type === 'anthropic' && 'Anthropic'}
                        {type === 'google' && 'Google Gemini'}
                        {type === 'openrouter' && 'OpenRouter'}
                        {type === 'ollama' && 'Ollama (Local)'}
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="zvd-onboarding-form">
              <div className="zvd-onboarding-form-group">
                <label>Nome do Provedor</label>
                <input
                  type="text"
                  className="zvd-onboarding-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              {providerType !== 'ollama' ? (
                <div className="zvd-onboarding-form-group">
                  <label>Chave de API</label>
                  <ProviderSecretInput
                    value={apiKey}
                    onChange={setApiKey}
                    hasExistingSecret={false}
                  />
                  {providerType === 'google' && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-400 block mb-2">Ou conecte sua conta Google:</span>
                      <button
                        type="button"
                        onClick={handleOAuthConnect}
                        className="zvd-onboarding-button zvd-onboarding-button--secondary text-xs"
                        disabled={loading}
                      >
                        {loading ? 'Conectando...' : 'Autenticar com Google'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="zvd-onboarding-form-group">
                  <label>Ollama Base URL</label>
                  <input
                    type="url"
                    className="zvd-onboarding-input"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              {testResult && (
                <div className={`zvd-onboarding-test-status zvd-onboarding-test-status--${testResult.ok ? 'success' : 'error'}`}>
                  {testResult.ok ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="zvd-onboarding-form">
              <div className="zvd-onboarding-form-group">
                <label>Default Model</label>
                {models.length > 0 ? (
                  <select
                    className="zvd-onboarding-model-select"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                  >
                    {models.map(id => (
                      <option key={id} value={id}>
                        {id.split(':')[1] || id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-gray-400 italic">
                    No model detected. Zavorth will configure a default intelligence model for you automatically.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="zvd-onboarding-footer">
          <div className="zvd-onboarding-dots">
            {[1, 2, 3].map(i => (
              <span
                key={i}
                className={`zvd-onboarding-dot ${step === i ? 'zvd-onboarding-dot--active' : ''}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                className="zvd-onboarding-button zvd-onboarding-button--secondary"
                onClick={() => setStep(prev => prev - 1)}
              >
                Voltar
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                className="zvd-onboarding-button"
                onClick={() => setStep(2)}
              >
                Continuar
                <IconChevronRight size={16} />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="zvd-onboarding-button"
                disabled={testing || (providerType !== 'ollama' && !apiKey)}
                onClick={handleSaveAndTest}
              >
                {testing ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    Salvar e Testar
                    <IconChevronRight size={16} />
                  </>
                )}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="zvd-onboarding-button"
                disabled={loading}
                onClick={handleFinish}
              >
                {loading ? 'Finalizando...' : 'Entrar no Zavorth'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
