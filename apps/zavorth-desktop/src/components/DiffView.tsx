import { useMemo, memo } from 'react';
import { IconFileCode } from '@tabler/icons-react';

interface DiffViewProps {
  content: string;
  filename?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  marker: string;
  lineNum: number;
}

function parseDiffLines(content: string): DiffLine[] {
  const rawLines = content.split('\n');
  const result: DiffLine[] = [];
  let lineNum = 0;

  for (const raw of rawLines) {
    lineNum++;
    if (raw.startsWith('+')) {
      result.push({
        type: 'added',
        text: raw.substring(1),
        marker: '+',
        lineNum,
      });
    } else if (raw.startsWith('-')) {
      result.push({
        type: 'removed',
        text: raw.substring(1),
        marker: '-',
        lineNum,
      });
    } else {
      // Unchanged lines may start with a space or have no prefix
      const text = raw.startsWith(' ') ? raw.substring(1) : raw;
      result.push({
        type: 'unchanged',
        text,
        marker: ' ',
        lineNum,
      });
    }
  }

  return result;
}

export const DiffView = memo(function DiffView({ content, filename }: DiffViewProps) {
  const lines = useMemo(() => parseDiffLines(content), [content]);

  return (
    <div className="zvd-diff-view">
      {filename && (
        <div className="zvd-diff-view__header">
          <IconFileCode size={14} stroke={1.6} />
          <span>{filename}</span>
        </div>
      )}
      <div className="zvd-diff-view__body">
        {lines.map((line, i) => (
          <div key={i} className={`zvd-diff-line zvd-diff-line--${line.type}`}>
            <span className="zvd-diff-line__num">{line.lineNum}</span>
            <span className="zvd-diff-line__marker">{line.marker}</span>
            <span className="zvd-diff-line__text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
