import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { IconArrowLeft, IconArrowRight, IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { $previewRefreshNonce, $previewUrl, setPreviewUrl } from '../store/preview';
import { DEFAULT_PREVIEW_URL, normalizePreviewUrl } from '../vibe/vibeScaffoldHints';

export function WebPreviewView(_props: {
  mode?: 'page' | 'rail';
  runtimeCapabilities?: unknown;
  workspaceScope?: unknown;
}) {
  const storeUrl = useStore($previewUrl);
  const refreshNonce = useStore($previewRefreshNonce);
  const [url, setUrl] = useState(storeUrl || DEFAULT_PREVIEW_URL);
  const [inputUrl, setInputUrl] = useState(storeUrl || DEFAULT_PREVIEW_URL);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const next = storeUrl || DEFAULT_PREVIEW_URL;
    setUrl(next);
    setInputUrl(next);
  }, [storeUrl]);

  useEffect(() => {
    if (!refreshNonce) return;
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  }, [refreshNonce, url]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = normalizePreviewUrl(inputUrl, DEFAULT_PREVIEW_URL);
    setUrl(formatted);
    setInputUrl(formatted);
    setPreviewUrl(formatted);
  };

  return (
    <section
      className="zvd-page"
      aria-label="Web Preview"
      style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <style>{`
        .zvd-preview-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh ? 120px);
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 12px;
          overflow: hidden;
        }
        .zvd-preview-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: #121214;
          border-bottom: 1px solid #27272a;
        }
        .zvd-preview-btn {
          background: transparent;
          border: none;
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: all 150ms ease;
        }
        .zvd-preview-btn:hover {
          background: #27272a;
          color: #fff;
        }
        .zvd-preview-address-form {
          flex: 1;
          display: flex;
        }
        .zvd-preview-address-input {
          width: 100%;
          background: #1e1e20;
          border: 1px solid #27272a;
          border-radius: 6px;
          padding: 6px 12px;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
        .zvd-preview-address-input:focus {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-preview-frame-wrap {
          flex: 1;
          background: #fff;
          position: relative;
        }
        .zvd-preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
      <div className="zvd-preview-container">
        <div className="zvd-preview-toolbar">
          <button type="button" className="zvd-preview-btn" onClick={() => window.history.back()} title="Back">
            <IconArrowLeft size={16} />
          </button>
          <button type="button" className="zvd-preview-btn" onClick={() => window.history.forward()} title="Forward">
            <IconArrowRight size={16} />
          </button>
          <button type="button" className="zvd-preview-btn" onClick={handleRefresh} title="Refresh">
            <IconRefresh size={16} />
          </button>

          <form onSubmit={handleGo} className="zvd-preview-address-form">
            <input
              type="text"
              className="zvd-preview-address-input"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Local or external preview URL..."
            />
          </form>

          <a href={url} target="_blank" rel="noreferrer" className="zvd-preview-btn" title="Open in browser">
            <IconExternalLink size={16} />
          </a>
        </div>

        <div className="zvd-preview-frame-wrap">
          <iframe
            ref={iframeRef}
            src={url}
            className="zvd-preview-iframe"
            title="Web Preview Frame"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      </div>
    </section>
  );
}
