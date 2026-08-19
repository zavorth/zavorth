import { ZavorthDiffPagerService } from '../../../src/services/diff/ZavorthDiffPagerService';

describe('ZavorthDiffPagerService', () => {
  let service: ZavorthDiffPagerService;

  beforeEach(() => {
    service = new ZavorthDiffPagerService();
  });

  it('should parse unified git diff accurately with hunk headers', () => {
    const rawDiff = `diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts
index 83a21bc..98bf12a 100644
--- a/src/auth/jwt.ts
+++ b/src/auth/jwt.ts
@@ -10,4 +10,5 @@ export function verifyToken(token: string) {
   const decoded = decode(token);
-  return decoded.valid;
+  const isExpired = Date.now() > decoded.exp;
+  return decoded.valid && !isExpired;
 }`;

    const files = service.parseUnifiedDiff(rawDiff);

    expect(files.length).toBe(1);
    const file = files[0];
    expect(file.filePath).toBe('src/auth/jwt.ts');
    expect(file.hunks.length).toBe(1);
    expect(file.totalAdditions).toBe(2);
    expect(file.totalDeletions).toBe(1);

    const hunk = file.hunks[0];
    expect(hunk.oldStart).toBe(10);
    expect(hunk.newStart).toBe(10);
    expect(hunk.isStaged).toBe(true);
    expect(hunk.isCollapsed).toBe(false);
  });

  it('should evaluate risk level properly for security-sensitive modifications', () => {
    const rawDiff = `diff --git a/config/.env b/config/.env
--- a/config/.env
+++ b/config/.env
@@ -1,2 +1,2 @@
-DB_PASS=old_password
+DB_PASS=new_password_token = 12345`;

    const files = service.parseUnifiedDiff(rawDiff);
    expect(files[0].overallRisk).toBe('CRITICAL');
    expect(files[0].hunks[0].riskReasons.length).toBeGreaterThan(0);
  });

  it('should toggle staging and collapse states idempotently', () => {
    const rawDiff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;`;

    let file = service.parseUnifiedDiff(rawDiff)[0];
    const hunkId = file.hunks[0].id;

    file = service.toggleHunkStaging(file, hunkId);
    expect(file.hunks[0].isStaged).toBe(false);

    file = service.toggleHunkStaging(file, hunkId);
    expect(file.hunks[0].isStaged).toBe(true);

    file = service.toggleHunkCollapse(file, hunkId);
    expect(file.hunks[0].isCollapsed).toBe(true);
  });

  it('should compute virtualized viewport slices correctly', () => {
    const items = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];
    const slice = service.computeVisibleSlice(items, 3, 4);

    expect(slice.visibleItems).toEqual(['L4', 'L5', 'L6', 'L7']);
    expect(slice.total).toBe(10);
    expect(slice.maxTopIndex).toBe(6);
  });

  it('should generate an inline AI explanation prompt', () => {
    const rawDiff = `diff --git a/src/core.ts b/src/core.ts
--- a/src/core.ts
+++ b/src/core.ts
@@ -1,2 +1,3 @@
 const a = 10;
+const b = 20;`;

    const file = service.parseUnifiedDiff(rawDiff)[0];
    const prompt = service.generateExplainPrompt(file.filePath, file.hunks[0]);

    expect(prompt).toContain('Please provide a concise 2-line explanation');
    expect(prompt).toContain('src/core.ts');
  });
});
