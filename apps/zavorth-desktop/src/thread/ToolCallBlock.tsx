import { useState, useCallback, useMemo, memo } from 'react';
import {
  IconTool,
  IconCheck,
  IconX,
  IconLoader2,
  IconChevronRight,
} from '@tabler/icons-react';
import { t } from '../i18n';
import {
  extractOpenTargets,
  preferDiffTarget,
  preferFileTarget,
  type OpenTarget,
} from './openFromChat';

interface ToolCallBlockProps {
  toolName: string;
  args?: string;
  result?: string;
  status?: 'running' | 'success' | 'error';
  duration?: number;
  onOpenPath?(path: string, line?: number): void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remaining = Math.round(secs % 60);
  return `${mins}m ${remaining}s`;
}

const StatusIcon = memo(function StatusIcon({
  status,
}: {
  status?: 'running' | 'success' | 'error';
}) {
  switch (status) {
    case 'running':
      return (
        <span
          className="zvd-tool-call__status zvd-tool-call__status--running"
          title={t('thread.toolRunning')}
          aria-label={t('thread.toolRunning')}
        >
          <IconLoader2 size={15} stroke={2} />
        </span>
      );
    case 'success':
      return (
        <span
          className="zvd-tool-call__status zvd-tool-call__status--success"
          title={t('thread.toolSuccess')}
          aria-label={t('thread.toolSuccess')}
        >
          <IconCheck size={15} stroke={2.2} />
        </span>
      );
    case 'error':
      return (
        <span
          className="zvd-tool-call__status zvd-tool-call__status--error"
          title={t('thread.toolError')}
          aria-label={t('thread.toolError')}
        >
          <IconX size={15} stroke={2.2} />
        </span>
      );
    default:
      return null;
  }
});

function openTargetButtonLabel(target: OpenTarget): string {
  if (target.kind === 'diff') return t('thread.openDiff');
  if (target.kind === 'folder') return t('thread.openFolder');
  return t('thread.openFile');
}

export const ToolCallBlock = memo(function ToolCallBlock({
  toolName,
  args,
  result,
  status = 'success',
  duration,
  onOpenPath,
}: ToolCallBlockProps) {
  // Default collapsed — only expand on user request.
  const [expanded, setExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded(prev => !prev), []);
  const toggleResult = useCallback(() => setResultExpanded(prev => !prev), []);

  const openTargets = useMemo(() => {
    const chunks = [result, args].filter((value): value is string => Boolean(value && value.trim()));
    if (!chunks.length) return [] as OpenTarget[];
    return extractOpenTargets(chunks.join('\n'));
  }, [args, result]);

  const preferred =
    preferFileTarget(openTargets) || preferDiffTarget(openTargets) || openTargets[0] || null;

  const handleOpen = useCallback(
    (target: OpenTarget) => {
      onOpenPath?.(target.path, target.line);
    },
    [onOpenPath],
  );

  const stateClass = expanded ? 'zvd-tool-call--expanded' : 'zvd-tool-call--collapsed';
  const statusClass =
    status === 'running'
      ? 'zvd-tool-call--running'
      : status === 'error'
        ? 'zvd-tool-call--error'
        : 'zvd-tool-call--success';

  const showOpenFooter = Boolean(onOpenPath && preferred);

  return (
    <div className={`zvd-tool-call ${stateClass} ${statusClass}`}>
      <button
        className="zvd-tool-call__header"
        onClick={toggle}
        type="button"
        aria-expanded={expanded}
      >
        <span className="zvd-tool-call__icon" aria-hidden="true">
          <IconTool size={14} stroke={1.8} />
        </span>
        <span className="zvd-tool-call__name">{toolName}</span>
        <StatusIcon status={status} />
        {duration != null && (
          <span className="zvd-tool-call__duration">{formatDuration(duration)}</span>
        )}
        <span className="zvd-tool-call__chevron" aria-hidden="true">
          <IconChevronRight size={14} stroke={2} />
        </span>
      </button>

      {showOpenFooter ? (
        <div className="zvd-tool-call__open-targets">
          <button
            type="button"
            className="zvd-tool-call__open-btn"
            title={preferred!.label}
            onClick={event => {
              event.stopPropagation();
              handleOpen(preferred!);
            }}
          >
            {openTargetButtonLabel(preferred!)}
            <span className="zvd-tool-call__open-path">{preferred!.label}</span>
          </button>
        </div>
      ) : null}

      <div className="zvd-tool-call__body" hidden={!expanded}>
        {args ? (
          <div className="zvd-tool-call__section">
            <div className="zvd-tool-call__section-label">{t('thread.toolArgs')}</div>
            <pre>{args}</pre>
          </div>
        ) : null}
        {result ? (
          <div className="zvd-tool-call__section">
            <div className="zvd-tool-call__section-label">{t('thread.toolResult')}</div>
            <div
              className={
                resultExpanded
                  ? 'zvd-tool-call__result-expanded'
                  : 'zvd-tool-call__result-truncated'
              }
            >
              <pre>{result}</pre>
            </div>
            {result.length > 400 ? (
              <button
                className="zvd-tool-call__expand-btn"
                onClick={toggleResult}
                type="button"
              >
                {resultExpanded ? t('thread.toolCollapse') : t('thread.toolExpand')}
              </button>
            ) : null}
          </div>
        ) : null}
        {onOpenPath && openTargets.length > 1 ? (
          <div className="zvd-tool-call__section zvd-tool-call__open-list">
            <div className="zvd-tool-call__section-label">{t('thread.openTargets')}</div>
            <div className="zvd-tool-call__open-targets zvd-tool-call__open-targets--stack">
              {openTargets.slice(0, 8).map(target => (
                <button
                  key={`${target.path}:${target.line ?? ''}:${target.kind}`}
                  type="button"
                  className="zvd-tool-call__open-btn"
                  onClick={() => handleOpen(target)}
                >
                  {openTargetButtonLabel(target)}
                  <span className="zvd-tool-call__open-path">{target.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
