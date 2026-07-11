import { escapeHtml } from './html-utils';
import { createShellLogger, surfaceShellError } from './shell-debug';
import { translate } from './locale';

const log = createShellLogger('model-pref');
const API_BASE = '/api/providers/preference';

type ModelPreferenceInput = {
  providerId: string;
  modelId?: string;
  secondaryModelId?: string;
  routeId?: string;
  channelId?: string;
  confirm?: boolean;
  dryRun?: boolean;
  directWrite?: boolean;
};

export async function fetchModelPreference(): Promise<any> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to fetch model preference: ${res.status}`);
  return res.json();
}

export async function updateModelPreference(input: ModelPreferenceInput): Promise<any> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `Failed to update model preference: ${res.status}`);
  }
  return res.json();
}

function readForm(form: HTMLFormElement): ModelPreferenceInput {
  const data = new FormData(form);
  return {
    providerId: String(data.get('providerId') || '').trim(),
    modelId: String(data.get('modelId') || '').trim(),
    secondaryModelId: String(data.get('secondaryModelId') || '').trim(),
    routeId: String(data.get('routeId') || '').trim(),
    channelId: String(data.get('channelId') || '').trim(),
  };
}

function showResult(panel: HTMLElement, title: string, body: string, meta = ''): void {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="daily-route-result__head">
      <strong>${escapeHtml(translate(title))}</strong>
      <button class="cron-action-btn" type="button" id="btn-clear-pref-result">${escapeHtml(translate('Clear'))}</button>
    </div>
    <div>${body}</div>
    ${meta ? `<span class="daily-route-result__meta">${meta}</span>` : ''}
  `;
}

export function bindModelPreferenceEvents(refreshCallback: () => void): void {
  if (document.documentElement.dataset.modelPrefBound === '1') return;

  const form = document.getElementById('model-preference-form') as HTMLFormElement | null;
  const resultPanel = document.getElementById('pref-result-panel');
  if (!form || !resultPanel) return;
  document.documentElement.dataset.modelPrefBound = '1';

  fetchModelPreference()
    .then((data) => {
      const pref = data?.preference || {};
      const values: Record<string, unknown> = {
        'pref-provider': pref.providerId,
        'pref-model': pref.modelId,
        'pref-secondary-model': pref.secondaryModelId,
        'pref-route': pref.routeId,
        'pref-channel': data?.channel?.channelId,
      };
      Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (field && value) field.value = String(value);
      });
    })
    .catch((error) => {
      log.error('failed to load initial preference', error);
      surfaceShellError(
        translate('Model preference'),
        error instanceof Error ? error.message : translate('Could not load the saved model preference.'),
        'info',
      );
    });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = readForm(form);
    if (!input.providerId) return;

    try {
      const result = await updateModelPreference({
        ...input,
        confirm: true,
        dryRun: false,
        directWrite: true,
      });
      showResult(
        resultPanel,
        'Route saved',
        `<p>
          ${escapeHtml(translate('Primary provider'))}: <strong>${escapeHtml(result.preference?.providerId || 'none')}</strong><br/>
          ${escapeHtml(translate('Primary model'))}: <strong>${escapeHtml(result.preference?.modelId || 'none')}</strong><br/>
          ${escapeHtml(translate('Secondary model'))}: <strong>${escapeHtml(result.preference?.secondaryModelId || 'none')}</strong><br/>
          ${escapeHtml(translate('Primary channel'))}: <strong>${escapeHtml(result.channel?.channelId || input.channelId || 'none')}</strong>
        </p>`,
        `${escapeHtml(translate('Source'))}: ${escapeHtml(result.source || result.receipt?.id || 'preference')}`,
      );
      refreshCallback();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('failed to save preference', error);
      surfaceShellError(translate('Model preference'), message);
      showResult(resultPanel, 'Route not saved', `<p>${escapeHtml(message)}</p>`);
    }
  });

  document.getElementById('btn-preview-pref')?.addEventListener('click', async () => {
    const input = readForm(form);
    if (!input.providerId) return;

    try {
      const result = await updateModelPreference({
        ...input,
        confirm: false,
        dryRun: true,
      });
      const decision = result.receipt?.decision || result.decision || 'unknown';
      showResult(
        resultPanel,
        'Route preview',
        `<p class="mono">
          ${escapeHtml(translate('Provider'))}: <strong>${escapeHtml(result.request?.providerId || 'none')}</strong><br/>
          ${escapeHtml(translate('Model'))}: <strong>${escapeHtml(result.request?.modelId || 'none')}</strong><br/>
          ${escapeHtml(translate('Decision'))}: <strong>${escapeHtml(decision)}</strong><br/>
          ${escapeHtml(translate('Approval'))}: <strong>${escapeHtml(result.receipt?.approval?.satisfied ? 'satisfied' : 'pending')}</strong>
        </p>`,
        escapeHtml(result.nextAction || translate('Preview ready.')),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('failed to preview preference', error);
      surfaceShellError(translate('Model preference'), message);
      showResult(resultPanel, 'Preview unavailable', `<p>${escapeHtml(message)}</p>`);
    }
  });

  document.addEventListener('click', (event) => {
    if (!(event.target as HTMLElement).closest('#btn-clear-pref-result')) return;
    resultPanel.hidden = true;
    resultPanel.innerHTML = '';
  });
}
