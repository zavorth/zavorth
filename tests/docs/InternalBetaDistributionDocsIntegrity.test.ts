import * as fs from 'fs';
import * as path from 'path';

describe('InternalBetaDistributionDocsIntegrity Tests (Phase 21M)', () => {
  const docsDir = path.join(__dirname, '../../docs/beta');
  const docFiles = [
    'internal-beta-distribution-dry-run.md',
    'internal-beta-tester-instructions.md',
    'internal-beta-artifact-manifest.md',
    'internal-beta-rollback.md',
    'internal-beta-delivery-checklist.md',
  ];

  it('verifies that all distribution documents exist in the docs/beta directory', () => {
    for (const file of docFiles) {
      const filePath = path.join(docsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('verifies that documents do not contain any secrets or raw leak markers', () => {
    const forbiddenPatterns = [
      /sk-[A-Za-z0-9-_]{20,}/, // Real-ish API key pattern
      /Authorization:\s*Bearer/i,
      /secretRef:\s*\S+/i,
      /sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A/i,
      /sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B/i,
    ];

    for (const file of docFiles) {
      const filePath = path.join(docsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('verifies that documents do not use PUBLIC_RELEASE and declare LOCAL_DRY_RUN_ONLY', () => {
    const manifestPath = path.join(docsDir, 'internal-beta-artifact-manifest.md');
    const content = fs.readFileSync(manifestPath, 'utf-8');

    expect(content).toContain('LOCAL_DRY_RUN_ONLY');
    expect(content).not.toContain('PUBLIC_RELEASE');
    expect(content).not.toContain('PUBLISHED');
    expect(content).not.toContain('UPLOADED');
  });

  it('verifies that documents clarify no push/publishing happened and binaries are not committed', () => {
    const dryRunPath = path.join(docsDir, 'internal-beta-distribution-dry-run.md');
    const dryRunContent = fs.readFileSync(dryRunPath, 'utf-8');
    expect(dryRunContent).toContain('Nenhum artefato foi ou será publicado');
    expect(dryRunContent).toContain('Git Push**: Não executado');

    const checklistPath = path.join(docsDir, 'internal-beta-delivery-checklist.md');
    const checklistContent = fs.readFileSync(checklistPath, 'utf-8');
    expect(checklistContent).toContain('Sem Artefatos Binários Commitados');
    expect(checklistContent).toContain('Sem Push Remoto');
    expect(checklistContent).toContain('Sem Public Release');
  });

  it('verifies that documents warn not to test HPM, PTY, or arbitrary shell without need', () => {
    const instructionsPath = path.join(docsDir, 'internal-beta-tester-instructions.md');
    const instructionsContent = fs.readFileSync(instructionsPath, 'utf-8');

    expect(instructionsContent).toContain('Host Power Mode (HPM) / PTY');
    expect(instructionsContent).toContain('Não ative esses modos sem extrema necessidade');
    expect(instructionsContent).toContain('Comandos de shell arbitrários ou destrutivos');
  });
});
