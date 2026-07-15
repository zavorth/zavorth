import { useState } from 'react';
import { IconDownload, IconShieldCheck } from '@tabler/icons-react';
import { PageFrame } from './panelPrimitives';
import { exportSessionTranscript } from '../../apiClient';
import { t } from '../../i18n';

export function SessionExportPanel(props: {
  sessionId?: string | null;
  messages?: Array<{ role: string; content: string }>;
}) {
  const [format, setFormat] = useState<'markdown' | 'html' | 'prompt'>('markdown');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [redacted, setRedacted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setError(null);
    setStatus('');
    setPreview('');
    try {
      const result = await exportSessionTranscript({
        sessionId: props.sessionId || undefined,
        format,
        messages: props.messages,
        // Redact always on for desktop export surface (opt-out only via CLI --no-redact).
      });
      if (!result) {
        setError(t('sessionExport.unavailable') || 'Export unavailable (runtime offline).');
        return;
      }
      setStatus(String(result.status || 'preview'));
      setRedacted(Boolean(result.safety?.secretsRedacted ?? true));
      setPreview(String(result.bodyPreview || result.body || '').slice(0, 8000));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame
      title={t('sessionExport.title') || 'Session export'}
      description={t('sessionExport.description') || 'Export the current transcript. Secrets are redacted by default.'}
      meta={props.sessionId ? `session ${props.sessionId.slice(0, 12)}` : 'local messages'}
    >
      <div className="zvd-session-export" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'markdown' | 'html' | 'prompt')}
              style={{
                background: '#1e1e20',
                color: '#fff',
                border: '1px solid #27272a',
                borderRadius: 6,
                padding: '4px 8px',
              }}
            >
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
              <option value="prompt">Prompt-only</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--zvd-accent, #d86b2a)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            <IconDownload size={16} />
            {busy ? t('sessionExport.exporting') || 'Exporting…' : t('sessionExport.export') || 'Export preview'}
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#a1a1aa' }}>
            <IconShieldCheck size={14} />
            {t('sessionExport.redactOn') || 'Redact on by default'}
          </span>
        </div>

        {error ? (
          <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
            {error}
          </p>
        ) : null}
        {status ? (
          <p style={{ fontSize: 13, color: '#a1a1aa' }}>
            Status: <strong style={{ color: '#fff' }}>{status}</strong>
            {redacted !== null ? ` · secrets redacted: ${redacted ? 'yes' : 'no'}` : ''}
          </p>
        ) : null}
        {preview ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: '#121214',
              border: '1px solid #27272a',
              borderRadius: 10,
              maxHeight: 420,
              overflow: 'auto',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              color: '#e4e4e7',
            }}
          >
            {preview}
          </pre>
        ) : (
          <p style={{ fontSize: 13, color: '#71717a' }}>
            {t('sessionExport.empty') || 'Run export to preview a redacted transcript.'}
          </p>
        )}
      </div>
    </PageFrame>
  );
}
