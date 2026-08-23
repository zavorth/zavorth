import { describe, expect, it } from 'vitest';
import {
  buildReviewFileRows,
  buildReviewShipBar,
  buildReviewRailModel,
  type ReviewFileRow,
} from '../src/shell/reviewRailModel';

describe('buildReviewFileRows', () => {
  it('returns empty for no input', () => {
    expect(buildReviewFileRows({})).toEqual([]);
    expect(buildReviewFileRows({ changedFiles: [], gitStatusText: null })).toEqual([]);
  });

  it('maps structured changedFiles', () => {
    const rows = buildReviewFileRows({
      changedFiles: [
        { path: 'src/a.ts', status: 'modified', additions: 3, deletions: 1 },
        { path: 'src/b.ts', status: 'added', additions: 10 },
        { path: 'old.md', status: 'deleted', deletions: 5 },
        { path: 'renamed.ts', status: 'renamed' },
      ],
    });
    expect(rows).toEqual([
      { path: 'src/a.ts', status: 'modified', additions: 3, deletions: 1 },
      { path: 'src/b.ts', status: 'added', additions: 10 },
      { path: 'old.md', status: 'deleted', deletions: 5 },
      { path: 'renamed.ts', status: 'renamed' },
    ]);
  });

  it('normalizes short status codes on structured files', () => {
    const rows = buildReviewFileRows({
      changedFiles: [
        { path: 'm.ts', status: 'M' },
        { path: 'a.ts', status: 'A' },
        { path: 'd.ts', status: 'D' },
        { path: 'u.ts', status: 'untracked' },
        { path: 'x.ts', status: 'weird' },
      ],
    });
    expect(rows.map(r => r.status)).toEqual([
      'modified',
      'added',
      'deleted',
      'added',
      'unknown',
    ]);
  });

  it('parses simple git status porcelain lines', () => {
    const text = [
      '## main...origin/main',
      ' M src/shell/rightRail.ts',
      '?? src/shell/newFile.ts',
      'A  src/added.ts',
      'D  src/gone.ts',
      'R  old.ts -> new.ts',
      'MM both.ts',
      '',
    ].join('\n');
    const rows = buildReviewFileRows({ gitStatusText: text });
    expect(rows).toEqual([
      { path: 'src/shell/rightRail.ts', status: 'modified' },
      { path: 'src/shell/newFile.ts', status: 'added' },
      { path: 'src/added.ts', status: 'added' },
      { path: 'src/gone.ts', status: 'deleted' },
      { path: 'new.ts', status: 'renamed' },
      { path: 'both.ts', status: 'modified' },
    ]);
  });

  it('dedupes paths and prefers structured over porcelain for same path', () => {
    const rows = buildReviewFileRows({
      changedFiles: [{ path: 'a.ts', status: 'modified', additions: 2 }],
      gitStatusText: ' M a.ts\n?? b.ts\n',
    });
    expect(rows).toEqual([
      { path: 'a.ts', status: 'modified', additions: 2 },
      { path: 'b.ts', status: 'added' },
    ]);
  });

  it('skips empty paths and duplicate structured entries', () => {
    const rows = buildReviewFileRows({
      changedFiles: [
        { path: '', status: 'added' },
        { path: 'a.ts', status: 'added' },
        { path: 'a.ts', status: 'modified' },
      ],
    });
    expect(rows).toEqual([{ path: 'a.ts', status: 'added' }]);
  });
});

describe('buildReviewShipBar', () => {
  const files: ReviewFileRow[] = [
    { path: 'a.ts', status: 'modified' },
    { path: 'b.ts', status: 'added' },
  ];

  it('reports clean working tree', () => {
    expect(
      buildReviewShipBar({ branch: 'main', dirty: false, files: [], recentReceiptCount: 0 }),
    ).toEqual({
      canShip: false,
      dirty: false,
      branch: 'main',
      fileCount: 0,
      receiptCount: 0,
      primaryAction: 'clean',
      label: 'Working tree clean',
    });
  });

  it('defaults branch to HEAD', () => {
    const bar = buildReviewShipBar({ files: [] });
    expect(bar.branch).toBe('HEAD');
    expect(bar.primaryAction).toBe('clean');
  });

  it('prefers commit when dirty with files and no receipts', () => {
    const bar = buildReviewShipBar({ branch: 'feature/x', files, recentReceiptCount: 0 });
    expect(bar).toMatchObject({
      canShip: true,
      dirty: true,
      branch: 'feature/x',
      fileCount: 2,
      receiptCount: 0,
      primaryAction: 'commit',
      label: 'Commit 2 files',
    });
  });

  it('uses singular file label', () => {
    const bar = buildReviewShipBar({
      files: [{ path: 'a.ts', status: 'modified' }],
    });
    expect(bar.label).toBe('Commit 1 file');
  });

  it('prefers review when receipts accompany dirty files', () => {
    const bar = buildReviewShipBar({
      branch: 'main',
      files,
      recentReceiptCount: 3,
    });
    expect(bar).toMatchObject({
      canShip: true,
      dirty: true,
      receiptCount: 3,
      primaryAction: 'review',
      label: 'Review 2 files',
    });
  });

  it('infers dirty from files when dirty flag omitted', () => {
    const bar = buildReviewShipBar({ files });
    expect(bar.dirty).toBe(true);
    expect(bar.canShip).toBe(true);
  });

  it('allows dirty with no file rows', () => {
    const bar = buildReviewShipBar({ dirty: true, files: [] });
    expect(bar).toMatchObject({
      canShip: true,
      dirty: true,
      fileCount: 0,
      primaryAction: 'commit',
      label: 'Commit changes',
    });
  });

  it('clamps denytive receipt counts', () => {
    const bar = buildReviewShipBar({ files, recentReceiptCount: -5 });
    expect(bar.receiptCount).toBe(0);
    expect(bar.primaryAction).toBe('commit');
  });
});

describe('buildReviewRailModel', () => {
  it('composes files + ship + selection', () => {
    const model = buildReviewRailModel({
      branch: 'main',
      gitStatusText: ' M a.ts\n?? b.ts\n',
      recentReceiptCount: 1,
      selectedPath: 'b.ts',
    });
    expect(model.files).toHaveLength(2);
    expect(model.ship.primaryAction).toBe('review');
    expect(model.selectedPath).toBe('b.ts');
  });

  it('falls back selection to first file when selected missing', () => {
    const model = buildReviewRailModel({
      changedFiles: [
        { path: 'x.ts', status: 'modified' },
        { path: 'y.ts', status: 'added' },
      ],
      selectedPath: 'missing.ts',
    });
    expect(model.selectedPath).toBe('x.ts');
  });

  it('null selection when no files', () => {
    const model = buildReviewRailModel({
      branch: 'main',
      dirty: false,
      selectedPath: 'nope.ts',
    });
    expect(model.files).toEqual([]);
    expect(model.selectedPath).toBeNull();
    expect(model.ship.primaryAction).toBe('clean');
  });

  it('uses structured changedFiles when provided', () => {
    const model = buildReviewRailModel({
      branch: 'dev',
      changedFiles: [{ path: 'app.tsx', status: 'modified', additions: 4, deletions: 2 }],
      dirty: true,
    });
    expect(model.files[0]).toEqual({
      path: 'app.tsx',
      status: 'modified',
      additions: 4,
      deletions: 2,
    });
    expect(model.ship.label).toBe('Commit 1 file');
  });
});
