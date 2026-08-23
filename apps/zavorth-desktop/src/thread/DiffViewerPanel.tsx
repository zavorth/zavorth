import { useMemo } from 'react';
import { parseUnifiedDiff } from '../trust/hunkApproval';
import { t } from '../i18n';

export type DiffLineTone = 'add' | 'remove' | 'context' | 'meta';

export type DiffViewerRow = {
  tone: DiffLineTone;
  text: string;
};

const DEFAULT_MAX_LINES = 400;

/** Classify one raw diff body line for colorization. */
export function classifyDiffLine(line: string): DiffLineTone {
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'remove';
  if (line.startsWith('@@')) return 'meta';
  return 'context';
}

/**
 * Flatten parsed hunks into bounded colorized rows. Long diffs truncate to
 * `maxLines` rows with a visible remainder notice instead of growing forever.
 */
export function buildDiffViewerRows(
  diffText: string,
  maxLines: number = DEFAULT_MAX_LINES,
): { rows: DiffViewerRow[]; total: number; truncated: number } {
  const hunks = parseUnifiedDiff(diffText);
  const lines = hunks.flatMap((hunk) => [hunk.header, ...hunk.lines]);
  const rows = lines.slice(0, maxLines).map((text) => ({ tone: classifyDiffLine(text), text }));
  return { rows, total: lines.length, truncated: Math.max(0, lines.length - maxLines) };
}

export function DiffViewerPanel(props: {
  diffText: string;
  maxLines?: number;
  compact?: boolean;
}) {
  const { rows, truncated } = useMemo(
    () => buildDiffViewerRows(props.diffText, props.maxLines),
    [props.diffText, props.maxLines],
  );

  if (!rows.length) return null;

  return (
    <div
      className={`zvd-diff-viewer${props.compact ? ' is-compact' : ''}`}
      role="figure"
      aria-label={t('changePreview.title')}
      data-truncated={truncated > 0 || undefined}
    >
      <pre className="zvd-diff-viewer__body" tabIndex={0}>
        {rows.map((row, index) => (
          <span key={index} className={`zvd-diff-line is-${row.tone}`}>
            {row.text || ' '}
            {'\n'}
          </span>
        ))}
      </pre>
      {truncated > 0 ? (
        <p className="zvd-diff-viewer__limit">{t('changePreview.limited')}</p>
      ) : null}
    </div>
  );
}
