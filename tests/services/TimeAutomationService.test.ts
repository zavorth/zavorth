import fs from 'fs';
import os from 'os';
import path from 'path';
import { TimeAutomationService } from '../../src/services/TimeAutomationService';

describe('TimeAutomationService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-time-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero configured days and default timezone', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.configuredDays).toBe(0);
    expect(status.timezone).toBe('UTC');
    expect(status.weekendPolicy).toBe('normal');
    expect(status.filePath).toBe(path.join(tempDir, 'TIME-AUTOMATION.md'));
  });

  it('sets a schedule for a day and persists to TIME-AUTOMATION.md', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });

    service.setSchedule('monday', {
      workingHours: { start: '09:00', end: '17:00' },
      focusHours: { start: '10:00', end: '12:00' },
      available: true,
    });

    expect(fs.existsSync(path.join(tempDir, 'TIME-AUTOMATION.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'TIME-AUTOMATION.md'), 'utf8');
    expect(fileContent).toContain('[monday]');
    expect(fileContent).toContain('09:00-17:00');
    expect(fileContent).toContain('10:00-12:00');
  });

  it('gets schedule for a configured day', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });
    service.setSchedule('friday', {
      workingHours: { start: '08:00', end: '16:00' },
      focusHours: null,
      available: true,
    });

    const schedule = service.getSchedule('friday');

    expect(schedule).not.toBeNull();
    expect(schedule?.day).toBe('friday');
    expect(schedule?.workingHours).toEqual({ start: '08:00', end: '16:00' });
    expect(schedule?.focusHours).toBeNull();
  });

  it('returns null for unconfigured day', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });

    const schedule = service.getSchedule('sunday');

    expect(schedule).toBeNull();
  });

  it('isWorkingHours returns true within working window', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });
    service.setSchedule('tuesday', {
      workingHours: { start: '09:00', end: '17:00' },
      focusHours: null,
      available: true,
    });

    expect(service.isWorkingHours('tuesday', '10:00')).toBe(true);
    expect(service.isWorkingHours('tuesday', '08:00')).toBe(false);
    expect(service.isWorkingHours('tuesday', '18:00')).toBe(false);
  });

  it('isWorkingHours returns false when day is not available', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });
    service.setSchedule('saturday', {
      workingHours: { start: '10:00', end: '14:00' },
      focusHours: null,
      available: false,
    });

    expect(service.isWorkingHours('saturday', '12:00')).toBe(false);
  });

  it('setWeekendPolicy persists the policy', () => {
    const service = new TimeAutomationService({ projectRoot: tempDir });

    service.setWeekendPolicy('urgent-only');

    const status = service.getStatus();
    expect(status.weekendPolicy).toBe('urgent-only');
    const fileContent = fs.readFileSync(path.join(tempDir, 'TIME-AUTOMATION.md'), 'utf8');
    expect(fileContent).toContain('urgent-only');
  });
});
