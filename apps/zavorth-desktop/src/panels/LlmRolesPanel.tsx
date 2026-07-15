import React, { useCallback, useEffect, useState } from 'react';

type LlmRolesPayload = {
  ok?: boolean;
  surface?: string;
  scopeId?: string;
  statusText?: string;
  forceStrongActive?: boolean;
  health?: Array<{ severity?: string; message?: string }>;
  roles?: {
    default?: { provider: string; model: string } | null;
    strong?: { provider: string; model: string } | null;
    background?: { provider: string; model: string } | null;
  };
  error?: string;
};

async function fetchLlmRoles(userId = 'desktop'): Promise<LlmRolesPayload> {
  const res = await fetch(`/api/llm-roles?userId=${encodeURIComponent(userId)}&surface=desktop`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to load LLM roles (${res.status})`);
  }
  return res.json();
}

async function updateLlmRoles(body: Record<string, unknown>, userId = 'desktop'): Promise<LlmRolesPayload> {
  const res = await fetch(`/api/llm-roles?userId=${encodeURIComponent(userId)}&surface=desktop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `Failed to update LLM roles (${res.status})`);
  }
  return res.json();
}

/**
 * Desktop-native card for dual-role LLM preferences (same store as Control / chat surfaces).
 */
export function LlmRolesPanel({ userId = 'desktop' }: { userId?: string }) {
  const [data, setData] = useState<LlmRolesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchLlmRoles(userId);
      setData(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await updateLlmRoles(body, userId);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const fmt = (binding?: { provider: string; model: string } | null) =>
    binding ? `${binding.provider}/${binding.model}` : 'not set';

  return (
    <section className="desktop-llm-roles-panel" aria-label="LLM roles">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <strong>LLM roles</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Shared across Telegram, Discord, CLI, Control, and Desktop
          </div>
        </div>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void reload()}>
          Refresh
        </button>
      </header>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
        <div>
          <strong>Default:</strong> {fmt(data?.roles?.default)}
        </div>
        <div>
          <strong>Strong:</strong> {fmt(data?.roles?.strong)}
        </div>
        <div>
          <strong>Background:</strong> {fmt(data?.roles?.background)}
        </div>
        <div>
          <strong>Force strong:</strong> {data?.forceStrongActive ? 'on' : 'off'}
        </div>
        {data?.scopeId ? (
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            scope: {data.scopeId} · surface: {data.surface || 'desktop'}
          </div>
        ) : null}
      </div>

      {Array.isArray(data?.health) && data!.health!.length > 0 ? (
        <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12 }}>
          {data!.health!.map((issue, idx) => (
            <li key={`${issue.message}-${idx}`}>
              {issue.severity || 'info'}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void run({ action: 'setup' })}>
          Start setup
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void run({ action: 'forceStrong', enabled: true })}
        >
          Force strong on
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void run({ action: 'forceStrong', enabled: false })}
        >
          Force strong off
        </button>
      </div>

      {data?.statusText ? (
        <pre
          style={{
            marginTop: 12,
            padding: 8,
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            opacity: 0.85,
            maxHeight: 180,
            overflow: 'auto',
          }}
        >
          {data.statusText}
        </pre>
      ) : null}

      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        Chat: <code>/model setup</code> · <code>/strong on|off</code>
      </p>
      <LearnedKnowledgeDesktopHub userId={userId} />
    </section>
  );
}

type HubCard = {
  id: string;
  label: string;
  ready: boolean;
  summary: string;
  cli: string;
  slash: string;
  metrics?: Record<string, string | number | boolean | null>;
};

type DraftItem = {
  id?: string;
  title?: string;
  useCount?: number;
  revisions?: number;
  tools?: string[];
};

type StoryEvent = {
  id?: string;
  pillar?: string;
  at?: string;
  title?: string;
  snippet?: string;
};

type StoryPreview = {
  summary?: string;
  cli?: string;
  slash?: string;
  days?: number;
  eventCount?: number;
  events?: StoryEvent[];
};

type AdvancedBlock = {
  fileIndex?: {
    label?: string;
    summary?: string;
    cli?: string;
    available?: boolean;
    vaultPath?: string | null;
    fileCount?: number | null;
    directoryCount?: number | null;
    lastModifiedAt?: string | null;
    truncatedScan?: boolean;
    setupHint?: string;
    dockerConsentPath?: string;
  };
  dreamCycle?: {
    label?: string;
    summary?: string;
    cli?: string;
    slash?: string;
    schedulerCli?: string;
    previewOnly?: boolean;
    lastRunAt?: string | null;
    lastCandidateCount?: number | null;
    lastQuarantineCount?: number | null;
    lastStatus?: string | null;
    nextEligibleHint?: string;
  };
  preferenceNote?: string;
  preferenceSpineNote?: string;
};

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso).slice(0, 16);
  }
}

function pillarChip(pillar?: string): string {
  switch (pillar) {
    case 'workflows':
      return 'Workflows';
    case 'conversation':
      return 'Conversation';
    case 'about-you':
      return 'About you';
    case 'knowledge':
      return 'Knowledge';
    default:
      return pillar || 'Event';
  }
}

async function copyDesktopCommand(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type PromoteApiResult = {
  ok?: boolean;
  dryRun?: boolean;
  text?: string;
  title?: string | null;
  skillName?: string | null;
  error?: string;
  detail?: string;
  fallbackCommand?: string;
};

/** Real one-click promote for skill drafts (/learn promote N — not /learning candidates). */
async function promoteDraftViaApi(input: {
  userId?: string;
  ordinal: number;
  dryRun?: boolean;
}): Promise<PromoteApiResult> {
  const res = await fetch('/api/learning-loop/promote', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: input.userId || 'desktop',
      ordinal: input.ordinal,
      dryRun: Boolean(input.dryRun),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as PromoteApiResult;
  if (!res.ok || data?.ok === false) {
    const err = new Error(String(data?.detail || data?.error || `HTTP ${res.status}`)) as Error & {
      fallbackCommand?: string;
      status?: number;
    };
    err.fallbackCommand = data?.fallbackCommand || `/learn promote ${input.ordinal}${input.dryRun ? ' --dry-run' : ''}`;
    err.status = res.status;
    throw err;
  }
  return data;
}

function PromoteDraftActions({
  drafts,
  items,
  userId = 'desktop',
  onPromoted,
}: {
  drafts: number;
  items: DraftItem[];
  userId?: string;
  onPromoted?: () => void;
}) {
  const [flash, setFlash] = React.useState<string | null>(null);
  const [busyOrdinal, setBusyOrdinal] = React.useState<number | null>(null);
  if (drafts <= 0) return null;
  const cap = Math.min(5, Math.max(drafts, items.length));
  const onCopy = async (cmd: string) => {
    const ok = await copyDesktopCommand(cmd);
    setFlash(ok ? `Copied ${cmd}` : cmd);
    window.setTimeout(() => setFlash(null), 1400);
  };
  const onPromote = async (ordinal: number) => {
    const fallback = `/learn promote ${ordinal}`;
    setBusyOrdinal(ordinal);
    try {
      const result = await promoteDraftViaApi({ userId, ordinal });
      const title = result.title ? String(result.title).slice(0, 48) : `draft ${ordinal}`;
      const msg = result.skillName ? `Promoted: ${title} → ${result.skillName}` : `Promoted: ${title}`;
      setFlash(msg);
      window.setTimeout(() => setFlash(null), 2200);
      onPromoted?.();
    } catch (error: unknown) {
      const err = error as { message?: string; fallbackCommand?: string };
      const cmd = String(err?.fallbackCommand || fallback);
      const copied = await copyDesktopCommand(cmd);
      setFlash(`${String(err?.message || 'Promote failed')}${copied ? ` · copied ${cmd}` : ` · ${cmd}`}`);
      window.setTimeout(() => setFlash(null), 2800);
    } finally {
      setBusyOrdinal(null);
    }
  };
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 6,
        borderTop: '1px dashed var(--zvd-stroke-hairline, #555)',
      }}
    >
      <p className="muted" style={{ fontSize: 11, margin: '0 0 4px 0' }}>
        <strong>{drafts}</strong> {drafts === 1 ? 'skill draft ready to promote' : 'skill drafts ready to promote'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {Array.from({ length: Math.min(cap, 5) }, (_, idx) => {
          const i = idx + 1;
          const item = items[idx];
          const cmd = `/learn promote ${i}`;
          const label = item?.title ? `Promote ${i} · ${String(item.title).slice(0, 28)}` : `Promote ${i}`;
          return (
            <button
              key={cmd}
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '2px 8px' }}
              title={cmd}
              disabled={busyOrdinal != null}
              onClick={() => void onPromote(i)}
            >
              {busyOrdinal === i ? 'Promoting…' : label}
            </button>
          );
        })}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          title="/learn list"
          onClick={() => void onCopy('/learn list')}
        >
          List drafts
        </button>
      </div>
      {flash ? (
        <p className="muted" style={{ fontSize: 10, margin: '4px 0 0 0' }}>
          {flash}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 10, margin: '4px 0 0 0' }}>
          <code>/learn promote 1</code> · skill drafts, not /learning
        </p>
      )}
    </div>
  );
}

function LearnedKnowledgeDesktopHub({ userId = 'desktop' }: { userId?: string }) {
  const [oneLiner, setOneLiner] = React.useState('Loading…');
  const [cards, setCards] = React.useState<HubCard[]>([]);
  const [enabled, setEnabled] = React.useState(true);
  const [storyPreview, setStoryPreview] = React.useState<StoryPreview | null>(null);
  const [advanced, setAdvanced] = React.useState<AdvancedBlock | null>(null);
  const [draftItems, setDraftItems] = React.useState<DraftItem[]>([]);
  const [draftCount, setDraftCount] = React.useState(0);
  const [reloadToken, setReloadToken] = React.useState(0);

  const refreshDrafts = React.useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const hubP = fetch(`/api/knowledge/hub?userId=${encodeURIComponent(userId)}`).then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    });
    const loopP = fetch(`/api/learning-loop?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) return { drafts: 0, items: [] as DraftItem[] };
        const data = await res.json();
        const items: DraftItem[] = Array.isArray(data?.items) ? data.items : [];
        const drafts = Number(data?.drafts ?? data?.count ?? items.length ?? 0) || 0;
        return { drafts, items };
      })
      .catch(() => ({ drafts: 0, items: [] as DraftItem[] }));

    Promise.all([hubP, loopP])
      .then(([data, loop]) => {
        if (cancelled) return;
        setEnabled(data?.enabled !== false);
        setOneLiner(String(data?.oneLiner || 'Workflows, conversations, about you, and project knowledge.'));
        setCards(Array.isArray(data?.cards) ? data.cards : []);
        setDraftItems(loop.items);
        setDraftCount(loop.drafts);
        const story = data?.storyPreview;
        setStoryPreview(
          story && (story.summary || story.cli || (Array.isArray(story.events) && story.events.length)) ? story : null,
        );
        const adv = data?.advanced;
        setAdvanced(
          adv && (adv.fileIndex || adv.dreamCycle || adv.preferenceNote || adv.preferenceSpineNote) ? adv : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setOneLiner('Hub unavailable. Run zavorth knowledge status on this machine.');
          setCards([]);
          setStoryPreview(null);
          setAdvanced(null);
          setDraftItems([]);
          setDraftCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  const storyEvents = Array.isArray(storyPreview?.events) ? storyPreview.events : [];

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--zvd-stroke-hairline, #333)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>Learned knowledge</strong>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid var(--zvd-stroke-hairline, #555)',
          }}
        >
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {oneLiner}
      </p>
      {cards.map((c) => {
        const metricDrafts = Number(c.metrics?.drafts ?? 0) || 0;
        const drafts = c.id === 'workflows' ? Math.max(metricDrafts, draftCount) : 0;
        return (
          <div
            key={c.id}
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--zvd-stroke-hairline, #444)',
              opacity: c.ready ? 0.95 : 0.7,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 12 }}>{c.label}</strong>
              <span style={{ fontSize: 10, opacity: 0.8 }}>{c.ready ? 'Ready' : 'Setup'}</span>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 4, marginBottom: 0 }}>
              {c.summary}
            </p>
            <p className="muted" style={{ fontSize: 10, marginTop: 4, marginBottom: 0 }}>
              <code>{c.cli}</code>
            </p>
            <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
              <code>{c.slash}</code>
            </p>
            {c.id === 'workflows' ? (
              <PromoteDraftActions drafts={drafts} items={draftItems} userId={userId} onPromoted={refreshDrafts} />
            ) : null}
          </div>
        );
      })}
      {storyPreview ? (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px dashed var(--zvd-stroke-hairline, #555)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12 }}>This week</strong>
            {typeof storyPreview.eventCount === 'number' ? (
              <span className="muted" style={{ fontSize: 10 }}>
                {storyPreview.eventCount} events
              </span>
            ) : null}
            {storyPreview.days ? (
              <span className="muted" style={{ fontSize: 10 }}>
                {storyPreview.days}d
              </span>
            ) : null}
          </div>
          {storyPreview.summary ? (
            <p className="muted" style={{ fontSize: 11, marginTop: 4, marginBottom: 0 }}>
              {storyPreview.summary}
            </p>
          ) : null}
          {storyEvents.length > 0 ? (
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: 11 }}>
              {storyEvents.map((ev, idx) => (
                <li key={ev.id || `${ev.title}-${idx}`} style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      opacity: 0.85,
                      border: '1px solid var(--zvd-stroke-hairline, #666)',
                      borderRadius: 999,
                      padding: '0 6px',
                      marginRight: 4,
                    }}
                  >
                    {pillarChip(ev.pillar)}
                  </span>
                  <strong>{ev.title || 'Event'}</strong>
                  {ev.at ? (
                    <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
                      {formatWhen(ev.at)}
                    </span>
                  ) : null}
                  {ev.snippet ? (
                    <div className="muted" style={{ marginTop: 2 }}>
                      {ev.snippet}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 11, marginTop: 6, marginBottom: 0 }}>
              No events in this window yet.
            </p>
          )}
          {storyPreview.cli ? (
            <p className="muted" style={{ fontSize: 10, marginTop: 6, marginBottom: 0 }}>
              <code>{storyPreview.cli}</code>
            </p>
          ) : null}
          {storyPreview.slash ? (
            <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
              <code>{storyPreview.slash}</code>
            </p>
          ) : null}
        </div>
      ) : null}
      {advanced ? (
        <details
          open
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid var(--zvd-stroke-hairline, #444)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontSize: 12 }}>
            <strong>Advanced</strong>
            <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
              Knowledge
            </span>
          </summary>
          {advanced.fileIndex ? (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 11 }}>{advanced.fileIndex.label || 'File index'}</strong>
              <span className="muted" style={{ marginLeft: 6, fontSize: 10 }}>
                {advanced.fileIndex.available ? 'Ready' : 'Setup'}
              </span>
              <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                {[
                  typeof advanced.fileIndex.fileCount === 'number' ? `${advanced.fileIndex.fileCount} files` : null,
                  typeof advanced.fileIndex.directoryCount === 'number'
                    ? `${advanced.fileIndex.directoryCount} dirs`
                    : null,
                  advanced.fileIndex.lastModifiedAt ? `changed ${formatWhen(advanced.fileIndex.lastModifiedAt)}` : null,
                  advanced.fileIndex.truncatedScan ? 'scan capped' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {advanced.fileIndex.summary ? (
                <p className="muted" style={{ fontSize: 11, marginTop: 2, marginBottom: 0 }}>
                  {advanced.fileIndex.summary}
                </p>
              ) : null}
              {advanced.fileIndex.vaultPath ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.fileIndex.vaultPath}</code>
                </p>
              ) : null}
              {advanced.fileIndex.setupHint ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  {advanced.fileIndex.setupHint}
                </p>
              ) : null}
              {advanced.fileIndex.dockerConsentPath ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.fileIndex.dockerConsentPath}</code>
                </p>
              ) : null}
              {advanced.fileIndex.cli ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.fileIndex.cli}</code>
                </p>
              ) : null}
            </div>
          ) : null}
          {advanced.dreamCycle ? (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 11 }}>{advanced.dreamCycle.label || 'Dream cycle'}</strong>
              <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                {[
                  advanced.dreamCycle.previewOnly ? 'Preview only' : null,
                  advanced.dreamCycle.lastRunAt
                    ? `last run ${formatWhen(advanced.dreamCycle.lastRunAt)}`
                    : 'no preview run yet',
                  typeof advanced.dreamCycle.lastCandidateCount === 'number'
                    ? `candidates=${advanced.dreamCycle.lastCandidateCount}`
                    : null,
                  typeof advanced.dreamCycle.lastQuarantineCount === 'number'
                    ? `quarantine=${advanced.dreamCycle.lastQuarantineCount}`
                    : null,
                  advanced.dreamCycle.lastStatus || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {advanced.dreamCycle.summary ? (
                <p className="muted" style={{ fontSize: 11, marginTop: 2, marginBottom: 0 }}>
                  {advanced.dreamCycle.summary}
                </p>
              ) : null}
              {advanced.dreamCycle.nextEligibleHint ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  {advanced.dreamCycle.nextEligibleHint}
                </p>
              ) : null}
              {advanced.dreamCycle.cli ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.dreamCycle.cli}</code>
                </p>
              ) : null}
              {advanced.dreamCycle.slash ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.dreamCycle.slash}</code>
                </p>
              ) : null}
              {advanced.dreamCycle.schedulerCli ? (
                <p className="muted" style={{ fontSize: 10, marginTop: 2, marginBottom: 0 }}>
                  <code>{advanced.dreamCycle.schedulerCli}</code>
                </p>
              ) : null}
            </div>
          ) : null}
          {advanced.preferenceNote || advanced.preferenceSpineNote ? (
            <p className="muted" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
              {advanced.preferenceNote || advanced.preferenceSpineNote}
            </p>
          ) : null}
        </details>
      ) : null}
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
        CLI: <code>zavorth knowledge status</code> · Chat: <code>/knowledge</code> · <code>/learn promote 1</code>{' '}
        (skill drafts) · <code>/learning</code> (candidates)
      </p>
    </div>
  );
}
