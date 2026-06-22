import fs from 'fs';
import os from 'os';
import path from 'path';
import { BehavioralRulesService } from '../../src/services/BehavioralRulesService';

describe('BehavioralRulesService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-rules-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero rules when no RULES.md exists', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.ruleCount).toBe(0);
    expect(status.filePath).toBe(path.join(tempDir, 'RULES.md'));
  });

  it('adds a rule and writes it to RULES.md', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });

    const rule = service.addRule({
      id: 'no-console-log',
      context: 'code',
      directive: 'Never use console.log in production code',
      severity: 'strict',
    });

    expect(rule.id).toBe('no-console-log');
    expect(fs.existsSync(path.join(tempDir, 'RULES.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'RULES.md'), 'utf8');
    expect(fileContent).toContain('no-console-log');
    expect(fileContent).toContain('Never use console.log in production code');
  });

  it('lists rules filtered by context', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });
    service.addRule({ id: 'code-rule', context: 'code', directive: 'Write tests', severity: 'prefer' });
    service.addRule({ id: 'review-rule', context: 'review', directive: 'Check types', severity: 'strict' });

    const codeRules = service.listRules('code');

    expect(codeRules.length).toBe(1);
    expect(codeRules[0].id).toBe('code-rule');
  });

  it('removes a rule by id', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });
    service.addRule({ id: 'temp-rule', context: 'always', directive: 'Be concise', severity: 'suggest' });

    const removed = service.removeRule('temp-rule');

    expect(removed).toBe(true);
    expect(service.listRules().length).toBe(0);
  });

  it('returns false when removing a non-existent rule', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });

    const removed = service.removeRule('ghost');

    expect(removed).toBe(false);
  });

  it('renders system prompt from rules', () => {
    const service = new BehavioralRulesService({ projectRoot: tempDir });
    service.addRule({ id: 'r1', context: 'code', directive: 'Use strict types', severity: 'strict' });
    service.addRule({ id: 'r2', context: 'code', directive: 'Prefer const', severity: 'suggest' });

    const prompt = service.renderSystemPrompt();

    expect(prompt).toContain('[STRICT] Use strict types');
    expect(prompt).toContain('[SUGGEST] Prefer const');
  });
});
