import { describe, expect, it } from 'vitest';
import {
  applyAllPending,
  applyHunkDecision,
  buildHunkReceipt,
  filterDiffByDecisions,
  parseUnifiedDiff,
  pendingHunkCount,
  summarizeHunkDecisions,
  type DiffHunk,
} from '../src/trust/hunkApproval';

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 111..222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,5 @@
 line one
-line two
+line two edited
+extra line
 line three
@@ -10,2 +12,2 @@
 keep
-old
+new
`;

const MULTI_FILE_DIFF = `--- a/readme.md
+++ b/readme.md
@@ -1,1 +1,2 @@
 hello
+world
--- a/pkg.json
+++ b/pkg.json
@@ -2,1 +2,1 @@
-"v1"
+"v2"
`;

function sampleHunk(overrides: Partial<DiffHunk> = {}): DiffHunk {
  return {
    id: 'src/foo.ts#1-5',
    path: 'src/foo.ts',
    header: '@@ -1,3 +1,5 @@',
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 5,
    lines: [' line one', '-line two', '+line two edited', '+extra line', ' line three'],
    decision: 'pending',
    ...overrides,
  };
}

describe('parseUnifiedDiff', () => {
  it('returns empty for blank input', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
    expect(parseUnifiedDiff('   \n\n')).toEqual([]);
  });

  it('parses multi-hunk single file with stable ids', () => {
    const hunks = parseUnifiedDiff(SAMPLE_DIFF);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].path).toBe('src/foo.ts');
    expect(hunks[0].id).toBe('src/foo.ts#1-6');
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].oldLines).toBe(3);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].newLines).toBe(5);
    expect(hunks[0].header).toContain('@@ -1,3 +1,5 @@');
    expect(hunks[0].decision).toBe('pending');
    expect(hunks[0].lines.some((l) => l.startsWith('+'))).toBe(true);
    expect(hunks[0].lines.some((l) => l.startsWith('-'))).toBe(true);

    expect(hunks[1].id).toBe('src/foo.ts#12-14');
    expect(hunks[1].newStart).toBe(12);
    expect(hunks[1].newLines).toBe(2);
  });

  it('parses multiple files from +++ b/path headers', () => {
    const hunks = parseUnifiedDiff(MULTI_FILE_DIFF);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].path).toBe('readme.md');
    expect(hunks[0].id).toBe('readme.md#1-3');
    expect(hunks[1].path).toBe('pkg.json');
    expect(hunks[1].id).toBe('pkg.json#2-3');
  });

  it('handles default hunk line counts when omitted', () => {
    const diff = `--- a/x.ts
+++ b/x.ts
@@ -5 +7 @@
-old
+new
`;
    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldStart).toBe(5);
    expect(hunks[0].oldLines).toBe(1);
    expect(hunks[0].newStart).toBe(7);
    expect(hunks[0].newLines).toBe(1);
    expect(hunks[0].id).toBe('x.ts#7-8');
  });

  it('prefers +++ path over --- path and strips a/b prefixes', () => {
    const diff = `--- a/old-name.ts
+++ b/new-name.ts
@@ -1,1 +1,1 @@
-a
+b
`;
    const hunks = parseUnifiedDiff(diff);
    expect(hunks[0].path).toBe('new-name.ts');
    expect(hunks[0].id.startsWith('new-name.ts#')).toBe(true);
  });

  it('falls back to --- path when +++ is /dev/null', () => {
    const diff = `--- a/deleted.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-gone
`;
    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].path).toBe('deleted.ts');
  });

  it('uses path from diff --git when headers missing', () => {
    const diff = `diff --git a/only-git.ts b/only-git.ts
@@ -1,1 +1,1 @@
-a
+b
`;
    const hunks = parseUnifiedDiff(diff);
    expect(hunks[0].path).toBe('only-git.ts');
  });

  it('includes no-newline markers in body lines', () => {
    const diff = `--- a/t
+++ b/t
@@ -1,1 +1,1 @@
-old
\\ No newline at end of file
+new
\\ No newline at end of file
`;
    const hunks = parseUnifiedDiff(diff);
    expect(hunks[0].lines.some((l) => l.startsWith('\\'))).toBe(true);
  });
});

describe('applyHunkDecision / applyAllPending', () => {
  it('updates a single hunk by id immutably', () => {
    const a = sampleHunk({ id: 'a#1-2' });
    const b = sampleHunk({ id: 'b#1-2', path: 'b.ts' });
    const next = applyHunkDecision([a, b], 'a#1-2', 'approve');
    expect(next[0].decision).toBe('approve');
    expect(next[1].decision).toBe('pending');
    expect(a.decision).toBe('pending');
  });

  it('leaves list unchanged when hunk id is missing', () => {
    const hunks = [sampleHunk()];
    const next = applyHunkDecision(hunks, 'missing', 'reject');
    expect(next[0].decision).toBe('pending');
    expect(next).not.toBe(hunks);
  });

  it('applyAllPending only touches pending', () => {
    const hunks = [
      sampleHunk({ id: '1', decision: 'pending' }),
      sampleHunk({ id: '2', decision: 'approve' }),
      sampleHunk({ id: '3', decision: 'pending' }),
    ];
    const rejected = applyAllPending(hunks, 'reject');
    expect(rejected.map((h) => h.decision)).toEqual(['reject', 'approve', 'reject']);
  });

  it('can approve all pending', () => {
    const hunks = [sampleHunk({ id: '1' }), sampleHunk({ id: '2', decision: 'reject' })];
    expect(applyAllPending(hunks, 'approve').map((h) => h.decision)).toEqual([
      'approve',
      'reject',
    ]);
  });
});

describe('pendingHunkCount / summarize / filter', () => {
  it('counts pending hunks', () => {
    expect(pendingHunkCount([])).toBe(0);
    expect(
      pendingHunkCount([
        sampleHunk({ decision: 'pending' }),
        sampleHunk({ decision: 'approve' }),
        sampleHunk({ decision: 'reject' }),
      ]),
    ).toBe(1);
  });

  it('summarizes decisions', () => {
    const summary = summarizeHunkDecisions([
      sampleHunk({ decision: 'approve' }),
      sampleHunk({ decision: 'approve' }),
      sampleHunk({ decision: 'reject' }),
      sampleHunk({ decision: 'pending' }),
    ]);
    expect(summary).toEqual({ approved: 2, rejected: 1, pending: 1 });
  });

  it('filters by decision and decided', () => {
    const hunks = [
      sampleHunk({ id: 'a', decision: 'approve' }),
      sampleHunk({ id: 'b', decision: 'reject' }),
      sampleHunk({ id: 'c', decision: 'pending' }),
    ];
    expect(filterDiffByDecisions(hunks, 'approve').map((h) => h.id)).toEqual(['a']);
    expect(filterDiffByDecisions(hunks, 'reject').map((h) => h.id)).toEqual(['b']);
    expect(filterDiffByDecisions(hunks, 'pending').map((h) => h.id)).toEqual(['c']);
    expect(filterDiffByDecisions(hunks, 'decided').map((h) => h.id)).toEqual(['a', 'b']);
  });
});

describe('buildHunkReceipt', () => {
  it('builds receipt with ISO time and summary', () => {
    const now = new Date('2024-06-01T12:00:00.000Z');
    const receipt = buildHunkReceipt(sampleHunk(), 'approve', now);
    expect(receipt.hunkId).toBe('src/foo.ts#1-5');
    expect(receipt.path).toBe('src/foo.ts');
    expect(receipt.decision).toBe('approve');
    expect(receipt.at).toBe('2024-06-01T12:00:00.000Z');
    expect(receipt.summary).toMatch(/Approved/);
    expect(receipt.summary).toContain('src/foo.ts');
    expect(receipt.summary).toMatch(/\+/);
    expect(receipt.id).toContain('receipt:');
    expect(receipt.id).toContain(receipt.hunkId);
  });

  it('builds reject receipt', () => {
    const receipt = buildHunkReceipt(sampleHunk(), 'reject', new Date('2024-01-01T00:00:00.000Z'));
    expect(receipt.decision).toBe('reject');
    expect(receipt.summary).toMatch(/Rejected/);
  });
});

describe('end-to-end workflow', () => {
  it('parse → decide → filter → receipt', () => {
    const hunks = parseUnifiedDiff(SAMPLE_DIFF);
    expect(pendingHunkCount(hunks)).toBe(2);
    let next = applyHunkDecision(hunks, hunks[0].id, 'approve');
    next = applyHunkDecision(next, hunks[1].id, 'reject');
    expect(summarizeHunkDecisions(next)).toEqual({
      approved: 1,
      rejected: 1,
      pending: 0,
    });
    const approved = filterDiffByDecisions(next, 'approve');
    expect(approved).toHaveLength(1);
    const receipt = buildHunkReceipt(approved[0], 'approve', new Date('2025-01-01T00:00:00.000Z'));
    expect(receipt.path).toBe('src/foo.ts');
    expect(receipt.decision).toBe('approve');
  });
});
