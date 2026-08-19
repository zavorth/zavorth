import React, { useState, useEffect, useRef, useCallback, useMemo, memo, type ReactNode } from 'react';
import {
  IconCode,
  IconExternalLink,
  IconShieldLock,
  IconAlertTriangle,
  IconLink,
} from '@tabler/icons-react';
import { asErrorLike } from '../lib/errors';

import { sanitizeSvgMarkup } from '../lib/safeHtml';

interface EmbedRendererProps {
  url?: string;
  code?: string;
  language?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  theme?: 'light' | 'dark';
  lazy?: boolean;
  className?: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\...v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe...g|gif|webp|svg|avif)(\...|$)/i.test(url);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const MERMAID_LANGUAGES = new Set(['mermaid', 'mmd']);

function useLazyLoad(enabled: boolean): { ref: React.RefObject<HTMLDivElement | null>; visible: boolean } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, visible };
}

const CONSENT_STORAGE_KEY = 'zvd-embed-consent-v1';

function getConsentedDomains(): Set<string> {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveConsentedDomain(domain: string): void {
  const domains = getConsentedDomains();
  domains.add(domain);
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify([...domains]));
}

const ConsentGate = memo(function ConsentGate({
  domain,
  children,
  theme,
}: {
  domain: string;
  children: ReactNode;
  theme: 'light' | 'dark';
}) {
  const [consented, setConsented] = useState(() => getConsentedDomains().has(domain));

  const handleAllow = useCallback(() => {
    saveConsentedDomain(domain);
    setConsented(true);
  }, [domain]);

  if (consented) return <>{children}</>;

  return (
    <div className={`zvd-embed-consent zvd-embed-consent--${theme}`}>
      <style>{`
        .zvd-embed-consent {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-surface, #202022);
          text-align: center;
        }
        .zvd-embed-consent--light {
          --zvd-surface: #ffffff;
          --zvd-border: #e8e8e8;
          --zvd-text: #262626;
          --zvd-text-secondary: #8c8c8c;
        }
        .zvd-embed-consent--dark {
          --zvd-surface: #202022;
          --zvd-border: #27272a;
          --zvd-text: #f4f4f5;
          --zvd-text-secondary: #a1a1aa;
        }
        .zvd-embed-consent__icon {
          color: var(--zvd-accent, #d86b2a);
        }
        .zvd-embed-consent__text {
          font-size: 13px;
          color: var(--zvd-text-secondary, #a1a1aa);
          line-height: 1.5;
        }
        .zvd-embed-consent__domain {
          font-weight: 600;
          color: var(--zvd-text, #f4f4f5);
        }
        .zvd-embed-consent__btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 150ms ease;
          background: var(--zvd-accent, #d86b2a);
          color: #fff;
        }
        .zvd-embed-consent__btn:hover {
          opacity: 0.85;
        }
      `}</style>
      <IconShieldLock size={28} className="zvd-embed-consent__icon" stroke={1.5} />
      <div className="zvd-embed-consent__text">
        This embed loads content from{' '}
        <span className="zvd-embed-consent__domain">{domain}</span>.
        <br />
        Allow external content from this domain...
      </div>
      <button className="zvd-embed-consent__btn" onClick={handleAllow} type="button">
        <IconShieldLock size={14} />
        Allow {domain}
      </button>
    </div>
  );
});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EmbedErrorBoundary extends React.Component<
  { children: ReactNode; theme: 'light' | 'dark' },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isDark = this.props.theme === 'dark';
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 8,
            border: `1px solid ${isDark ? '#27272a' : '#e8e8e8'}`,
            background: isDark ? '#202022' : '#ffffff',
            color: isDark ? '#a1a1aa' : '#8c8c8c',
            fontSize: 13,
          }}
        >
          <IconAlertTriangle size={18} style={{ color: '#faad14', flexShrink: 0 }} />
          <span>Failed to render embed: {this.state.error?.message ?? 'Unknown error'}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const YouTubeEmbed = memo(function YouTubeEmbed({
  videoId,
  theme,
}: {
  videoId: string;
  theme: 'light' | 'dark';
}) {
  return (
    <div className={`zvd-embed-yt zvd-embed-yt--${theme}`}>
      <style>{`
        .zvd-embed-yt {
          position: relative;
          width: 100%;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--zvd-border, #27272a);
          background: #000;
        }
        .zvd-embed-yt--light { --zvd-border: #e8e8e8; }
        .zvd-embed-yt--dark { --zvd-border: #27272a; }
        .zvd-embed-yt__ratio {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
        }
        .zvd-embed-yt__iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>
      <div className="zvd-embed-yt__ratio">
        <iframe
          className="zvd-embed-yt__iframe"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
});

let mermaidInstance: { default?: { initialize: (cfg: unknown) => void; render: (id: string, code: string) => Promise<{ svg: string }> } } | null = null;
let mermaidLoading: Promise<typeof mermaidInstance> | null = null;

async function loadMermaid(): Promise<typeof mermaidInstance> {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidLoading) return mermaidLoading;
  mermaidLoading = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs' as string)
    .then((mod) => {
      mermaidInstance = mod as typeof mermaidInstance;
      return mermaidInstance;
    })
    .catch(() => null);
  return mermaidLoading;
}

const MermaidRenderer = memo(function MermaidRenderer({
  code,
  theme,
}: {
  code: string;
  theme: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mod = await loadMermaid();
        if (!mod?.default || cancelled) return;

        mod.default.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
        });

        const id = `zvd-mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mod.default.render(id, code);
        const safeSvg = sanitizeSvgMarkup(svg);

        if (!cancelled && containerRef.current) {
          if (!safeSvg) {
            setError('Diagram SVG failed safety checks');
            return;
          }
          containerRef.current.innerHTML = safeSvg;
          setRendered(true);
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);

        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Mermaid rendering failed');
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code, theme]);

  if (error) {
    return (
      <div className={`zvd-embed-mermaid-error zvd-embed-mermaid-error--${theme}`}>
        <style>{`
          .zvd-embed-mermaid-error {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 14px 16px;
            border-radius: 8px;
            border: 1px solid var(--zvd-border, #27272a);
            background: var(--zvd-surface, #202022);
            font-size: 13px;
            color: var(--zvd-text-secondary, #a1a1aa);
          }
          .zvd-embed-mermaid-error--light { --zvd-border: #e8e8e8; --zvd-surface: #ffffff; --zvd-text-secondary: #8c8c8c; }
          .zvd-embed-mermaid-error--dark { --zvd-border: #27272a; --zvd-surface: #202022; --zvd-text-secondary: #a1a1aa; }
        `}</style>
        <IconAlertTriangle size={18} style={{ color: '#faad14', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--zvd-text, #f4f4f5)' }}>Diagram error</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`zvd-embed-mermaid zvd-embed-mermaid--${theme}`}>
      <style>{`
        .zvd-embed-mermaid {
          padding: 16px;
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-surface, #202022);
          overflow-x: auto;
          display: flex;
          justify-content: center;
        }
        .zvd-embed-mermaid--light { --zvd-border: #e8e8e8; --zvd-surface: #ffffff; }
        .zvd-embed-mermaid--dark { --zvd-border: #27272a; --zvd-surface: #202022; }
        .zvd-embed-mermaid svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      {!rendered && (
        <div style={{ padding: 24, color: '#a1a1aa', fontSize: 13 }}>Rendering diagram...</div>
      )}
      <div ref={containerRef} style={{ display: rendered ? 'block' : 'none' }} />
    </div>
  );
});

const SvgRenderer = memo(function SvgRenderer({
  code,
  theme,
}: {
  code: string;
  theme: 'light' | 'dark';
}) {
  // Only inject when sanitizeSvgMarkup + isSafeStaticSvg both pass; never partial strip.
  const sanitized = useMemo(() => sanitizeSvgMarkup(code), [code]);

  return (
    <div className={`zvd-embed-svg zvd-embed-svg--${theme}`}>
      <style>{`
        .zvd-embed-svg {
          display: flex;
          justify-content: center;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-surface, #202022);
          overflow: auto;
        }
        .zvd-embed-svg--light { --zvd-border: #e8e8e8; --zvd-surface: #ffffff; }
        .zvd-embed-svg--dark { --zvd-border: #27272a; --zvd-surface: #202022; }
        .zvd-embed-svg svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      {sanitized ? (
        <div dangerouslySetInnerHTML={{ __html: sanitized }} />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 4px',
            fontSize: 13,
            color: 'var(--zvd-text-secondary, #a1a1aa)',
          }}
        >
          <IconAlertTriangle size={18} style={{ color: '#faad14', flexShrink: 0 }} />
          <span>SVG blocked: unsafe markup was removed.</span>
        </div>
      )}
    </div>
  );
});

const UrlPreviewCard = memo(function UrlPreviewCard({
  url,
  title,
  description,
  thumbnail,
  theme,
}: {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  theme: 'light' | 'dark';
}) {
  const domain = useMemo(() => extractDomain(url), [url]);

  return (
    <a
      className={`zvd-embed-url zvd-embed-url--${theme}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <style>{`
        .zvd-embed-url {
          display: flex;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-surface, #202022);
          text-decoration: none;
          color: inherit;
          transition: border-color 150ms ease;
          cursor: pointer;
        }
        .zvd-embed-url:hover {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-embed-url--light {
          --zvd-border: #e8e8e8;
          --zvd-surface: #ffffff;
          --zvd-text: #262626;
          --zvd-text-secondary: #8c8c8c;
          --zvd-text-muted: #bfbfbf;
        }
        .zvd-embed-url--dark {
          --zvd-border: #27272a;
          --zvd-surface: #202022;
          --zvd-text: #f4f4f5;
          --zvd-text-secondary: #a1a1aa;
          --zvd-text-muted: #52525b;
        }
        .zvd-embed-url__thumb {
          flex-shrink: 0;
          width: 80px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--zvd-border, #27272a);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .zvd-embed-url__thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .zvd-embed-url__body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .zvd-embed-url__title {
          font-size: 13px;
          font-weight: 600;
          color: var(--zvd-text, #f4f4f5);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .zvd-embed-url__desc {
          font-size: 12px;
          color: var(--zvd-text-secondary, #a1a1aa);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }
        .zvd-embed-url__domain {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--zvd-text-muted, #52525b);
          margin-top: 2px;
        }
      `}</style>
      {thumbnail ? (
        <div className="zvd-embed-url__thumb">
          <img src={thumbnail} alt="" loading="lazy" />
        </div>
      ) : (
        <div className="zvd-embed-url__thumb">
          <IconLink size={20} style={{ color: 'var(--zvd-text-muted, #52525b)' }} />
        </div>
      )}
      <div className="zvd-embed-url__body">
        <div className="zvd-embed-url__title">{title || url}</div>
        {description && <div className="zvd-embed-url__desc">{description}</div>}
        <div className="zvd-embed-url__domain">
          <IconExternalLink size={11} />
          {domain}
        </div>
      </div>
    </a>
  );
});

const ImageEmbed = memo(function ImageEmbed({
  url,
  theme,
}: {
  url: string;
  theme: 'light' | 'dark';
}) {
  return (
    <div className={`zvd-embed-img zvd-embed-img--${theme}`}>
      <style>{`
        .zvd-embed-img {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-surface, #202022);
          display: flex;
          align-items: center;
          justify-content: center;
          max-height: 400px;
        }
        .zvd-embed-img--light { --zvd-border: #e8e8e8; --zvd-surface: #ffffff; }
        .zvd-embed-img--dark { --zvd-border: #27272a; --zvd-surface: #202022; }
        .zvd-embed-img img {
          max-width: 100%;
          max-height: 400px;
          object-fit: contain;
          display: block;
        }
      `}</style>
      <img src={url} alt="Embedded image" loading="lazy" />
    </div>
  );
});

const CodeFenceRenderer = memo(function CodeFenceRenderer({
  code,
  language,
  theme,
}: {
  code: string;
  language?: string;
  theme: 'light' | 'dark';
}) {
  const lines = useMemo(() => code.split('\n'), [code]);

  return (
    <div className={`zvd-embed-code zvd-embed-code--${theme}`}>
      <style>{`
        .zvd-embed-code {
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          overflow: hidden;
          font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        .zvd-embed-code--light {
          --zvd-border: #e8e8e8;
          --zvd-surface: #fafafa;
          --zvd-header-bg: #f0f0f0;
          --zvd-text: #262626;
          --zvd-text-muted: #bfbfbf;
          --zvd-line-border: #e8e8e8;
        }
        .zvd-embed-code--dark {
          --zvd-border: #27272a;
          --zvd-surface: #18181a;
          --zvd-header-bg: #202022;
          --zvd-text: #f4f4f5;
          --zvd-text-muted: #52525b;
          --zvd-line-border: #27272a;
        }
        .zvd-embed-code__header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: var(--zvd-header-bg, #202022);
          border-bottom: 1px solid var(--zvd-border, #27272a);
          font-size: 12px;
          color: var(--zvd-text-muted, #52525b);
        }
        .zvd-embed-code__body {
          background: var(--zvd-surface, #18181a);
          padding: 12px 0;
          overflow-x: auto;
          max-height: 360px;
          overflow-y: auto;
        }
        .zvd-embed-code__line {
          display: flex;
          padding: 0 14px;
        }
        .zvd-embed-code__line:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .zvd-embed-code__num {
          flex-shrink: 0;
          width: 40px;
          text-align: right;
          padding-right: 12px;
          color: var(--zvd-text-muted, #52525b);
          user-select: none;
          font-size: 12px;
        }
        .zvd-embed-code__text {
          flex: 1;
          color: var(--zvd-text, #f4f4f5);
          white-space: pre;
          min-width: 0;
        }
      `}</style>
      {language && (
        <div className="zvd-embed-code__header">
          <IconCode size={14} stroke={1.6} />
          <span>{language}</span>
        </div>
      )}
      <div className="zvd-embed-code__body">
        {lines.map((line, i) => (
          <div key={i} className="zvd-embed-code__line">
            <span className="zvd-embed-code__num">{i + 1}</span>
            <span className="zvd-embed-code__text">{line || '\n'}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default memo(function EmbedRenderer({
  url,
  code,
  language,
  title,
  description,
  thumbnail,
  theme = 'dark',
  lazy = true,
  className,
}: EmbedRendererProps) {
  const { ref, visible } = useLazyLoad(lazy);

  // Determine embed type
  const embedType = useMemo(() => {
    if (url) {
      if (extractYouTubeId(url)) return 'youtube';
      if (isImageUrl(url)) return 'image';
      return 'url';
    }
    if (code) {
      const lang = (language || '').toLowerCase();
      if (MERMAID_LANGUAGES.has(lang)) return 'mermaid';
      if (lang === 'svg') return 'svg';
      return 'code';
    }
    return null;
  }, [url, code, language]);

  const renderEmbed = useCallback(() => {
    if (!visible) return null;

    switch (embedType) {
      case 'youtube': {
        const videoId = extractYouTubeId(url!);
        if (!videoId) return null;
        const domain = extractDomain(url!);
        return (
          <ConsentGate domain={domain} theme={theme}>
            <YouTubeEmbed videoId={videoId} theme={theme} />
          </ConsentGate>
        );
      }

      case 'image':
        return <ImageEmbed url={url!} theme={theme} />;

      case 'url': {
        const domain = extractDomain(url!);
        return (
          <UrlPreviewCard
            url={url!}
            title={title}
            description={description}
            thumbnail={thumbnail}
            theme={theme}
          />
        );
      }

      case 'mermaid':
        return (
          <ConsentGate domain="cdn.jsdelivr.net" theme={theme}>
            <MermaidRenderer code={code!} theme={theme} />
          </ConsentGate>
        );

      case 'svg':
        return <SvgRenderer code={code!} theme={theme} />;

      case 'code':
        return <CodeFenceRenderer code={code!} language={language} theme={theme} />;

      default:
        return null;
    }
  }, [visible, embedType, url, code, language, title, description, thumbnail, theme]);

  if (!embedType) return null;

  return (
    <div ref={ref} className={className} style={{ width: '100%' }}>
      <EmbedErrorBoundary theme={theme}>
        {renderEmbed()}
      </EmbedErrorBoundary>
    </div>
  );
});
