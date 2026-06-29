import { useState, useRef } from 'react';
import { IconArrowLeft, IconArrowRight, IconRefresh, IconExternalLink } from '@tabler/icons-react';

export function WebPreviewView() {
  const [url, setUrl] = useState('http://localhost:5173');
  const [inputUrl, setInputUrl] = useState('http://localhost:5173');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    let formatted = inputUrl.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = 'http://' + formatted;
    }
    setUrl(formatted);
    setInputUrl(formatted);
  };

  return (
    <section className="zvd-page" aria-label="Web Preview" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .zvd-preview-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 120px);
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
          <button type="button" className="zvd-preview-btn" onClick={() => window.history.back()} title="Voltar">
            <IconArrowLeft size={16} />
          </button>
          <button type="button" className="zvd-preview-btn" onClick={() => window.history.forward()} title="Avançar">
            <IconArrowRight size={16} />
          </button>
          <button type="button" className="zvd-preview-btn" onClick={handleRefresh} title="Atualizar">
            <IconRefresh size={16} />
          </button>

          <form onSubmit={handleGo} className="zvd-preview-address-form">
            <input
              type="text"
              className="zvd-preview-address-input"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="Digite a URL local ou externa..."
            />
          </form>

          <a href={url} target="_blank" rel="noreferrer" className="zvd-preview-btn" title="Abrir no Navegador">
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
