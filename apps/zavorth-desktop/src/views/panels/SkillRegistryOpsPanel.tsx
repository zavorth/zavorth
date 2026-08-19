import { useCallback, useEffect, useState } from 'react';
import {
  getSkillRegistrySnapshot,
  postSkillRegistryAction,
  type SkillRegistryActionBody,
  type SkillRegistrySnapshot,
} from '../../apiClient';
import { PageFrame } from '../panelChrome';

type ActionLog = {
  at: string;
  action: string;
  ok: boolean;
  message: string;
};

type SkillRow = NonNullable<SkillRegistrySnapshot['skills']>[number];

function toneForSkill(skill: SkillRow): string {
  if (!skill.packageValid) return 'review';
  if (skill.signed) return 'live';
  return 'unsigned';
}

export function SkillRegistryOpsPanel() {
  const [snapshot, setSnapshot] = useState<SkillRegistrySnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<ActionLog[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [operatorConfirm, setOperatorConfirm] = useState(false);
  const [signingKey, setSigningKey] = useState('');

  const pushLog = useCallback((entry: ActionLog) => {
    setLog((prev) => [entry, ...prev].slice(0, 12));
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await getSkillRegistrySnapshot();
      if (!res.ok || !res.data?.snapshot) {
        setError(res.error || res.data?.error || 'Skill registry API unavailable (is runtime up?)');
        setSnapshot(null);
        return;
      }
      setSnapshot(res.data.snapshot);
      const first = res.data.snapshot.skills?.[0]?.id || null;
      setSelectedId((prev) => {
        if (prev && res.data?.snapshot?.skills?.some((s) => s.id === prev)) return prev;
        return first;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);
      try {
        const body: SkillRegistryActionBody = {
          action,
          skillId: selectedId || undefined,
          repoUrl: repoUrl.trim() || undefined,
          operatorConfirm,
          signingKey: signingKey.trim() || undefined,
          ...extra,
        };
        const res = await postSkillRegistryAction(body);
        const result = res.data?.result;
        const ok = Boolean(res.ok && (result?.ok !== false || action === 'refresh'));
        pushLog({
          at: new Date().toISOString(),
          action,
          ok: Boolean(result?.ok ?? res.ok),
          message:
            result?.message ||
            result?.error ||
            res.error ||
            res.data?.error ||
            (ok ? 'ok' : 'failed'),
        });
        if (res.data?.snapshot) {
          setSnapshot(res.data.snapshot);
        } else if (!res.ok) {
          setError(res.error || res.data?.error || 'Action failed');
        }
        if (result?.planPath) {
          pushLog({
            at: new Date().toISOString(),
            action: `${action}:artifact`,
            ok: true,
            message: `plan → ${result.planPath}`,
          });
        }
        if (result?.indexPath) {
          pushLog({
            at: new Date().toISOString(),
            action: `${action}:artifact`,
            ok: true,
            message: `index → ${result.indexPath}`,
          });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        pushLog({ at: new Date().toISOString(), action, ok: false, message: msg });
      } finally {
        setBusy(false);
      }
    },
    [operatorConfirm, pushLog, repoUrl, selectedId, signingKey],
  );

  const skills = snapshot?.skills || [];
  const selected = skills.find((s) => s.id === selectedId) || skills[0] || null;
  const stats = snapshot?.stats;

  return (
    <PageFrame
      eyebrow="OPS"
      title="Skill registry"
      description="Sign, verify, export index, and dry-run publish plans. Live git push stays CLI/operator only."
      meta={stats ? `${stats.total} skills · ${stats.signed} signed` : 'offline'}
      actions={
        <button type="button" className="zvd-btn" disabled={busy} onClick={() => void refresh()}>
          {busy ? '…' : 'Refresh'}
        </button>
      }
    >
      {error ? (
        <div className="zvd-capability-empty" role="alert">
          <strong>Registry API</strong>
          <span>{error}</span>
          <span className="zvd-muted">Expects runtime GET /api/skill-registry</span>
        </div>
      ) : null}

      <div className="zvd-capability-summary" aria-label="Registry stats">
        <div>
          <strong>{stats?.total ?? '—'}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{stats?.signed ?? '—'}</strong>
          <span>Signed</span>
        </div>
        <div>
          <strong>{stats?.packageValid ?? '—'}</strong>
          <span>Valid pkg</span>
        </div>
        <div>
          <strong>{snapshot?.env?.hasSigningKey ? 'yes' : 'no'}</strong>
          <span>Env key</span>
        </div>
      </div>

      <div className="zvd-capability-layout">
        <div className="zvd-capability-list" role="listbox" aria-label="Skills packages">
          {skills.length ? (
            skills.map((skill) => (
              <button
                type="button"
                role="option"
                key={skill.id}
                aria-selected={selected?.id === skill.id}
                className={`zvd-capability-row ${selected?.id === skill.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(skill.id || null)}
              >
                <span className="zvd-capability-row-icon" aria-hidden="true">
                  {skill.signed ? '✓' : '·'}
                </span>
                <span className="zvd-capability-row-copy">
                  <strong>{skill.name || skill.id}</strong>
                  <small>
                    {skill.version || '—'} · {skill.signatureMode}
                  </small>
                </span>
                <span className="zvd-capability-row-status">{toneForSkill(skill)}</span>
              </button>
            ))
          ) : (
            <div className="zvd-capability-empty">
              <strong>No skills/ packages</strong>
              <span>Add a folder under skills/ with SKILL.md (see registry-ops-fixture).</span>
            </div>
          )}
        </div>

        <aside className="zvd-capability-detail">
          {selected ? (
            <>
              <div className="zvd-capability-detail-heading">
                <span className="zvd-capability-detail-icon" aria-hidden="true">
                  R
                </span>
                <div>
                  <h2>{selected.name || selected.id}</h2>
                  <p>{selected.relativePath}</p>
                </div>
              </div>
              <p className="zvd-capability-description">
                {selected.description || 'Skill package under skills/.'}
              </p>
              <dl className="zvd-capability-meta">
                <div>
                  <dt>Signed</dt>
                  <dd>{selected.signed ? `yes (${selected.signatureMode})` : 'no'}</dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>
                    {selected.packageValid ? 'valid'
                      : (selected.packageErrors || []).join('; ') || 'invalid'}
                  </dd>
                </div>
                <div>
                  <dt>Risk</dt>
                  <dd>{selected.riskLevel}</dd>
                </div>
              </dl>

              <div className="zvd-registry-ops-form" style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                <label>
                  <span>Repo URL (plan only)</span>
                  <input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/org/skills"
                    disabled={busy}
                  />
                </label>
                <label>
                  <span>Signing key (optional if env set)</span>
                  <input
                    type="password"
                    value={signingKey}
                    onChange={(e) => setSigningKey(e.target.value)}
                    placeholder="ZAVORTH_SKILL_SIGNING_KEY"
                    disabled={busy}
                    autoComplete="off"
                  />
                </label>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={operatorConfirm}
                    onChange={(e) => setOperatorConfirm(e.target.checked)}
                    disabled={busy}
                  />
                  <span>Operator confirm (required for sign)</span>
                </label>
              </div>

              <div
                className="zvd-registry-ops-actions"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}
              >
                <button type="button" disabled={busy || !selected} onClick={() => void runAction('verify')}>
                  Verify
                </button>
                <button
                  type="button"
                  disabled={busy || !selected || !operatorConfirm}
                  onClick={() => void runAction('sign')}
                  title={!operatorConfirm ? 'Check operator confirm first' : 'Sign package'}
                >
                  Sign
                </button>
                <button type="button" disabled={busy || !selected} onClick={() => void runAction('publish_plan')}>
                  Publish plan
                </button>
                <button type="button" disabled={busy} onClick={() => void runAction('export')}>
                  Export index
                </button>
                <button type="button" disabled={busy} onClick={() => void runAction('trusted_hosts')}>
                  Trusted hosts
                </button>
              </div>
            </>
          ) : (
            <div className="zvd-capability-empty">
              <span>Select a skill package to run registry ops.</span>
            </div>
          )}
        </aside>
      </div>

      {snapshot?.trustedGitDomains?.length - (
        <section style={{ marginTop: '1rem' }} aria-label="Trusted hosts">
          <strong>Trusted hosts</strong>
          <p className="zvd-muted" style={{ margin: '0.25rem 0' }}>
            {snapshot.trustedGitDomains.join(', ')}
          </p>
        </section>
      ) : null}

      {log.length ? (
        <section style={{ marginTop: '1rem' }} aria-label="Action log">
          <strong>Recent actions</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
            {log.map((entry, i) => (
              <li key={`${entry.at}-${i}`} style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                <span>{entry.ok ? '✓' : '✗'}</span> {entry.action}: {entry.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="zvd-muted" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
        Docs: docs/product/skill-registry-ops.md · Fixture: skills/registry-ops-fixture
      </p>
    </PageFrame>
  );
}

export default SkillRegistryOpsPanel;
