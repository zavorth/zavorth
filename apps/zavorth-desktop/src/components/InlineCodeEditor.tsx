import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import {
  IconDeviceFloppy,
  IconX,
  IconFileTypeJs,
  IconFileTypeTs,
  IconFileTypeTsx,
  IconFileTypeJsx,
  IconFileTypeHtml,
  IconFileTypeCss,
  IconFileTypePy,
  IconFileTypeRs,
  IconFileTypeGo,
  IconFileTypePhp,
  IconFileCode,
  IconFileTypeSql,
  IconFileTypeXml,
  IconFileTypeCsv,
  IconMarkdown,
  IconJson,
  IconTerminal2,
} from '@tabler/icons-react';


interface InlineCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  onCancel?: () => void;
  language?: string;
  filename?: string;
  placeholder?: string;
  theme?: 'light' | 'dark';
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  className?: string;
}


const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  golang: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  php: 'php',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  xml: 'xml',
  svg: 'svg',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  psm1: 'powershell',
  psd1: 'powershell',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  csv: 'csv',
  txt: 'plaintext',
  log: 'plaintext',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'plaintext',
  graphql: 'graphql',
  gql: 'graphql',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  vue: 'vue',
  svelte: 'svelte',
};

function detectLanguage(filename?: string, explicit?: string): string {
  if (explicit) return explicit.toLowerCase();
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'plaintext';
  return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
}

const LANGUAGE_ICONS: Record<string, typeof IconFileCode> = {
  javascript: IconFileTypeJs,
  typescript: IconFileTypeTs,
  tsx: IconFileTypeTsx,
  jsx: IconFileTypeJsx,
  html: IconFileTypeHtml,
  css: IconFileTypeCss,
  python: IconFileTypePy,
  rust: IconFileTypeRs,
  go: IconFileTypeGo,
  php: IconFileTypePhp,
  sql: IconFileTypeSql,
  xml: IconFileTypeXml,
  csv: IconFileTypeCsv,
  markdown: IconMarkdown,
  json: IconJson,
  bash: IconTerminal2,
  powershell: IconTerminal2,
};


const INDENT = '  ';

function getLineIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

function getSelectionLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): { startLine: number; endLine: number; startLineOffset: number; endLineOffset: number } {
  const before = text.slice(0, selectionStart);
  const startLine = (before.match(/\n/g) || []).length;
  const startLineOffset = selectionStart - before.lastIndexOf('\n') - 1;

  const beforeEnd = text.slice(0, selectionEnd);
  const endLine = (beforeEnd.match(/\n/g) || []).length;
  const endLineOffset = selectionEnd - beforeEnd.lastIndexOf('\n') - 1;

  return { startLine, endLine, startLineOffset, endLineOffset };
}


export default memo(function InlineCodeEditor({
  value,
  onChange,
  onSave,
  onCancel,
  language: languageProp,
  filename,
  placeholder = 'Write code here...',
  theme = 'dark',
  minHeight = 120,
  maxHeight = 480,
  readOnly = false,
  className,
}: InlineCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<string[]>([value]);
  const undoIndexRef = useRef<number>(0);

  const language = useMemo(() => detectLanguage(filename, languageProp), [filename, languageProp]);
  const LangIcon = LANGUAGE_ICONS[language] || IconFileCode;

  const lines = useMemo(() => value.split('\n'), [value]);

  // Push to undo stack on meaningful changes
  const pushUndo = useCallback(
    (next: string) => {
      const stack = undoStackRef.current;
      const idx = undoIndexRef.current;
      if (stack[idx] === next) return;
      undoStackRef.current = stack.slice(0, idx + 1);
      undoStackRef.current.push(next);
      // Cap undo history at 200 entries
      if (undoStackRef.current.length > 200) {
        undoStackRef.current.shift();
      }
      undoIndexRef.current = undoStackRef.current.length - 1;
    },
    [],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      pushUndo(next);
    },
    [onChange, pushUndo],
  );

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = textareaRef.current;
      if (!ta) return;

      // Ctrl+S -> Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.(value);
        return;
      }

      // Escape -> Cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }

      // Ctrl+Z -> Undo (custom undo stack)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const stack = undoStackRef.current;
        const idx = undoIndexRef.current;
        if (idx > 0) {
          undoIndexRef.current = idx - 1;
          onChange(stack[idx - 1]);
        }
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z -> Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const stack = undoStackRef.current;
        const idx = undoIndexRef.current;
        if (idx < stack.length - 1) {
          undoIndexRef.current = idx + 1;
          onChange(stack[idx + 1]);
        }
        return;
      }

      // Tab -> Indent
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart, selectionEnd } = ta;
        const { startLine, endLine } = getSelectionLines(value, selectionStart, selectionEnd);

        if (startLine === endLine && !e.shiftKey) {
          // Single cursor: insert indent
          const before = value.slice(0, selectionStart);
          const after = value.slice(selectionEnd);
          const next = before + INDENT + after;
          onChange(next);
          pushUndo(next);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = selectionStart + INDENT.length;
          });
        } else {
          // Multi-line: indent or dedent each selected line
          const allLines = value.split('\n');
          const isDedent = e.shiftKey;
          let removedBefore = 0;

          for (let i = startLine; i <= endLine; i++) {
            if (isDedent) {
              if (allLines[i].startsWith(INDENT)) {
                allLines[i] = allLines[i].slice(INDENT.length);
                if (i === startLine) removedBefore = INDENT.length;
              } else if (allLines[i].startsWith('\t')) {
                allLines[i] = allLines[i].slice(1);
                if (i === startLine) removedBefore = 1;
              }
            } else {
              allLines[i] = INDENT + allLines[i];
              if (i === startLine) removedBefore = -INDENT.length;
            }
          }

          const next = allLines.join('\n');
          onChange(next);
          pushUndo(next);

          requestAnimationFrame(() => {
            if (isDedent) {
              ta.selectionStart = Math.max(0, selectionStart - removedBefore);
              ta.selectionEnd = Math.max(0, selectionEnd - (endLine - startLine + 1) * INDENT.length);
            } else {
              ta.selectionStart = selectionStart + INDENT.length;
              ta.selectionEnd = selectionEnd + (endLine - startLine + 1) * INDENT.length;
            }
          });
        }
        return;
      }

      // Enter -> auto-indent
      if (e.key === 'Enter') {
        e.preventDefault();
        const { selectionStart, selectionEnd } = ta;
        const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLine = value.slice(currentLineStart, selectionStart);
        const indent = getLineIndent(currentLine);
        const lastChar = currentLine.trimEnd().slice(-1);
        const extraIndent = lastChar === '{' || lastChar === '(' || lastChar === '[' || lastChar === ':' ? INDENT : '';

        const before = value.slice(0, selectionStart);
        const after = value.slice(selectionEnd);
        const insertion = '\n' + indent + extraIndent;
        const next = before + insertion + after;
        onChange(next);
        pushUndo(next);

        const newPos = selectionStart + insertion.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = newPos;
        });
      }
    },
    [value, onChange, onSave, onCancel, pushUndo],
  );

  // Keep textarea focused
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta && !readOnly) {
      ta.focus();
    }
  }, [readOnly]);

  return (
    <div
      className={`zvd-inline-editor zvd-inline-editor--${theme}${readOnly ? ' zvd-inline-editor--readonly' : ''}${className ? ` ${className}` : ''}`}
    >
      <style>{`
        .zvd-inline-editor {
          display: flex;
          flex-direction: column;
          border-radius: 8px;
          border: 1px solid var(--zvd-border, #27272a);
          overflow: hidden;
          font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
          transition: border-color 150ms ease;
        }
        .zvd-inline-editor:focus-within {
          border-color: var(--zvd-accent, #d86b2a);
        }
        .zvd-inline-editor--light {
          --zvd-border: #e8e8e8;
          --zvd-bg: #fafafa;
          --zvd-header-bg: #f0f0f0;
          --zvd-text: #262626;
          --zvd-text-muted: #bfbfbf;
          --zvd-gutter-bg: #f5f5f5;
          --zvd-line-hover: rgba(0, 0, 0, 0.02);
          --zvd-caret: #262626;
          --zvd-selection: rgba(24, 144, 255, 0.15);
        }
        .zvd-inline-editor--dark {
          --zvd-border: #27272a;
          --zvd-bg: #18181a;
          --zvd-header-bg: #202022;
          --zvd-text: #f4f4f5;
          --zvd-text-muted: #52525b;
          --zvd-gutter-bg: #1a1a1c;
          --zvd-line-hover: rgba(255, 255, 255, 0.02);
          --zvd-caret: #f4f4f5;
          --zvd-selection: rgba(216, 107, 42, 0.2);
        }
        .zvd-inline-editor__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--zvd-header-bg, #202022);
          border-bottom: 1px solid var(--zvd-border, #27272a);
          min-height: 32px;
        }
        .zvd-inline-editor__info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--zvd-text-muted, #52525b);
          min-width: 0;
        }
        .zvd-inline-editor__lang-label {
          color: var(--zvd-accent, #d86b2a);
          font-weight: 500;
        }
        .zvd-inline-editor__filename {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .zvd-inline-editor__actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .zvd-inline-editor__btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 120ms ease, opacity 120ms ease;
          background: transparent;
          color: var(--zvd-text-muted, #52525b);
          font-family: inherit;
        }
        .zvd-inline-editor__btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--zvd-text, #f4f4f5);
        }
        .zvd-inline-editor__btn--save {
          background: var(--zvd-accent, #d86b2a);
          color: #fff;
        }
        .zvd-inline-editor__btn--save:hover {
          opacity: 0.85;
          background: var(--zvd-accent, #d86b2a);
          color: #fff;
        }
        .zvd-inline-editor__btn--cancel:hover {
          background: rgba(255, 77, 79, 0.1);
          color: #ff4d4f;
        }
        .zvd-inline-editor__body {
          display: flex;
          position: relative;
          background: var(--zvd-bg, #18181a);
        }
        .zvd-inline-editor__gutter {
          flex-shrink: 0;
          width: 48px;
          padding: 10px 0;
          background: var(--zvd-gutter-bg, #1a1a1c);
          border-right: 1px solid var(--zvd-border, #27272a);
          overflow: hidden;
          user-select: none;
        }
        .zvd-inline-editor__line-num {
          display: block;
          padding: 0 10px 0 0;
          text-align: right;
          font-size: 12px;
          line-height: 1.6;
          color: var(--zvd-text-muted, #52525b);
        }
        .zvd-inline-editor__line-num--active {
          color: var(--zvd-accent, #d86b2a);
          font-weight: 500;
        }
        .zvd-inline-editor__textarea {
          flex: 1;
          display: block;
          width: 100%;
          padding: 10px 14px;
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          color: var(--zvd-text, #f4f4f5);
          caret-color: var(--zvd-caret, #f4f4f5);
          font-family: inherit;
          font-size: 13px;
          line-height: 1.6;
          tab-size: 2;
          -moz-tab-size: 2;
          white-space: pre;
          overflow-wrap: normal;
          overflow-x: auto;
          min-height: var(--editor-min-h, 120px);
          max-height: var(--editor-max-h, 480px);
        }
        .zvd-inline-editor__textarea::placeholder {
          color: var(--zvd-text-muted, #52525b);
        }
        .zvd-inline-editor__textarea::selection {
          background: var(--zvd-selection, rgba(216, 107, 42, 0.2));
        }
        .zvd-inline-editor__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 12px;
          border-top: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-header-bg, #202022);
          font-size: 11px;
          color: var(--zvd-text-muted, #52525b);
        }
        .zvd-inline-editor__shortcuts {
          display: flex;
          gap: 12px;
        }
        .zvd-inline-editor__shortcut kbd {
          display: inline-block;
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid var(--zvd-border, #27272a);
          background: var(--zvd-gutter-bg, #1a1a1c);
          font-family: inherit;
          font-size: 10px;
          margin-right: 3px;
        }
        .zvd-inline-editor--readonly {
          opacity: 0.8;
        }
        .zvd-inline-editor--readonly .zvd-inline-editor__textarea {
          cursor: default;
        }
      `}</style>

      {/* Header */}
      <div className="zvd-inline-editor__header">
        <div className="zvd-inline-editor__info">
          <LangIcon size={14} stroke={1.6} />
          <span className="zvd-inline-editor__lang-label">{language}</span>
          {filename && (
            <>
              <span style={{ color: 'var(--zvd-text-muted, #52525b)' }}>/</span>
              <span className="zvd-inline-editor__filename">{filename}</span>
            </>
          )}
        </div>
        {!readOnly && (
          <div className="zvd-inline-editor__actions">
            <button
              className="zvd-inline-editor__btn zvd-inline-editor__btn--cancel"
              onClick={onCancel}
              type="button"
              title="Cancel (Esc)"
            >
              <IconX size={14} />
              Cancel
            </button>
            <button
              className="zvd-inline-editor__btn zvd-inline-editor__btn--save"
              onClick={() => onSave?.(value)}
              type="button"
              title="Save (Ctrl+S)"
            >
              <IconDeviceFloppy size={14} />
              Save
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div
        className="zvd-inline-editor__body"
        style={{
          minHeight,
          maxHeight,
        } as React.CSSProperties}
      >
        {/* Line numbers gutter */}
        <div className="zvd-inline-editor__gutter" ref={lineNumbersRef} aria-hidden="true">
          {lines.map((_, i) => (
            <span key={i} className="zvd-inline-editor__line-num">
              {i + 1}
            </span>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="zvd-inline-editor__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          data-gramm="false"
          style={
            {
              '--editor-min-h': `${minHeight}px`,
              '--editor-max-h': `${maxHeight}px`,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Footer */}
      <div className="zvd-inline-editor__footer">
        <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <div className="zvd-inline-editor__shortcuts">
          <span className="zvd-inline-editor__shortcut">
            <kbd>Tab</kbd> indent
          </span>
          <span className="zvd-inline-editor__shortcut">
            <kbd>Ctrl</kbd>+<kbd>S</kbd> save
          </span>
          <span className="zvd-inline-editor__shortcut">
            <kbd>Esc</kbd> cancel
          </span>
          <span className="zvd-inline-editor__shortcut">
            <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo
          </span>
        </div>
      </div>
    </div>
  );
});
