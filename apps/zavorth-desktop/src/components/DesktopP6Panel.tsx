import { useEffect, useState } from 'react';
import {
  deferDesktopUpdate,
  getAuditLog,
  getDesktopTrustStatus,
  getDesktopUpdateStatus,
  installDesktopUpdate,
  rollbackDesktopUpdate,
  runRuntimeDoctor,
  setDesktopSafeMode,
} from '../apiClient';
import type { DesktopAuditEntry, DesktopTrustSnapshot } from '../global';
import type { DesktopUpdateStatus } from '../desktop-state/desktopUpdate';
import type { RuntimeDoctorSnapshot } from '../desktop-state/runtimeDoctor';

export function DesktopP6Panel(props: {
  section?: 'doctor' | 'updates' | 'trust';
  onStartRuntime?: () => void | Promise<void>;
  onRepairAccess?: () => void | Promise<void>;
}) {
  const [doctor, setDoctor] = useState<RuntimeDoctorSnapshot | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [trust, setTrust] = useState<DesktopTrustSnapshot | null>(null);
  const [auditEntries, setAuditEntries] = useState<DesktopAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastResumeAt, setLastResumeAt] = useState('');
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextDoctor, nextUpdate, nextTrust, nextAudit] = await Promise.all([
        runRuntimeDoctor().catch(() => null),
        getDesktopUpdateStatus().catch(() => null),
        getDesktopTrustStatus().catch(() => null),
        getAuditLog().catch(() => null),
      ]);
      if (nextDoctor) setDoctor(nextDoctor);
      if (nextUpdate) setUpdateStatus(nextUpdate);
      if (nextTrust) setTrust(nextTrust);
      if (nextAudit?.entries) setAuditEntries(nextAudit.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load desktop health.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    const off = window.zavorthDesktop?.onPowerResume?.((event) => {
      setLastResumeAt(event.at);
      if (event.doctor) setDoctor(event.doctor);
      void loadAll();
    });
    return () => off?.();
  }, []);

  const runUpdateAction = async (action: 'defer' | 'install' | 'rollback') => {
    setLoading(true);
    setError('');
    try {
      const next = action === 'defer'
        ? await deferDesktopUpdate()
        : action === 'install'
          ? await installDesktopUpdate()
          : await rollbackDesktopUpdate();
      setUpdateStatus(next);
      const audit = await getAuditLog().catch(() => null);
      if (audit?.entries) setAuditEntries(audit.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update action failed.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSafeMode = async () => {
    const nextEnabled = !trust?.safeMode.enabled;
    setLoading(true);
    try {
      const next = await setDesktopSafeMode(nextEnabled, nextEnabled ? 'Enabled from Desktop P6 trust panel.' : 'Disabled from Desktop P6 trust panel.');
      setTrust(next);
      const audit = await getAuditLog().catch(() => null);
      if (audit?.entries) setAuditEntries(audit.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Safe mode action failed.');
    } finally {
      setLoading(false);
    }
  };

  const section = props.section || 'doctor';

  return (
    <div className="zvd-p6-panel" data-p6-section={section}>
      <div className="zvd-p6-toolbar">
        <div>
          <h3>{sectionTitle(section)}</h3>
          <p>Instalacao, update, confianca e recovery ficam visiveis no dia a dia.</p>
        </div>
        <button type="button" className="zvd-settings-ghost" onClick={loadAll} disabled={loading}>
          {loading ? 'Atualizando...' : 'Revalidar'}
        </button>
      </div>

      {error && <div className="zvd-settings-alert">{error}</div>}

      {(section === 'doctor' || !props.section) && (
        <section className="zvd-p6-section">
          <div className="zvd-p6-section-head">
            <strong>Runtime Doctor</strong>
            <span>{doctor?.summary.message || 'Execute o doctor para revisar o desktop.'}</span>
          </div>
          <div className="zvd-p6-check-grid">
            {doctor?.checks.map(check => (
              <article key={check.id} className="zvd-p6-check" data-status={check.status}>
                <span>{check.status}</span>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
                {check.actionLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      if (check.id === 'backend') void props.onStartRuntime?.();
                      if (check.id === 'permissions') void props.onRepairAccess?.();
                    }}
                  >
                    {check.actionLabel}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {(section === 'updates' || !props.section) && (
        <section className="zvd-p6-section">
          <div className="zvd-p6-section-head">
            <strong>Auto-update</strong>
            <span>{updateStatus?.message || 'Status de update indisponivel.'}</span>
          </div>
          {updateStatus && (
            <>
              <div className="zvd-p6-update-row">
                <span>Atual: {updateStatus.currentVersion}</span>
                <span>Ultima: {updateStatus.latestVersion}</span>
                <span>Canal: {updateStatus.channel}</span>
                <span>Estado: {updateStatus.state}</span>
              </div>
              <ul className="zvd-p6-release-notes">
                {updateStatus.releaseNotes.map(note => <li key={note}>{note}</li>)}
              </ul>
              <div className="zvd-p6-actions">
                <button type="button" className="zvd-settings-ghost" disabled={!updateStatus.canDownloadLater || loading} onClick={() => void runUpdateAction('defer')}>
                  Baixar depois
                </button>
                <button type="button" className="zvd-settings-primary" disabled={!updateStatus.canInstallNow || loading} onClick={() => void runUpdateAction('install')}>
                  Instalar agora
                </button>
                <button type="button" className="zvd-settings-ghost" disabled={!updateStatus.canRollback || loading} onClick={() => void runUpdateAction('rollback')}>
                  Rollback
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {(section === 'trust' || !props.section) && (
        <section className="zvd-p6-section">
          <div className="zvd-p6-section-head">
            <strong>Hardening e confianca</strong>
            <span>{trust?.remoteDisplay.reason || 'Carregando sinais de seguranca.'}</span>
          </div>
          {trust && (
            <>
              <div className="zvd-p6-trust-grid">
                {trust.sensitivePermissions.map(item => (
                  <article key={item.id} data-status={item.status}>
                    <strong>{item.label}</strong>
                    <span>{item.status}</span>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
              <div className="zvd-p6-safe-mode">
                <div>
                  <strong>Modo seguro</strong>
                  <span>{trust.safeMode.reason}</span>
                </div>
                <button type="button" className="zvd-settings-primary" onClick={toggleSafeMode} disabled={loading}>
                  {trust.safeMode.enabled ? 'Desativar modo seguro' : 'Ativar modo seguro'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="zvd-p6-section">
        <div className="zvd-p6-section-head">
          <strong>Recovery pos-sleep</strong>
          <span>{lastResumeAt ? `Ultimo resume em ${new Date(lastResumeAt).toLocaleTimeString()}` : 'O desktop revalida runtime, provider e sessoes ao voltar do sleep.'}</span>
        </div>
        <div className="zvd-p6-audit">
          {auditEntries.length === 0 ? (
            <span>Nenhum evento de auditoria ainda.</span>
          ) : auditEntries.slice(-6).reverse().map(entry => (
            <div key={`${entry.at}-${entry.type}`}>
              <strong>{entry.type}</strong>
              <span>{entry.summary}</span>
              <small>{new Date(entry.at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function sectionTitle(section: 'doctor' | 'updates' | 'trust'): string {
  if (section === 'updates') return 'Update e release';
  if (section === 'trust') return 'Confianca e hardening';
  return 'Runtime Doctor';
}
