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
  type DesktopOnboardingProvider,
  type DesktopOnboardingStepId,
} from '../onboarding/desktopOnboarding';

interface OnboardingOverlayProps {
  isOpen: boolean;
  onCompleted: (notice?: string) => void;
  onSkip?: () => void;
  onStartWithSuggestion?(text: string): void;
  onEnableTrustedOperator?(enabled: boolean): void;
}

type ProviderType = DesktopOnboardingProvider;
type ProviderPhase = 'pick' | 'credentials' | 'model';

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

function trailLabel(id: DesktopOnboardingStepId): string {
  switch (id) {
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
}: OnboardingOverlayProps) {
  const [trailIndex, setTrailIndex] = useState(0);
  const [providerPhase, setProviderPhase] = useState<ProviderPhase>('pick');
  const [providerType, setProviderType] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [displayName, setDisplayName] = useState('OpenAI');

  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [trustedOperator, setTrustedOperator] = useState(() => getTrustedOperatorHint());

  const trailStep = DESKTOP_ONBOARDING_TRAIL[trailIndex] ?? DESKTOP_ONBOARDING_TRAIL[0];
  const starterAsk = t('onboarding.firstAskStarter') || DESKTOP_ONBOARDING_STARTER_ASK;

  useEffect(() => {
    if (isOnboardingComplete()) {
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
        setTestResult({ ok: true, message: t('onboarding.providerConnected') });
        setProviderPhase('model');
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

      setTimeout(() => setProviderPhase('model'), 500);
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
    setTrailIndex(prev => Math.min(prev + 1, DESKTOP_ONBOARDING_TRAIL.length - 1));
  };

  const goBack = () => {
    setError(null);
    if (trailStep.id === 'provider') {
      if (providerPhase === 'model') {
        setProviderPhase('credentials');
        return;
      }
      if (providerPhase === 'credentials') {
        setProviderPhase('pick');
        return;
      }
      return;
    }
    setTrailIndex(prev => Math.max(prev - 1, 0));
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

      // Persist trust hint as last-known preference
      setTrustedOperatorHint(trustedOperator);
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
    trailIndex > 0 || (trailStep.id === 'provider' && providerPhase !== 'pick');

  const providerNames: Record<ProviderType, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Gemini',
    openrouter: 'OpenRouter',
    ollama: 'Ollama (Local)',
  };

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
                    {step.optional ? (
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

          {trailStep.id === 'provider' && (
            <>
              {providerPhase === 'pick' && (
                <div className="zvd-onboarding-step-panel">
                  <h2 className="zvd-onboarding-step-title">{t('onboarding.welcomeTitle')}</h2>
                  <p className="zvd-onboarding-step-copy">{t('onboarding.providerPickBody')}</p>
                  <label className="zvd-onboarding-field-label">{t('onboarding.chooseProvider')}</label>
                  <div className="zvd-onboarding-providers-grid">
                    {(['openai', 'anthropic', 'google', 'openrouter', 'ollama'] as ProviderType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        className={`zvd-onboarding-provider-card ${providerType === type ? 'zvd-onboarding-provider-card--active' : ''}`}
                        onClick={() => handleProviderSelect(type)}
                      >
                        <IconServer size={22} aria-hidden="true" />
                        <h3>{providerNames[type]}</h3>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {providerPhase === 'credentials' && (
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

                  {testResult && (
                    <div className={`zvd-onboarding-test-status zvd-onboarding-test-status--${testResult.ok ? 'success' : 'error'}`}>
                      {testResult.ok ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              {providerPhase === 'model' && (
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

            {trailStep.id === 'provider' && providerPhase === 'pick' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                onClick={() => setProviderPhase('credentials')}
              >
                {t('onboarding.next')}
                <IconChevronRight size={16} aria-hidden="true" />
              </button>
            )}

            {trailStep.id === 'provider' && providerPhase === 'credentials' && (
              <button
                type="button"
                className="zvd-btn zvd-btn-primary"
                disabled={testing || (providerType !== 'ollama' && !apiKey)}
                onClick={handleSaveAndTest}
              >
                {testing ? (
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

            {trailStep.id === 'provider' && providerPhase === 'model' && (
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
