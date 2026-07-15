import { useCallback, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  IconCopy,
  IconExternalLink,
  IconPlayerPlay,
  IconRefresh,
  IconTerminal2,
  IconWorldWww,
} from '@tabler/icons-react';
import { t } from '../i18n';
import { requestRightRailOpen } from '../store/layout';
import { $previewUrl, requestPreviewRefresh, setPreviewUrl } from '../store/preview';
import {
  DEFAULT_PREVIEW_URL,
  formatScaffoldCopyBlock,
  normalizePreviewUrl,
  VIBE_SCAFFOLD_HINTS,
  type VibeScaffoldHint,
} from './vibeScaffoldHints';

export type VibeCodingPanelProps = {
  workspacePath?: string | null;
  workspaceLabel?: string | null;
};

export function VibeCodingPanel(props: VibeCodingPanelProps) {
  const previewUrl = useStore($previewUrl);
  const [urlDraft, setUrlDraft] = useState(previewUrl || DEFAULT_PREVIEW_URL);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeHintId, setActiveHintId] = useState(VIBE_SCAFFOLD_HINTS[0]?.id || '');

  const activeHint = useMemo(
    () => VIBE_SCAFFOLD_HINTS.find(h => h.id === activeHintId) || VIBE_SCAFFOLD_HINTS[0],
    [activeHintId],
  );

  const workspacePath = props.workspacePath || t('vibe.noWorkspacePath');
  const workspaceLabel = props.workspaceLabel || t('vibe.workspace');

  const openTerminal = useCallback(() => {
    requestRightRailOpen('terminal');
  }, []);

  const openPreview = useCallback(() => {
    requestRightRailOpen('preview');
  }, []);

  const applyPreviewUrl = useCallback(() => {
    const next = normalizePreviewUrl(urlDraft);
    setUrlDraft(next);
    setPreviewUrl(next);
    requestRightRailOpen('preview');
  }, [urlDraft]);

  const startLocalPreview = useCallback(() => {
    setUrlDraft(DEFAULT_PREVIEW_URL);
    setPreviewUrl(DEFAULT_PREVIEW_URL);
    requestRightRailOpen('preview');
  }, []);

  const refreshPreview = useCallback(() => {
    requestPreviewRefresh();
    requestRightRailOpen('preview');
  }, []);

  const copyText = useCallback(async (id: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(current => (current === id ? null : current)), 1600);
    } catch {
      setCopiedId(null);
    }
  }, []);

  return (
    <section className="zvd-page zvd-hub-page zvd-vibe-page" aria-label={t('vibe.title')}>
      <style>{VIBE_STYLES}</style>
      <header className="zvd-page-header">
        <div>
          <span className="zvd-page-eyebrow">workspace</span>
          <h1>{t('vibe.title')}</h1>
          <p>{t('vibe.description')}</p>
        </div>
        <div className="zvd-page-header-side">
          <span className="zvd-page-meta">{t('vibe.governed')}</span>
        </div>
      </header>

      <div className="zvd-vibe-card">
        <div className="zvd-vibe-card-label">{workspaceLabel}</div>
        <code className="zvd-vibe-path" title={workspacePath}>{workspacePath}</code>
      </div>

      <div className="zvd-vibe-actions">
        <button type="button" className="zvd-vibe-btn" onClick={openTerminal}>
          <IconTerminal2 size={16} />
          <span>{t('vibe.openTerminal')}</span>
        </button>
        <button type="button" className="zvd-vibe-btn" onClick={openPreview}>
          <IconWorldWww size={16} />
          <span>{t('vibe.openPreview')}</span>
        </button>
        <button type="button" className="zvd-vibe-btn is-accent" onClick={startLocalPreview}>
          <IconPlayerPlay size={16} />
          <span>{t('vibe.startLocalPreview')}</span>
        </button>
        <button type="button" className="zvd-vibe-btn" onClick={refreshPreview}>
          <IconRefresh size={16} />
          <span>{t('vibe.refreshPreview')}</span>
        </button>
      </div>

      <div className="zvd-vibe-card">
        <div className="zvd-vibe-card-label">{t('vibe.previewUrl')}</div>
        <form
          className="zvd-vibe-url-row"
          onSubmit={event => {
            event.preventDefault();
            applyPreviewUrl();
          }}
        >
          <input
            className="zvd-vibe-url-input"
            value={urlDraft}
            onChange={event => setUrlDraft(event.target.value)}
            placeholder={DEFAULT_PREVIEW_URL}
            aria-label={t('vibe.previewUrl')}
          />
          <button type="submit" className="zvd-vibe-btn is-accent">
            <IconExternalLink size={15} />
            <span>{t('vibe.applyUrl')}</span>
          </button>
        </form>
        <p className="zvd-vibe-url-current">
          {t('vibe.currentUrl')}: <code>{previewUrl}</code>
        </p>
      </div>

      <div className="zvd-vibe-scaffold">
        <div className="zvd-vibe-scaffold-head">
          <div>
            <strong>{t('vibe.scaffoldTitle')}</strong>
            <p>{t('vibe.scaffoldBody')}</p>
          </div>
        </div>

        <div className="zvd-vibe-hint-tabs" role="tablist">
          {VIBE_SCAFFOLD_HINTS.map(hint => (
            <button
              key={hint.id}
              type="button"
              role="tab"
              aria-selected={hint.id === activeHint?.id}
              className={hint.id === activeHint?.id ? 'is-active' : ''}
              onClick={() => setActiveHintId(hint.id)}
            >
              {hint.title}
            </button>
          ))}
        </div>

        {activeHint && <ScaffoldHintCard hint={activeHint} copiedId={copiedId} onCopy={copyText} />}
      </div>
    </section>
  );
}

function ScaffoldHintCard(props: {
  hint: VibeScaffoldHint;
  copiedId: string | null;
  onCopy(id: string, text: string): void;
}) {
  const { hint, copiedId, onCopy } = props;
  const blockId = `hint-block-${hint.id}`;
  return (
    <div className="zvd-vibe-hint-card">
      <p className="zvd-vibe-hint-desc">{hint.description}</p>
      <ol className="zvd-vibe-steps">
        {hint.steps.map(step => (
          <li key={step.id}>
            <div className="zvd-vibe-step-head">
              <strong>{step.title}</strong>
              <button
                type="button"
                className="zvd-vibe-copy"
                onClick={() => onCopy(step.id, step.command)}
              >
                <IconCopy size={13} />
                <span>{copiedId === step.id ? t('vibe.copied') : t('vibe.copy')}</span>
              </button>
            </div>
            <code className="zvd-vibe-cmd">{step.command}</code>
            {step.note ? <span className="zvd-vibe-note">{step.note}</span> : null}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="zvd-vibe-btn"
        onClick={() => onCopy(blockId, formatScaffoldCopyBlock(hint))}
      >
        <IconCopy size={14} />
        <span>{copiedId === blockId ? t('vibe.copied') : t('vibe.copyAll')}</span>
      </button>
    </div>
  );
}

const VIBE_STYLES = `
  .zvd-vibe-page { display: flex; flex-direction: column; gap: 16px; }
  .zvd-vibe-card {
    background: #121318; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px; padding: 14px 16px;
  }
  .zvd-vibe-card-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #71717a; margin-bottom: 8px;
  }
  .zvd-vibe-path {
    display: block; font-size: 13px; color: #e4e4e7; word-break: break-all;
    background: #0e0f13; border-radius: 8px; padding: 10px 12px;
  }
  .zvd-vibe-actions {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .zvd-vibe-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #25262d; border: 1px solid rgba(255,255,255,0.08);
    color: #fff; border-radius: 8px; padding: 8px 12px; font-size: 12.5px;
    cursor: pointer;
  }
  .zvd-vibe-btn.is-accent {
    background: color-mix(in srgb, var(--zvd-accent, #f16a21) 22%, #25262d);
    border-color: color-mix(in srgb, var(--zvd-accent, #f16a21) 40%, transparent);
  }
  .zvd-vibe-btn:hover { background: rgba(255,255,255,0.08); }
  .zvd-vibe-url-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .zvd-vibe-url-input {
    flex: 1; min-width: 200px;
    background: #0e0f13; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #fff; padding: 8px 12px; font-size: 13px; outline: none;
  }
  .zvd-vibe-url-input:focus { border-color: var(--zvd-accent, #f16a21); }
  .zvd-vibe-url-current { margin: 10px 0 0; font-size: 12px; color: #71717a; }
  .zvd-vibe-url-current code { color: #e4e4e7; }
  .zvd-vibe-scaffold {
    background: #121318; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;
  }
  .zvd-vibe-scaffold-head strong { color: #fff; font-size: 14px; }
  .zvd-vibe-scaffold-head p { margin: 4px 0 0; font-size: 12.5px; color: #a1a1aa; line-height: 1.45; }
  .zvd-vibe-hint-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .zvd-vibe-hint-tabs button {
    background: transparent; border: 1px solid rgba(255,255,255,0.08);
    color: #a1a1aa; border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;
  }
  .zvd-vibe-hint-tabs button.is-active {
    color: #fff; border-color: var(--zvd-accent, #f16a21);
    background: color-mix(in srgb, var(--zvd-accent, #f16a21) 16%, transparent);
  }
  .zvd-vibe-hint-desc { margin: 0 0 12px; font-size: 12.5px; color: #a1a1aa; }
  .zvd-vibe-steps { margin: 0 0 12px; padding-left: 18px; display: flex; flex-direction: column; gap: 12px; }
  .zvd-vibe-step-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .zvd-vibe-step-head strong { color: #e4e4e7; font-size: 13px; }
  .zvd-vibe-cmd {
    display: block; font-size: 12px; color: #f4f4f5;
    background: #0e0f13; border-radius: 8px; padding: 10px 12px; word-break: break-all;
  }
  .zvd-vibe-note { display: block; margin-top: 4px; font-size: 11.5px; color: #71717a; }
  .zvd-vibe-copy {
    display: inline-flex; align-items: center; gap: 4px;
    background: transparent; border: none; color: #a1a1aa; font-size: 11.5px; cursor: pointer;
  }
  .zvd-vibe-copy:hover { color: #fff; }
`;

export default VibeCodingPanel;
