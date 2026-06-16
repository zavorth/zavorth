import fs from 'fs';
import path from 'path';

describe('Extensibility, Approval Leases & Serverless Architecture Docs Integrity', () => {
  const docsToVerify = [
    'docs/architecture/extensibility-architecture-21S-A.md',
    'docs/architecture/service-composition-options-21S-A.md',
    'docs/architecture/extension-facade-design-21S-A.md',
    'docs/architecture/personal-approval-lease-architecture-21S-A.md',
    'docs/architecture/headless-serverless-architecture-21S-A.md',
    'docs/architecture/remote-database-adapter-design-21S-A.md',
    'docs/security/extension-tool-threat-model-21S-A.md',
    'docs/security/personal-approval-lease-threat-model-21S-A.md',
    'docs/security/serverless-cloud-threat-model-21S-A.md',
    'docs/security/remote-memory-sync-threat-model-21S-A.md',
    'docs/roadmap/phase-21S-A-verdict.md',
  ];

  it('verifies all required 21S-A documentation files exist', () => {
    for (const docRelativePath of docsToVerify) {
      const fullPath = path.resolve(process.cwd(), docRelativePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('validates that 21S-A is explicitly documented as design-only and implementation is forbidden', () => {
    for (const docRelativePath of docsToVerify) {
      const fullPath = path.resolve(process.cwd(), docRelativePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      expect(content).toContain('design-only');
      expect(content).toContain('No runtime implementation');
    }
  });

  it('validates safety invariants regarding risk classification, audit, and lease restrictions', () => {
    const leaseDoc = path.resolve(process.cwd(), 'docs/architecture/personal-approval-lease-architecture-21S-A.md');
    const leaseContent = fs.readFileSync(leaseDoc, 'utf8');

    expect(leaseContent).toContain('risk classification must not be downgraded');
    expect(leaseContent).toContain('disable auditing');
    expect(leaseContent).toContain('high/critical/destructive/shell:true/unknown tools must not be lease-approved');
    expect(leaseContent).toContain('caching approval for more than 24 hours reduces security');
    expect(leaseContent).toContain('multi-day leases must be narrowly scoped');
  });

  it('verifies that no docs claim the features were implemented in 21S-A', () => {
    const verdictDoc = path.resolve(process.cwd(), 'docs/roadmap/phase-21S-A-verdict.md');
    const verdictContent = fs.readFileSync(verdictDoc, 'utf8');

    expect(verdictContent).toContain('implementation intentionally deferred');
    expect(verdictContent).not.toContain('implemented ServiceRegistry');
    expect(verdictContent).not.toContain('implemented ExtensionFacade');
    expect(verdictContent).not.toContain('implemented approval lease runtime');
    expect(verdictContent).not.toContain('implemented headless');
    expect(verdictContent).not.toContain('Dockerfile.cloud was created');
    expect(verdictContent).not.toContain('Turso/libSQL was implemented');
    expect(verdictContent).not.toContain('S3/R2 sync was implemented');
    expect(verdictContent).not.toContain('Cloud Run/Lambda deployment occurred');
  });

  it('verifies that no documents contain real secrets', () => {
    const secretPattern = /(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})/i;
    for (const docRelativePath of docsToVerify) {
      const fullPath = path.resolve(process.cwd(), docRelativePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(secretPattern.test(content)).toBe(false);
    }
  });
});
