/**
 * Skill Registry Ops panel wiring for Control (sector-skills).
 * Talks to runtime GET/POST /api/skill-registry*.
 */

type SkillRow = {
  id?: string;
  name?: string;
  version?: string | null;
  signed?: boolean;
  signatureMode?: string;
  packageValid?: boolean;
  riskLevel?: string;
  description?: string | null;
};

type Snapshot = {
  skills?: SkillRow[];
  stats?: {
    total?: number;
    signed?: number;
    packageValid?: number;
  };
  env?: { hasSigningKey?: boolean };
  trustedGitDomains?: string[];
};

function resolveApiBase(): string {
  try {
    const fromWindow = (window as unknown as { ZAVORTH_API_BASE?: string }).ZAVORTH_API_BASE;
    if (fromWindow) return String(fromWindow).replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  // Same-origin relative (control shell proxied to runtime) or default local host.
  return '';
}

async function apiGet(path: string): Promise<Record<string, unknown>> {
  const base = resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data.error || res.statusText || `HTTP ${res.status}`));
  }
  return data;
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const base = resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && data.ok !== true) {
    const result = data.result as { error?: string; message?: string } | undefined;
    throw new Error(String(result?.error || result?.message || data.error || res.statusText || `HTTP ${res.status}`));
  }
  return data;
}

function setStat(root: HTMLElement, key: string, value: string) {
  const el = root.querySelector(`[data-skill-registry-stat="${key}"]`);
  if (el) el.textContent = value;
}

function appendLog(root: HTMLElement, line: string) {
  const log = root.querySelector('[data-skill-registry-log]') as HTMLElement | null;
  if (!log) return;
  const prev = log.textContent || '';
  log.textContent = `${line}\n${prev}`.trim().slice(0, 2000);
}

function renderList(root: HTMLElement, skills: SkillRow[], selectedId: string | null, onSelect: (id: string) => void) {
  const list = root.querySelector('[data-skill-registry-list]') as HTMLElement | null;
  if (!list) return;
  list.innerHTML = '';
  if (!skills.length) {
    const p = document.createElement('p');
    p.className = 'daily-muted';
    p.setAttribute('data-skill-registry-empty', '');
    p.textContent = 'No skills/ packages found. Add skills/registry-ops-fixture or run export after signing.';
    list.appendChild(p);
    return;
  }
  for (const skill of skills) {
    const id = skill.id || skill.name || '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `daily-settings-row${selectedId === id ? ' is-active' : ''}`;
    btn.setAttribute('data-skill-registry-item', id);
    btn.innerHTML = `<div><strong>${escapeHtml(skill.name || id)}</strong><span>${escapeHtml(
      `${skill.version || '—'} · ${skill.signed ? `signed (${skill.signatureMode || 'hmac'})` : 'unsigned'} · risk ${skill.riskLevel || '...'}`,
    )}</span></div>`;
    btn.addEventListener('click', () => onSelect(id));
    list.appendChild(btn);
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setActionEnabled(root: HTMLElement, enabled: boolean, selected: boolean) {
  root.querySelectorAll('[data-skill-registry-action]').forEach((node) => {
    const btn = node as HTMLButtonElement;
    const action = btn.getAttribute('data-skill-registry-action') || '';
    if (action === 'export' || action === 'trusted_hosts') {
      btn.disabled = !enabled;
      return;
    }
    if (action === 'sign') {
      const confirm = root.querySelector('[data-skill-registry-operator-confirm]') as HTMLInputElement | null;
      btn.disabled = !enabled || !selected || !confirm?.checked;
      return;
    }
    btn.disabled = !enabled || !selected;
  });
}

export function initSkillRegistryOpsUi() {
  const root = document.querySelector('[data-skill-registry-ops]') as HTMLElement | null;
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  let selectedId: string | null = null;
  let busy = false;

  const applySnapshot = (snapshot: Snapshot) => {
    setStat(root, 'total', String(snapshot.stats?.total ?? snapshot.skills?.length ?? 0));
    setStat(root, 'signed', String(snapshot.stats?.signed ?? 0));
    setStat(root, 'packageValid', String(snapshot.stats?.packageValid ?? 0));
    setStat(root, 'hasSigningKey', snapshot.env?.hasSigningKey ? 'yes' : 'no');
    const skills = snapshot.skills || [];
    if (selectedId && !skills.some((s) => (s.id || s.name) === selectedId)) {
      selectedId = skills[0]?.id || skills[0]?.name || null;
    }
    if (!selectedId && skills[0]) {
      selectedId = skills[0].id || skills[0].name || null;
    }
    renderList(root, skills, selectedId, (id) => {
      selectedId = id;
      renderList(root, skills, selectedId, (next) => {
        selectedId = next;
        setActionEnabled(root, !busy, Boolean(selectedId));
        renderList(root, skills, selectedId, () => undefined);
      });
      setActionEnabled(root, !busy, Boolean(selectedId));
    });
    setActionEnabled(root, !busy, Boolean(selectedId));
  };

  const refresh = async () => {
    if (busy) return;
    busy = true;
    setActionEnabled(root, false, Boolean(selectedId));
    try {
      const data = await apiGet('/api/skill-registry');
      const snapshot = (data.snapshot || {}) as Snapshot;
      applySnapshot(snapshot);
      appendLog(root, `refresh ok · ${snapshot.stats?.total ?? 0} package(s)`);
    } catch (error: unknown) {
      appendLog(root, `refresh fail · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
      setActionEnabled(root, true, Boolean(selectedId));
    }
  };

  const runAction = async (action: string) => {
    if (busy) return;
    busy = true;
    setActionEnabled(root, false, Boolean(selectedId));
    try {
      const confirm = root.querySelector('[data-skill-registry-operator-confirm]') as HTMLInputElement | null;
      const body: Record<string, unknown> = {
        action,
        skillId: selectedId || undefined,
        operatorConfirm: Boolean(confirm?.checked),
      };
      const data = await apiPost('/api/skill-registry/actions', body);
      const result = (data.result || {}) as {
        ok?: boolean;
        message?: string;
        error?: string;
        planPath?: string;
        indexPath?: string;
      };
      const snapshot = (data.snapshot || {}) as Snapshot;
      if (snapshot.skills) applySnapshot(snapshot);
      appendLog(
        root,
        `${action} ${result.ok === false ? 'fail' : 'ok'} · ${result.message || result.error || ''}${
          result.planPath ? ` · ${result.planPath}` : ''
        }${result.indexPath ? ` · ${result.indexPath}` : ''}`,
      );
    } catch (error: unknown) {
      appendLog(root, `${action} fail · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
      setActionEnabled(root, true, Boolean(selectedId));
    }
  };

  root.querySelector('[data-skill-registry-refresh]')?.addEventListener('click', () => {
    void refresh();
  });

  root.querySelector('[data-skill-registry-operator-confirm]')?.addEventListener('change', () => {
    setActionEnabled(root, !busy, Boolean(selectedId));
  });

  root.querySelectorAll('[data-skill-registry-action]').forEach((node) => {
    node.addEventListener('click', () => {
      const action = (node as HTMLElement).getAttribute('data-skill-registry-action') || '';
      if (!action) return;
      void runAction(action);
    });
  });

  // Soft auto-refresh when the skills sector is visible.
  void refresh();
}
