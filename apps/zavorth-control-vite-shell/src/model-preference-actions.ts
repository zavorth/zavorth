import { escapeHtml } from './html-utils';

const API_BASE = '/api/providers/preference';

export async function fetchModelPreference(): Promise<any> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to fetch model preference: ${res.status}`);
  return res.json();
}

export async function updateModelPreference(input: {
  providerId: string;
  modelId?: string;
  routeId?: string;
  confirm?: boolean;
  dryRun?: boolean;
}): Promise<any> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update model preference: ${res.status}`);
  return res.json();
}

export function bindModelPreferenceEvents(refreshCallback: () => void): void {
  if (document.documentElement.dataset.modelPrefBound === '1') return;
  document.documentElement.dataset.modelPrefBound = '1';

  const form = document.getElementById('model-preference-form') as HTMLFormElement | null;
  const resultPanel = document.getElementById('pref-result-panel');

  if (!form || !resultPanel) return;

  // 1. Initial Load: Populate form fields from persisted preferences
  fetchModelPreference()
    .then((data) => {
      const pref = data?.preference;
      if (pref) {
        const providerSelect = document.getElementById('pref-provider') as HTMLSelectElement | null;
        const modelInput = document.getElementById('pref-model') as HTMLInputElement | null;
        const routeSelect = document.getElementById('pref-route') as HTMLSelectElement | null;

        if (providerSelect && pref.providerId) providerSelect.value = pref.providerId;
        if (modelInput && pref.modelId) modelInput.value = pref.modelId;
        if (routeSelect && pref.routeId) routeSelect.value = pref.routeId;
      }
    })
    .catch((err) => {
      console.error('[model-pref] failed to load initial preference', err);
    });

  // 2. Submit Event (Save Preference)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const providerId = (data.get('providerId') as string) || '';
    const modelId = (data.get('modelId') as string) || '';
    const routeId = (data.get('routeId') as string) || '';

    if (!providerId) return;

    try {
      const result = await updateModelPreference({
        providerId,
        modelId,
        routeId,
        confirm: true,
        dryRun: false,
      });

      resultPanel.style.display = 'block';
      resultPanel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:#34d399;">✅ Preference Saved Successfully</strong>
          <button class="cron-action-btn" type="button" id="btn-clear-pref-result">Clear</button>
        </div>
        <p style="margin:4px 0; color:rgba(255,255,255,0.7);">
          Active provider: <strong>${escapeHtml(result.preference?.providerId || 'none')}</strong><br/>
          Active model: <strong>${escapeHtml(result.preference?.modelId || 'none')}</strong><br/>
          Routing policy: <strong>${escapeHtml(result.preference?.routeId || 'none')}</strong>
        </p>
        <span style="font-size:11px; color:rgba(255,255,255,0.4);">Receipt ID: ${escapeHtml(result.receipt?.id || 'none')}</span>
      `;

      refreshCallback();
    } catch (err) {
      console.error('[model-pref] failed to save preference', err);
      resultPanel.style.display = 'block';
      resultPanel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:#f87171;">❌ Save Failed</strong>
          <button class="cron-action-btn" type="button" id="btn-clear-pref-result">Clear</button>
        </div>
        <p style="margin:4px 0; color:rgba(255,255,255,0.7);">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>
      `;
    }
  });

  // 3. Preview Button Click Event
  const previewBtn = document.getElementById('btn-preview-pref');
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      const data = new FormData(form);
      const providerId = (data.get('providerId') as string) || '';
      const modelId = (data.get('modelId') as string) || '';
      const routeId = (data.get('routeId') as string) || '';

      if (!providerId) return;

      try {
        const result = await updateModelPreference({
          providerId,
          modelId,
          routeId,
          confirm: false,
          dryRun: true,
        });

        const statusColor = result.status === 'denied' ? '#f87171' : result.status === 'preview' ? '#60a5fa' : '#34d399';
        const decisionText = result.receipt?.decision || result.decision || 'unknown';

        resultPanel.style.display = 'block';
        resultPanel.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:${statusColor};">🔍 Decision Preview (${escapeHtml(result.status || 'preview')})</strong>
            <button class="cron-action-btn" type="button" id="btn-clear-pref-result">Clear</button>
          </div>
          <p style="margin:4px 0; color:rgba(255,255,255,0.85); font-family:monospace; line-height:1.4;">
            - Proposed target: <strong>${escapeHtml(result.request?.providerId || 'none')}</strong><br/>
            - Model ID: <strong>${escapeHtml(result.request?.modelId || 'auto')}</strong><br/>
            - Routing decision: <strong>${escapeHtml(decisionText)}</strong><br/>
            - Approval status: <strong>${result.receipt?.approval?.satisfied ? 'Satisfied' : 'Pending Confirmation'}</strong><br/>
            - Reversible: <strong>${result.receipt?.safety?.reversible ? 'Yes' : 'No'}</strong>
          </p>
          <div style="margin-top:8px; padding:6px; background:rgba(255,255,255,0.03); border-radius:4px; font-size:12px; color:rgba(255,255,255,0.6);">
            💡 <strong>Next Action:</strong> ${escapeHtml(result.nextAction || 'Preview ready.')}
          </div>
        `;
      } catch (err) {
        console.error('[model-pref] failed to preview preference', err);
        resultPanel.style.display = 'block';
        resultPanel.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:#f87171;">❌ Preview Failed</strong>
            <button class="cron-action-btn" type="button" id="btn-clear-pref-result">Clear</button>
          </div>
          <p style="margin:4px 0; color:rgba(255,255,255,0.7);">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>
        `;
      }
    });
  }

  // 4. Delegated Click to Clear Result Panel
  document.addEventListener('click', (e) => {
    const clearBtn = (e.target as HTMLElement).closest<HTMLElement>('#btn-clear-pref-result');
    if (clearBtn && resultPanel) {
      resultPanel.style.display = 'none';
      resultPanel.innerHTML = '';
    }
  });
}
