import { useEffect, useState, useRef, useCallback, memo } from 'react';
import type { FileExplorerNode } from './FileExplorer';

interface AtCompletionsProps {
  value: string;
  onChange(val: string): void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  workspacePath?: string | null;
  workspaceId?: string | null;
}

interface Suggestion {
  label: string;
  insertText: string;
  type: 'directive' | 'file';
}

export const AtCompletions = memo(function AtCompletions({
  value,
  onChange,
  textareaRef,
  workspacePath,
  workspaceId,
}: AtCompletionsProps) {
  const [triggerPos, setTriggerPos] = useState<{ start: number; end: number } | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load files when workspace changes
  useEffect(() => {
    if (!window.zavorthDesktop?.readFileTree || !workspacePath) {
      setAllFiles([]);
      return;
    }
    
    window.zavorthDesktop.readFileTree(workspacePath).then(res => {
      if (res.ok && res.tree) {
        const paths: string[] = [];
        const traverse = (nodes: FileExplorerNode[]) => {
          for (const node of nodes) {
            if (node.type === 'file') {
              paths.push(node.relativePath);
            } else if (node.children) {
              traverse(node.children);
            }
          }
        };
        traverse(res.tree);
        setAllFiles(paths);
      }
    }).catch(() => {});
  }, [workspacePath, workspaceId]);

  // Track cursor position and text before cursor to check for @ trigger
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleSelection = () => {
      const start = textarea.selectionStart;
      const textBefore = value.slice(0, start);
      const match = textBefore.match(/@(\S*)$/);

      if (match) {
        setTriggerPos({
          start: start - match[0].length,
          end: start,
        });
        setQuery(match[1]);
      } else {
        setTriggerPos(null);
        setQuery('');
      }
    };

    textarea.addEventListener('keyup', handleSelection);
    textarea.addEventListener('click', handleSelection);

    return () => {
      textarea.removeEventListener('keyup', handleSelection);
      textarea.removeEventListener('click', handleSelection);
    };
  }, [value, textareaRef]);

  // Generate suggestions based on query
  useEffect(() => {
    if (triggerPos === null) {
      setSuggestions([]);
      return;
    }

    const staticDirectives: Suggestion[] = [
      { label: '@url', insertText: '@url:"https://"', type: 'directive' },
      { label: '@image', insertText: '@image:"data:image/..."', type: 'directive' },
      { label: '@file', insertText: '@file:""', type: 'directive' },
    ];

    const fileSuggestions: Suggestion[] = allFiles
      .filter(f => f.toLowerCase().includes(query.toLowerCase()))
      .map(f => ({
        label: `@${f}`,
        insertText: `@file:"${f}"`,
        type: 'file',
      }));

    const list = [...staticDirectives, ...fileSuggestions].filter(s =>
      s.label.toLowerCase().includes(`@${query.toLowerCase()}`)
    );

    setSuggestions(list.slice(0, 8));
    setSelectedIndex(0);
  }, [triggerPos, query, allFiles]);

  const handleSelect = useCallback((suggestion: Suggestion) => {
    if (!triggerPos || !textareaRef.current) return;
    const textarea = textareaRef.current;
    
    const before = value.slice(0, triggerPos.start);
    const after = value.slice(triggerPos.end);
    const insert = suggestion.insertText;
    
    onChange(`${before}${insert}${after}`);
    setTriggerPos(null);
    
    // Restore focus and cursor position after insert
    setTimeout(() => {
      textarea.focus();
      const nextPos = triggerPos.start + insert.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 50);
  }, [value, onChange, triggerPos, textareaRef]);

  // Handle key listeners for navigation
  useEffect(() => {
    if (suggestions.length === 0 || !triggerPos) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTriggerPos(null);
      }
    };

    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, triggerPos, handleSelect, textareaRef]);

  if (suggestions.length === 0 || !triggerPos) return null;

  return (
    <div className="zvd-autocomplete-popover" ref={popoverRef}>
      <style>{`
        .zvd-autocomplete-popover {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 20px;
          background: #18181a;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 4px;
          min-width: 200px;
          max-width: 320px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
          z-index: 99999;
          animation: zvdAutocompleteFade 150ms ease;
        }
        .zvd-autocomplete-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          background: transparent;
          border: none;
          padding: 8px 10px;
          border-radius: 6px;
          text-align: left;
          cursor: pointer;
          color: #d4d4d8;
          font-size: 13px;
          gap: 12px;
        }
        .zvd-autocomplete-item:hover,
        .zvd-autocomplete-item--active {
          background: #202022;
          color: #fff;
        }
        .zvd-autocomplete-item--active {
          color: var(--zvd-accent, #d86b2a) !important;
          background: rgba(216, 107, 42, 0.06);
        }
        .zvd-autocomplete-item-label {
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .zvd-autocomplete-item-type {
          font-size: 10px;
          opacity: 0.5;
          text-transform: uppercase;
        }
        @keyframes zvdAutocompleteFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {suggestions.map((suggestion, index) => {
        const isActive = index === selectedIndex;
        return (
          <button
            key={suggestion.label}
            type="button"
            className={`zvd-autocomplete-item ${isActive ? 'zvd-autocomplete-item--active' : ''}`}
            onClick={() => handleSelect(suggestion)}
          >
            <span className="zvd-autocomplete-item-label">{suggestion.label}</span>
            <span className="zvd-autocomplete-item-type">
              {suggestion.type === 'directive' ? 'Diretiva' : 'Arquivo'}
            </span>
          </button>
        );
      })}
    </div>
  );
});
