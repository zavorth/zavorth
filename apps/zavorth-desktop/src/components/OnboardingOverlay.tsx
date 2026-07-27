import { useState, useEffect } from 'react';
import {
  IconCheck,
  IconServer,
  IconChevronRight,
  IconChevronLeft,
  IconLoader2,
  IconAlertCircle,
  IconShieldCheck,
  IconBroadcast,
  IconMessageCircle,
} from '@tabler/icons-react';
import { ProviderSecretInput } from './ProviderSecretInput';

import { apiRequest } from '../apiClient';
import { t } from '../i18n';
import {
  DESKTOP_ONBOARDING_TRAIL,
  DESKTOP_ONBOARDING_AUDIENCES,
  DESKTOP_ONBOARDING_STARTER_ASK,
  DESKTOP_TRUST_MODE_KEY,
  buildProviderConnectionRequest,
  buildModelRoutingRequest,
  normalizeSelectableModels,
  markOnboardingComplete,
  isOnboardingComplete,
  setTrustedOperatorHint,
  getTrustedOperatorHint,
  markOnboardingCelebration,
  setOnboardingAudience,
  getOnboardingAudience,
  starterAskForAudience,
  type DesktopOnboardingAudienceId,
  type DesktopOnboardingProvider,
  type DesktopOnboardingStepId,
} from '../onboarding/desktopOnboarding';

interface OnboardingOverlayProps {
  isOpen: boolean;
  onCompleted: (notice?: string) => void;
  onSkip?: () => void;
  onStartWithSuggestion?(text: string): void;
  onEnableTrustedOperator?(enabled: boolean): void;
  /** Persist experience profile (personal / developer / business) for the session. */
  onAudienceSelected?(audience: DesktopOnboardingAudienceId): void;
}

type ProviderType = DesktopOnboardingProvider;
type ProviderStep = 'pick' | 'credentials' | 'model';

const PROVIDER_CATALOG: Array<{ id: ProviderType; name: string; baseUrl: string; summary: string; recommended?: boolean }> = [
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', summary: 'Multiple models with a single key.', recommended: true },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', summary: 'GPT and reasoning models.' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', summary: 'Claude models.' },
  { id: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', summary: 'Gemini and multimodal models.' },
  { id: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', summary: 'Grok models via API.' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', summary: 'Reasoning and code.' },
  { id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', summary: 'Hosted Mistral models.' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', summary: 'Low-latency inference.' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', summary: 'Wide open-source model catalog.' },
  { id: 'perplexity', name: 'Perplexity', baseUrl: 'https://api.perplexity.ai', summary: 'Models with connected search.' },
  { id: 'cohere', name: 'Cohere', baseUrl: 'https://api.cohere.com/v2', summary: 'Enterprise generation and retrieval.' },
  { id: 'azure', name: 'Azure OpenAI', baseUrl: 'https://YOUR_RESOURCE.openai.azure.com', summary: 'Enterprise Azure endpoint.' },
  { id: 'ollama', name: 'Ollama local', baseUrl: 'http://localhost:11434', summary: 'local models on this machine.' },
  { id: 'custom', name: 'Custom endpoint', baseUrl: 'http://127.0.0.1:8000/v1', summary: 'Any OpenAI-compatible API.' },
];

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

function trailLabel(id: DesktopOnboardingStepId): string {
  switch (id) {
    case 'audience':
      return t('onboarding.stepAudience');
    case 'provider':
      return t('onboarding.stepProvider');
    case 'trust':
      return t('onboarding.stepTrust');
    case 'channel':
      return t('onboarding.stepChannel');
    case 'first-ask':
      return t('onboarding.stepFirstAsk');
    default:
      return id;
  }
}

export function OnboardingOverlay({
  isOpen,
  onCompleted,
  onSkip,
  onStartWithSuggestion,
  onEnableTrustedOperator,
  onAudienceSelected,
}: OnboardingOverlayProps) {
  const [trailIndex, setTrailIndex] = useState(0);
  const [audience, setAudience] = useState<DesktopOnboardingAudienceId>(() => getOnboardingAudience());
  const [providerStep, setProviderStep] = useState<ProviderStep>('pick');
  const [providerType, setProviderType] = useState<ProviderType>('openrouter');
  const [providerQuery, setProviderQuery] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [displayName, setDisplayName] = useState('OpenRouter');

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [trustedOperator, setTrustedOperator] = useState(() => getTrustedOperatorHint());

  const trailStep = DESKTOP_ONBOARDING_TRAIL[trailIndex] ?? DESKTOP_ONBOARDING_TRAIL[0];
  const starterAsk = starterAskForAudience(audience, t)
    || t('onboarding.firstAskStarter')
    || DESKTOP_ONBOARDING_STARTER_ASK;

  const applyAudience = (next: DesktopOnboardingAudienceId) => {
    setAudience(next);
    setOnboardingAudience(next);
    onAudienceSelected?.(next);
  };

  useEffect(() => {
    if (isOnboardingComplete()) {
      onCompleted();
    }
  }, [onCompleted]);

  if (!isOpen) return null;

  const handleProviderSelect = (type: ProviderType) => {
    setProviderType(type);
    const provider = PROVIDER_CATALOG.find(item => item.id === type) || PROVIDER_CATALOG[0];
    setBaseUrl(provider.baseUrl);
    setDisplayName(provider.name);
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
        setTestResult({ ok: true, message: t('onboarding.providerConnected') });
        setProviderStep('model');
      } else {
        throw new Error(res?.error || 'Connection failed.');
      }
    } catch (err: unknown) {
      setError(errorMessage(err, t('onboarding.providerAuthError')));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      if (!window.zavorthDesktop?.apiRequest) {
        throw new Error(t('onboarding.bridgeUnavailable'));
      }

      const providerRequest = buildProviderConnectionRequest({
        type: providerType,
        displayName,
        baseUrl,
        apiKey: providerType !== 'ollama' ? apiKey : undefined,
      });
      const createResult = await apiRequest<{ providerId?: string; data?: { providerId?: string } }>(providerRequest);
      if (!createResult.ok) {
        throw new Error(createResult.error || t('onboarding.providerSaveFailed'));
      }

      const created = createResult.data as { providerId?: string; data?: { providerId?: string } } | null;
      const providerId = String(created?.providerId || created?.data?.providerId || '').trim();
      if (!providerId) {
        throw new Error(t('onboarding.providerIdFailed'));
      }

      const testResultApi = await apiRequest<{ ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } }>({
        method: 'POST',
        path: '/api/v2/providers/test-connection',
        body: { providerId },
        timeoutMs: 30000,
      });
      const testPayload = testResultApi.data as { ok?: boolean; message?: string; data?: { ok?: boolean; message?: string } } | null;
      const testOk = Boolean(testResultApi.ok && (testPayload?.ok || testPayload?.data?.ok || testPayload?.data === undefined));
      if (!testOk && testResultApi.ok === false) {
        throw new Error(testResultApi.error || testPayload?.message || testPayload?.data?.message || 'Connection failed.');
      }

      setTestResult({
        ok: true,
        message: testPayload?.message || testPayload?.data?.message || t('onboarding.providerConnected'),
      });

      const capResult = await apiRequest<{ providers?: { selectableModelIds?: string[] }; data?: unknown }>({
        method: 'GET',
        path: '/api/runtime/capabilities',
        timeoutMs: 15000,
      });
      const filtered = normalizeSelectableModels(capResult.data, providerType);
      const rawIds = Array.isArray((capResult.data as { providers?: { selectableModelIds?: unknown } } | null)?.providers?.selectableModelIds)
        ? ((capResult.data as { providers: { selectableModelIds: unknown[] } }).providers.selectableModelIds as unknown[])
            .filter((id): id is string => typeof id === 'string')
        : filtered;
      const resolvedModels = filtered.length > 0
        ? filtered
        : rawIds.filter(id => id.includes(providerType) || id.startsWith(`${providerType}:`));
      setModels(resolvedModels);
      if (resolvedModels.length > 0) {
        setSelectedModel(resolvedModels[0]);
      }

      setTimeout(() => setProviderStep('model'), 500);
    } catch (err: unknown) {
      const message = errorMessage(err, t('onboarding.providerTestFailed'));
      setError(message);
      setTestResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  const applyTrustedOperator = (enabled: boolean) => {
    setTrustedOperator(enabled);
    setTrustedOperatorHint(enabled);
    onEnableTrustedOperator?.(enabled);
  };

  const advanceTrail = () => {
    setError(null);
    setTrailIndex(prev => Math.min(prev + 1, DESKTOP_ONBOARDING_TRAIL.length ? 1));
  };

  const goBack = () => {
    setError(null);
    if (trailStep.id === 'provider') {
      if (providerStep === 'model') {
        setProviderStep('credentials');
        return;
      }
      if (providerStep === 'credentials') {
        setProviderStep('pick');
        return;
      }
      return;
    }
    setTrailIndex(prev => Math.max(prev ? 1, 0));
  };

  const finishOnboarding = async (opts?: { startWithSuggestion?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      if (selectedModel) {
        const routeRequest = buildModelRoutingRequest({
          selectedModel,
          providerType,
          fallbackModelIds: models.filter(id => id !== selectedModel),
        });
        const routeResult = await apiRequest(routeRequest);
        if (!routeResult.ok) {
          throw new Error(routeResult.error || t('onboarding.modelRouteFailed'));
        }
      }

      // Persist trust hint + audience as last-known preference
      setTrustedOperatorHint(trustedOperator);
      setOnboardingAudience(audience);
      onAudienceSelected?.(audience);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DESKTOP_TRUST_MODE_KEY, trustedOperator ? 'true' : 'false');
      }
      onEnableTrustedOperator?.(trustedOperator);

      markOnboardingComplete();
      markOnboardingCelebration();

      const notice = t('onboarding.celebration');
      onCompleted(notice);

      if (opts?.startWithSuggestion && onStartWithSuggestion) {
        onStartWithSuggestion(starterAsk);
      }
    } catch (err: unknown) {
      setError(errorMessage(err, t('onboarding.finishFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      return;
    }
    markOnboardingComplete();
    onCompleted(t('onboarding.celebration'));
  };

  const canGoBack =
    trailIndex > 0 || (trailStep.id === 'provider' && providerStep !== 'pick');

  const visibleProviders = PROVIDER_CATALOG.filter(provider => {
    const q = providerQuery.trim().toLowerCase();
    return !q || `${provider.name} ${provider.summary} ${provider.id}`.toLowerCase().includes(q);
  });

  return (
    <div className="zvd-onboarding-overlay zvd-onboarding-shell" role="dialog" aria-modal="true" aria-labelledby="zvd-onboarding-title">
      <div className="zvd-onboarding-card">
        <div className="zvd-onboarding-header">
          <div className="zvd-onboarding-brand">
            <img src="./zavorth-mascot.svg" alt="" width={36} height={36} className="zvd-onboarding-kael" />
            <h1 id="zvd-onboarding-title">
              Zavorth<span>Desktop</span>
            </h1>
          </div>
          <p className="zvd-onboarding-welcome">
            {trailStep.id === 'audience' && t('onboarding.audienceBody')}
            {trailStep.id === 'provider' && t('onboarding.welcomeBody')}
            {trailStep.id === 'trust' && t('onboarding.trustExplain')}
            {trailStep.id === 'channel' && t('onboarding.channelExplain')}
            {trailStep.id === 'first-ask' && t('onboarding.firstAskBody')}
          </p>

          <nav className="zvd-onboarding-trail" aria-label={t('onboarding.trailAria')}>
            {DESKTOP_ONBOARDING_TRAIL.map((step, index) => {
              const active = index === trailIndex;
              const done = index < trailIndex;
              return (
                <div
                  key={step.id}
                  className={[
                    'zvd-onboarding-trail-step',
                    active ? 'is-active' : '',
                    done ? 'is-done' : '',
                    step.optional ? 'is-optional' : '',
                  ].filter(Boolean).join(' ')}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="zvd-onboarding-trail-dot" aria-hidden="true">
                    {done ? <IconCheck size={12} stroke={2.5} /> : index + 1}
                  </span>
                  <span className="zvd-onboarding-trail-label">
                    {trailLabel(step.id)}
                    {step.optional - (
                      <span className="zvd-onboarding-optional-tag"> · {t('onboarding.optional')}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </nav>
          <div className="zvd-onboarding-dots" aria-hidden="true">
            {DESKTOP_ONBOARDING_TRAIL.map((step, index) => (
              <span
                key={step.id}
                className={`zvd-onboarding-dot ${index === trailIndex ? 'zvd-onboarding-dot--active' : ''} ${index < trailIndex ? 'zvd-onboarding-dot--done' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="zvd-onboarding-body">
          {error && (
            <div className="zvd-onboarding-test-status zvd-onboarding-test-status--error">
              <IconAlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {trailStep.id === 'audience' && (
            <div className="zvd-onboarding-step-panel">
              <h2 className="zvd-onboarding-step-title">{t('onboarding.stepAudience')}</h2>
              <p className="zvd-onboarding-step-copy">{t('onboarding.audienceBody')}</p>
              <div className="zvd-onboarding-providers-grid" role="listbox" aria-label={t('onboarding.stepAudience')}>
                {DESKTOP_ONBOARDING_AUDIENCES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={audience === option.id}
                    className={`zvd-onboarding-provider-card ${audience === option.id ? 'zvd-onboarding-provider-card--active' : ''}`}
                    onClick={() => applyAudience(option.id)}
                  >
                    <IconMessageCircle size={18} aria-hidden="true" />
                    <span>
                      <h3>{t(option.titleKey)}</h3>
                      <small>{t(option.bodyKey)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {trailStep.id === 'provider' && (
            <>
              {providerStep === 'pick' && (
                <div className="zvd-onboarding-step-panel">
                  <h2 className="zvd-onboarding-step-title">{t('onboarding.welcomeTitle')}</h2>
                  <p className="zvd-onboarding-step-copy">{t('onboarding.providerPickBody')}</p>
                  <div className="zvd-onboarding-provider-toolbar">
                    <label className="zvd-onboarding-field-label">{t('onboarding.chooseProvider')}</label>
                    <input className="zvd-onboarding-provider-search" value={providerQuery} onChange={event => setProviderQuery(event.target.value)} placeholder="Search provider" />
                  </div>
                  <div className="zvd-onboarding-providers-grid">
                    {visibleProviders.map(provider => (
                      <button
                        key={provider.id}
                        type="button"
                        className={`zvd-onboarding-provider-card ${providerType === provider.id ? 'zvd-onboarding-provider-card--active' : ''}`}
                        onClick={() => handleProviderSelect(provider.id)}
                      >
                        <IconServer size={18} aria-hidden="true" />
                        <span><h3>{provider.name}</h3><small>{provider.summary}</small></span>
                        {provider.recommended ? <em>Recommended</em> : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {providerStep === 'credentials' && (
                <div className="zvd-onboarding-form">
                  <h2 className="zvd-onboarding-step-title">{t('onboarding.providerCredentialsTitle')}</h2>
                  <div className="zvd-onboarding-form-group">
                    <label htmlFor="zvd-onboarding-display-name">{t('onboarding.providerName')}</label>
                    <input
                      id="zvd-onboarding-display-name"
                      type="text"
                      className="zvd-onboarding-input"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                    />
                  </div>

                  {providerType !== 'ollama' ? (
                    <div className="zvd-onboarding-form-group">
                      <label>{t('onboarding.apiKey')}</label>
                      <ProviderSecretInput
                        value={apiKey}
                        onChange={setApiKey}
                        hasExistingSecret={false}
                      />
                      {providerType === 'google' && (
                        <div className="zvd-onboarding-oauth">
                          <span className="zvd-onboarding-muted">{t('onboarding.orGoogle')}</span>
                          <button
                            type="button"
                            onClick={handleOAuthConnect}
                            className="zvd-btn zvd-btn-secondary zvd-btn-sm"
                            disabled={loading}
                          >
                            {loading ? t('onboarding.connecting') : t('onboarding.authGoogle')}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="zvd-onboarding-form-group">
                      <label htmlFor="zvd-onboarding-base-url">{t('onboarding.ollamaUrl')}</label>
                      <input
                        id="zvd-onboarding-base-url"
                        type="url"
                        className="zvd-onboarding-input"
                        value={baseUrl}
                        onChange={e => setBaseUrl(e.target.value)}
                      />
                    </div>
                  )}

                  {providerType !== 'ollama' ? (
                    <div className="zvd-onboarding-form-group">
                      <label htmlFor="zvd-onboarding-base-url">Endpoint</label>
                      <input id="zvd-onboarding-base-url" type="url" className="zvd-onboarding-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
                    </div>
                  ) : null}

                  {testResult && (
                    <div className={`zvd-onboarding-test-status zvd-onboarding-test-status--${testResult.ok ? 'success' : 'error'}`}>
                      {testResult.ok ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              {providerStep === 'model' && (
                <div className="zvd-onboarding-form">
                  <h2 className="zvd-onboarding-step-title">{t('onboarding.chooseModel')}</h2>
                  <p className="zvd-onboarding-step-copy">{t('onboarding.modelBody')}</p>
                  <div className="zvd-onboarding-form-group">
                    <label htmlFor="zvd-onboarding-model">{t('onboarding.defaultModel')}</label>
                    {models.length > 0 ? (
                      <select
                        id="zvd-onboarding-model"
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
                      <p className="zvd-onboarding-muted zvd-onboarding-italic">
                        {t('onboarding.noModelDetected')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {trailStep.id === 'trust' && (
            <div className="zvd-onboarding-step-panel">
              <div className="zvd-onboarding-icon-badge" aria-hidden="true">
                <IconShieldCheck size={28} />
              </div>
              <h2 className="zvd-onboarding-step-title">{t('onboarding.stepTrust')}</h2>
              <p className="zvd-onboarding-step-copy">{t('onboarding.trustExplain')}</p>
              <ul className="zvd-onboarding-bullets">
                <li>{t('onboarding.trustReviewBullet')}</li>
                <li>{t('onboarding.trustProofBullet')}</li>
                <li>{t('onboarding.trustRedLaneBullet')}</li>
              </ul>
              <label className="zvd-onboarding-toggle">
                <input
                  type="checkbox"
                  checked={trustedOperator}
                  onChange={e => applyTrustedOperator(e.target.checked)}
                />
                <span>
                  <strong>{t('onboarding.trustToggle')}</strong>
                  <span className="zvd-onboarding-muted">{t('onboarding.trustToggleHint')}</span>
                </span>
              </label>
            </div>
          )}

          {trailStep.id === 'channel' && (
            <div className="zvd-onboarding-step-panel">
              <div className="zvd-onboarding-icon-badge" aria-hidden="true">
                <IconBroadcast size={28} />
              </div>
              <h2 className="zvd-onboarding-step-title">{t('onboarding.stepChannel')}</h2>
              <p className="zvd-onboarding-step-copy">{t('onboarding.channelExplain')}</p>
              <p className="zvd-onboarding-muted">{t('onboarding.channelTip')}</p>
            </div>
          )}

          {trailStep.id === 'first-ask' && (
            <div className="zvd-onboarding-step-panel">
              <div className="zvd-onboarding-icon-badge" aria-hidden="true">
                <IconMessageCircle size={28} />
              </div>
              <h2 className="zvd-onboarding-step-title">{t('onboarding.stepFirstAsk')}</h2>
              <p className="zvd-onboarding-step-copy">{t('onboarding.firstAskBody')}</p>
              <blockquote className="zvd-onboarding-starter">
                “{starterAsk}”
              </blockquote>
            </div>
          )}
        </div>

        <div className="zvd-onboarding-footer">
          <button
            type="button"
            className="zvd-btn zvd-btn-ghost zvd-btn-sm"
            onClick={handleSkip}
            title={t('onboarding.skip')}
          >
            {t('onboarding.skip')}
          </button>

          <div className="zvd-onboarding-footer-actions">
            {canGoBack && (
              <button
                type="button"
                className="zvd-btn zvd-btn-secondary"
                onClick={goBack}
              >
                <IconChevronLeft size={16} aria-hidden="true" />
                {t('onboarding.back')}
              </button>
            )}

            {trailStep.id === 'audience' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                onClick={() => {
                  setOnboardingAudience(audience);
                  onAudienceSelected?.(audience);
                  advanceTrail();
                }}
              >
                {t('onboarding.next')}
                <IconChevronRight size={16} aria-hidden="true" />
              </button>
            )}

            {trailStep.id === 'provider' && providerStep === 'pick' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                onClick={() => setProviderStep('credentials')}
              >
                {t('onboarding.next')}
                <IconChevronRight size={16} aria-hidden="true" />
              </button>
            )}

            {trailStep.id === 'provider' && providerStep === 'credentials' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                disabled={testing || (providerType !== 'ollama' && !apiKey)}
                onClick={handleSaveAndTest}
              >
                {testing - (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    {t('onboarding.testing')}
                  </>
                ) : (
                  <>
                    {t('onboarding.saveAndTest')}
                    <IconChevronRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>
            )}

            {trailStep.id === 'provider' && providerStep === 'model' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                onClick={advanceTrail}
              >
                {t('onboarding.next')}
                <IconChevronRight size={16} aria-hidden="true" />
              </button>
            )}

            {trailStep.id === 'trust' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                onClick={advanceTrail}
              >
                {t('onboarding.next')}
                <IconChevronRight size={16} aria-hidden="true" />
              </button>
            )}

            {trailStep.id === 'channel' && (
              <>
                <button
                  type="button"
                  className="zvd-btn zvd-btn-secondary"
                  onClick={advanceTrail}
                >
                  {t('onboarding.openChannelsLater')}
                </button>
                <button
                  type="button"
                  className="zvd-btn zvd-btn-primary"
                  onClick={advanceTrail}
                >
                  {t('onboarding.skip')}
                  <IconChevronRight size={16} aria-hidden="true" />
                </button>
              </>
            )}

            {trailStep.id === 'first-ask' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                disabled={loading}
                onClick={() => void finishOnboarding({ startWithSuggestion: true })}
              >
                {loading ? t('onboarding.finishing') : t('onboarding.firstAskCta')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
