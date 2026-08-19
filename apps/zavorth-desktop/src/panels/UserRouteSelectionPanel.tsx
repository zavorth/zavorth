import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listUserSelectionChannels,
  listUserSelectionProviders,
  type UserSelectionChannelOption,
  type UserSelectionProviderOption,
} from '../selection/userSelectionCatalog';
import { t } from '../i18n';

type SelectionState = {
  providerId: string;
  modelId: string;
  secondaryModelId: string;
  channelId: string;
};

const STORAGE_KEY = 'zvd:user-route-selection';

function readLocalDraft(): Partial<SelectionState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SelectionState>;
  } catch {
    return {};
  }
}

function writeLocalDraft(state: SelectionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // local draft is best-effort
  }
}

/**
 * Durable primary / secondary / channel pickers bound to the same preference
 * files the runtime reads through the authenticated preference API.
 */
export function UserRouteSelectionPanel() {
  const providers = useMemo(() => listUserSelectionProviders(), []);
  const channels = useMemo(() => listUserSelectionChannels(), []);
  const [state, setState] = useState<SelectionState>(() => {
    const draft = readLocalDraft();
    return {
      providerId: draft.providerId || '',
      modelId: draft.modelId || '',
      secondaryModelId: draft.secondaryModelId || '',
      // Empty = not configured (never invent "desktop" as a silent default).
      channelId: draft.channelId || '',
    };
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const modelSuggestions = useMemo(() => {
    const match = providers.find((entry) => entry.id === state.providerId);
    return match?.models || [];
  }, [providers, state.providerId]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/providers/preference');
      if (res.ok) {
        const data = await res.json();
        const pref = data?.preference || {};
        // Trust server nulls — do not rehydrate empty fields from local draft.
        const next: SelectionState = {
          providerId: String(pref.providerId ?? ''),
          modelId: String(pref.modelId ?? ''),
          secondaryModelId: String(pref.secondaryModelId ?? ''),
          channelId: data?.channel?.channelId != null
            ? String(data.channel.channelId)
            : '',
        };
        setState(next);
        writeLocalDraft(next);
        setStatus('idle');
        setMessage('');
        return;
      }
      setStatus('idle');
      setMessage(t('route.loadFallback'));
    } catch {
      setStatus('idle');
      setMessage(t('route.runtimeUnavailable'));
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exthere isustive-deps -- load once on mount
  }, []);

  const save = async () => {
    if (!state.providerId.trim()) {
      setStatus('error');
      setMessage(t('route.chooseProvider'));
      return;
    }
    setStatus('saving');
    writeLocalDraft(state);
    try {
      const res = await fetch('/api/providers/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: state.providerId.trim(),
          modelId: state.modelId.trim() || null,
          secondaryModelId: state.secondaryModelId.trim() || null,
          channelId: state.channelId.trim() || null,
          // Persist channel only when the user picked one (never invent desktop).
          setChannel: Boolean(state.channelId.trim()),
          confirm: true,
          directWrite: true,
        }),
      });
      if (!res.ok) {
        throw new Error(t('route.saveFailed'));
      }
      setStatus('saved');
      setMessage(t('route.saved'));
    } catch {
      setStatus('error');
      setMessage(`${t('route.saveFailed')} ${t('route.localDraftKept')}`);
    }
  };

  return (
    <section className="zvd-user-route-selection" aria-labelledby="zvd-user-route-title">
      <div className="zvd-user-route-selection__head">
        <h3 id="zvd-user-route-title">{t('route.title')}</h3>
        <p>
          {t('route.description')}
        </p>
      </div>

      <div className="zvd-user-route-selection__grid">
        <label className="zvd-user-route-field">
          <span>
            {t('route.primaryProvider')}
          </span>
          <select
            className="zvd-select"
            value={state.providerId}
            onChange={(event) => {
              const providerId = event.target.value;
              const match = providers.find((entry) => entry.id === providerId);
              setState((prev) => ({
                ...prev,
                providerId,
                modelId: prev.modelId || match?.models[0] || '',
              }));
            }}
          >
            <option value="">{t('route.notConfigured')}</option>
            {providers.map((entry: UserSelectionProviderOption) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label className="zvd-user-route-field">
          <span>
            {t('route.primaryModel')}
          </span>
          <input
            className="zvd-input"
            list="zvd-primary-models"
            value={state.modelId}
            onChange={(event) => setState((prev) => ({ ...prev, modelId: event.target.value }))}
            placeholder={t('route.primaryModelPlaceholder')}
          />
          <datalist id="zvd-primary-models">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        <label className="zvd-user-route-field">
          <span>
            {t('route.secondaryModel')}
          </span>
          <input
            className="zvd-input"
            list="zvd-secondary-models"
            value={state.secondaryModelId}
            onChange={(event) => setState((prev) => ({ ...prev, secondaryModelId: event.target.value }))}
            placeholder={t('route.secondaryModelPlaceholder')}
          />
          <datalist id="zvd-secondary-models">
            {modelSuggestions.map((model) => (
              <option key={`sec-${model}`} value={model} />
            ))}
          </datalist>
        </label>

        <label className="zvd-user-route-field">
          <span>
            {t('route.primaryChannel')}
          </span>
          <select
            className="zvd-select"
            value={state.channelId}
            onChange={(event) => setState((prev) => ({ ...prev, channelId: event.target.value }))}
          >
            <option value="">{t('route.notConfigured')}</option>
            {channels.map((entry: UserSelectionChannelOption) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="zvd-user-route-selection__actions">
        <button
          type="button"
          className="zvd-btn zvd-btn-primary"
          disabled={status === 'saving' || status === 'loading'}
          onClick={() => void save()}
        >
          {status === 'saving' ? t('route.saving') : t('route.save')}
        </button>
        <button
          type="button"
          className="zvd-btn zvd-btn-secondary"
          disabled={status === 'loading'}
          onClick={() => void load()}
        >
          {t('route.reload')}
        </button>
        {message ? (
          <span className={`zvd-user-route-selection__message${status === 'error' ? ' is-error' : ''}`} role={status === 'error' ? 'alert' : 'status'}>
            {message}
          </span>
        ) : null}
      </div>
    </section>
  );
}
