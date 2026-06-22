import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProactivityPolicyService } from '../../src/services/ProactivityPolicyService';

describe('ProactivityPolicyService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-proactivity-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero rules and null quiet hours', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.ruleCount).toBe(0);
    expect(status.quietHours).toBeNull();
    expect(status.defaultChannel).toBe('cli');
  });

  it('adds a rule and persists it to PROACTIVITY.md', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });

    const rule = service.addRule({
      id: 'deploy-alert',
      trigger: 'deployment failed',
      channel: 'telegram',
      severity: 'high',
      action: 'notify',
    });

    expect(rule.id).toBe('deploy-alert');
    expect(fs.existsSync(path.join(tempDir, 'PROACTIVITY.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'PROACTIVITY.md'), 'utf8');
    expect(fileContent).toContain('deploy-alert');
    expect(fileContent).toContain('deployment failed');
  });

  it('removes a rule by id', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });
    service.addRule({ id: 'temp-trigger', trigger: 'test', channel: 'cli', severity: 'low', action: 'notify' });

    const removed = service.removeRule('temp-trigger');

    expect(removed).toBe(true);
    expect(service.listRules().length).toBe(0);
  });

  it('sets quiet hours and persists them', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });

    service.setQuietHours('22:00', '07:00');

    const status = service.getStatus();
    expect(status.quietHours).toEqual({ start: '22:00', end: '07:00' });
    const fileContent = fs.readFileSync(path.join(tempDir, 'PROACTIVITY.md'), 'utf8');
    expect(fileContent).toContain('22:00');
    expect(fileContent).toContain('07:00');
  });

  it('shouldNotify returns false during quiet hours for non-critical triggers', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });
    service.setQuietHours('22:00', '07:00');
    service.addRule({ id: 'r1', trigger: 'build complete', channel: 'cli', severity: 'low', action: 'notify' });

    const result = service.shouldNotify('build complete', '23:00');

    expect(result.notify).toBe(false);
  });

  it('shouldNotify returns true for critical triggers even during quiet hours', () => {
    const service = new ProactivityPolicyService({ projectRoot: tempDir });
    service.setQuietHours('22:00', '07:00');
    service.addRule({ id: 'critical-alert', trigger: 'security breach', channel: 'telegram', severity: 'critical', action: 'notify' });

    const result = service.shouldNotify('security breach detected', '23:00');

    expect(result.notify).toBe(true);
    expect(result.channel).toBe('telegram');
  });
});
