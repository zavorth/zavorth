import { useState, useCallback, memo } from 'react';
import {
  IconTool,
  IconCheck,
  IconX,
  IconLoader2,
  IconChevronRight,
} from '@tabler/icons-react';

interface ToolCallBlockProps {
  toolName: string;
  args?: string;
  result?: string;
  status?: 'running' | 'success' | 'error';
  duration?: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remaining = Math.round(secs % 60);
  return `${mins}m ${remaining}s`;
}

const StatusIcon = memo(function StatusIcon({ status }: { status?: 'running' | 'success' | 'error' }) {
  switch (status) {
    case 'running':
      return (
        <span className="zvd-tool-call__status zvd-tool-call__status--running">
          <IconLoader2 size={15} stroke={2} />
        </span>
      );
    case 'success':
      return (
        <span className="zvd-tool-call__status zvd-tool-call__status--success">
          <IconCheck size={15} stroke={2.2} />
        </span>
      );
    case 'error':
      return (
        <span className="zvd-tool-call__status zvd-tool-call__status--error">
          <IconX size={15} stroke={2.2} />
        </span>
      );
    default:
      return null;
  }
});

export const ToolCallBlock = memo(function ToolCallBlock({
  toolName,
  args,
  result,
  status,
  duration,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded(prev => !prev), []);
  const toggleResult = useCallback(() => setResultExpanded(prev => !prev), []);

  const stateClass = expanded ? 'zvd-tool-call--expanded' : 'zvd-tool-call--collapsed';

  return (
    <div className={`zvd-tool-call ${stateClass}`}>
      <button
        className="zvd-tool-call__header"
        onClick={toggle}
        type="button"
        aria-expanded={expanded}
      >
        <span className="zvd-tool-call__icon">
          <IconTool size={14} stroke={1.8} />
        </span>
        <span className="zvd-tool-call__name">{toolName}</span>
        <StatusIcon status={status} />
        {duration != null && (
          <span className="zvd-tool-call__duration">{formatDuration(duration)}</span>
        )}
        <span className="zvd-tool-call__chevron">
          <IconChevronRight size={14} stroke={2} />
        </span>
      </button>

      <div className="zvd-tool-call__body">
        {args && (
          <div className="zvd-tool-call__section">
            <div className="zvd-tool-call__section-label">Argumentos</div>
            <pre>{args}</pre>
          </div>
        )}
        {result && (
          <div className="zvd-tool-call__section">
            <div className="zvd-tool-call__section-label">Resultado</div>
            <div
              className={
                resultExpanded
                  ? 'zvd-tool-call__result-expanded'
                  : 'zvd-tool-call__result-truncated'
              }
            >
              <pre>{result}</pre>
            </div>
            {result.length > 400 && (
              <button
                className="zvd-tool-call__expand-btn"
                onClick={toggleResult}
                type="button"
              >
                {resultExpanded ? 'Recolher' : 'Expandir resultado'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
