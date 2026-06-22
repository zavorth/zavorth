import fs from 'fs';
import os from 'os';
import path from 'path';
import { DomainSpecializationService } from '../../src/services/DomainSpecializationService';

describe('DomainSpecializationService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-domain-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists all available domains from the catalog', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    const domains = service.listDomains();

    expect(domains.length).toBeGreaterThanOrEqual(10);
    expect(domains.map((d) => d.id)).toContain('software-engineering');
    expect(domains.map((d) => d.id)).toContain('general');
  });

  it('resolves domain explicitly by id', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    const resolution = service.resolve({ domainId: 'data-science' });

    expect(resolution.domainId).toBe('data-science');
    expect(resolution.confidence).toBe('explicit');
  });

  it('resolves domain from intent text via natural aliases', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    const resolution = service.resolve({ intent: 'I need help with programming and refactoring' });

    expect(resolution.domainId).toBe('software-engineering');
    expect(resolution.confidence).toBe('high');
  });

  it('falls back to general when no domain matches', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    const resolution = service.resolve({ intent: 'tell me about unicorns' });

    expect(resolution.domainId).toBe('general');
    expect(resolution.confidence).toBe('fallback');
  });

  it('applies domain and writes DOMAIN.md', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    service.applyDomain('devops');

    expect(fs.existsSync(path.join(tempDir, 'DOMAIN.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'DOMAIN.md'), 'utf8');
    expect(fileContent).toContain('DevOps');
    expect(fileContent).toContain('infrastructure as code');
  });

  it('builds a contract with selected domain info', () => {
    const service = new DomainSpecializationService({ projectRoot: tempDir });

    const contract = service.buildContract({ domainId: 'software-engineering' });

    expect(contract.schemaVersion).toBe(1);
    expect(contract.selected.domainId).toBe('software-engineering');
    expect(contract.selected.vocabulary).toContain('api');
    expect(contract.resolution.confidence).toBe('explicit');
  });
});
