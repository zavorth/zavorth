import { useState, useMemo, useCallback, useRef, memo } from 'react';
import hljs from '../lib/highlight';
import { sanitizeHighlightedHtml } from '../lib/safeHtml';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const CodeBlock = memo(function CodeBlock({ code, language, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return sanitizeHighlightedHtml(hljs.highlight(code, { language }).value);
      }
      return sanitizeHighlightedHtml(hljs.highlightAuto(code).value);
    } catch {
      return escapeHtml(code);
    }
  }, [code, language]);

  const langLabel = language || 'text';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const lines = useMemo(() => {
    if (!showLineNumbers) return null;
    return highlighted.split('\n');
  }, [highlighted, showLineNumbers]);

  return (
    <div className={`zvd-code-block${showLineNumbers ? ' zvd-code-block--numbered' : ''}`}>
      <div className="zvd-code-block__header">
        <span className="zvd-code-block__lang">{langLabel}</span>
        <button
          className={`zvd-code-block__copy${copied ? ' zvd-code-block__copy--copied' : ''}`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="zvd-code-block__content">
        {showLineNumbers && lines ? (
          <pre>
            <code className={`hljs${language ? ` language-${language}` : ''}`}>
              {lines.map((line, i) => (
                <div key={i} className="zvd-code-block__line">
                  <span className="zvd-code-block__line-num">{i + 1}</span>
                  <span
                    className="zvd-code-block__line-code"
                    dangerouslySetInnerHTML={{ __html: line || '\n' }}
                  />
                </div>
              ))}
            </code>
          </pre>
        ) : (
          <pre>
            <code
              className={`hljs${language ? ` language-${language}` : ''}`}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </pre>
        )}
      </div>
    </div>
  );
});
