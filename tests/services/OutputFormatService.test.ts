import fs from 'fs';
import os from 'os';
import path from 'path';
import { OutputFormatService } from '../../src/services/OutputFormatService';

describe('OutputFormatService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-outputformat-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero rules when no OUTPUT-FORMAT.md exists', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.ruleCount).toBe(0);
    expect(status.filePath).toBe(path.join(tempDir, 'OUTPUT-FORMAT.md'));
  });

  it('sets a rule and persists it to OUTPUT-FORMAT.md', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });

    const rule = service.setRule('explanation', {
      format: 'structured',
      maxLength: 500,
      includeExamples: true,
      useBulletPoints: true,
      useTables: false,
    });

    expect(rule.context).toBe('explanation');
    expect(rule.format).toBe('structured');
    expect(rule.maxLength).toBe(500);
    expect(rule.includeExamples).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'OUTPUT-FORMAT.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'OUTPUT-FORMAT.md'), 'utf8');
    expect(fileContent).toContain('[explanation] structured');
    expect(fileContent).toContain('maxLength:500');
  });

  it('overwrites rule for the same context', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });
    service.setRule('code', { format: 'compact', includeExamples: false, useBulletPoints: false, useTables: false });

    service.setRule('code', { format: 'verbose', maxLength: 1000, includeExamples: true, useBulletPoints: true, useTables: true });

    const rule = service.getRule('code');
    expect(rule?.format).toBe('verbose');
    expect(rule?.maxLength).toBe(1000);
  });

  it('getFormatHint returns empty string for unconfigured context', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });

    const hint = service.getFormatHint('explanation');

    expect(hint).toBe('');
  });

  it('getFormatHint returns formatted hint for configured context', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });
    service.setRule('explanation', { format: 'markdown', maxLength: 300, includeExamples: true, useBulletPoints: false, useTables: true });

    const hint = service.getFormatHint('explanation');

    expect(hint).toContain('markdown');
    expect(hint).toContain('300');
    expect(hint).toContain('Examples: yes');
    expect(hint).toContain('Tables: yes');
  });

  it('lists multiple rules across contexts', () => {
    const service = new OutputFormatService({ projectRoot: tempDir });
    service.setRule('code', { format: 'compact', includeExamples: false, useBulletPoints: false, useTables: false });
    service.setRule('explanation', { format: 'detailed', includeExamples: true, useBulletPoints: true, useTables: false });

    const rules = service.listRules();

    expect(rules.length).toBe(2);
    expect(rules.map((r) => r.context)).toEqual(expect.arrayContaining(['code', 'explanation']));
  });
});
