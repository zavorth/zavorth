import fs from 'node:fs';
import path from 'node:path';


describe('ZavorthApprovalProofService', () => {
  const repositoryRoot = path.resolve(__dirname, '..', '..');
  const securityDir = path.join(repositoryRoot, 'src', 'security');

  it('confirms the standalone approval proof service module was removed', () => {
    const modulePath = path.join(securityDir, 'ZavorthApprovalProofService.ts');
    expect(fs.existsSync(modulePath)).toBe(false);
  });

  it('does not export issueZavorthApprovalProof or consumeZavorthApprovalProof from any security module', () => {
    const files = fs.readdirSync(securityDir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(securityDir, file), 'utf8');
      expect(content).not.toMatch(/export\s+(?:async\s+)?function\s+issueZavorthApprovalProof/);
      expect(content).not.toMatch(/export\s+(?:async\s+)?function\s+consumeZavorthApprovalProof/);
    }
  });

  it('confirms no orphaned approval proof imports exist in other source files', () => {
    const srcDir = path.join(repositoryRoot, 'src');
    const results: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(fullPath); continue; }
        if (!entry.name.endsWith('.ts')) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('ZavorthApprovalProofService')) {
          results.push(path.relative(repositoryRoot, fullPath));
        }
      }
    }
    walk(srcDir);
    expect(results).toEqual([]);
  });
});
