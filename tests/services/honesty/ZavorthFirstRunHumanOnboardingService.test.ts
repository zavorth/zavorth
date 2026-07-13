import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthFirstRunHumanOnboardingService } from '../../../src/services/ZavorthFirstRunHumanOnboardingService.js';
import { resolveLearningRuntimePolicy } from '../../../src/services/ZavorthLearningRuntimePolicy.js';

describe('ZavorthFirstRunHumanOnboardingService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-first-run-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('walks three human steps and enables autonomous learning', () => {
    const s = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir });
    expect(s.needsOnboarding()).toBe(true);
    expect(s.answer('portugues').handled).toBe(true);
    expect(s.buildSnapshot().state.step).toBe(2);
    expect(s.answer('telegram').handled).toBe(true);
    expect(s.buildSnapshot().state.step).toBe(3);
    const done = s.answer('sim');
    expect(done.completedNow).toBe(true);
    expect(s.needsOnboarding()).toBe(false);
    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'local-user' }).mode).toBe('autonomous');
  });

  it('accepts skip and card-style applyStep', () => {
    const service = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir });
    service.applyStep({ language: 'en', surface: 'desktop', allowLearning: false });
    expect(service.needsOnboarding()).toBe(false);
    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'local-user' }).mode).toBe('governed');
  });

  it('does not match free-text setup NLU packs (Hermes-style)', () => {
    const service = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir });
    expect(service.matchNaturalCommand('comecar')).toBeNull();
    expect(service.matchNaturalCommand('pular setup')).toBeNull();
    expect(service.matchNaturalCommand('refazer setup')).toBeNull();
  });

  it('supports structured applyStep without free-text surface interception', () => {
    const service = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir });
    expect(service.needsOnboarding()).toBe(true);
    service.applyStep({ language: 'en' });
    expect(service.buildSnapshot().state.step).toBe(2);
    service.applyStep({ surface: 'telegram' });
    expect(service.buildSnapshot().state.step).toBe(3);
    service.applyStep({ allowLearning: true });
    expect(service.needsOnboarding()).toBe(false);
    expect(service.buildSnapshot().headline).toMatch(/Ready/i);
  });

  it('isolates first-run state and learning mode per userId', () => {
    const a = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir, userId: 'user-a' });
    const b = new ZavorthFirstRunHumanOnboardingService({ projectRoot: tempDir, userId: 'user-b' });
    a.complete({ language: 'pt', surface: 'telegram', allowLearning: true });
    b.complete({ language: 'en', surface: 'web', allowLearning: false });

    expect(a.needsOnboarding()).toBe(false);
    expect(b.needsOnboarding()).toBe(false);
    expect(a.buildSnapshot().state.language).toBe('pt');
    expect(b.buildSnapshot().state.language).toBe('en');
    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'user-a', env: {} }).mode).toBe('autonomous');
    expect(resolveLearningRuntimePolicy({ projectRoot: tempDir, userId: 'user-b', env: {} }).mode).toBe('governed');

    const pathA = path.join(tempDir, 'data', 'runtime', 'learning', 'users', 'user-a', 'first-run-human.json');
    const pathB = path.join(tempDir, 'data', 'runtime', 'learning', 'users', 'user-b', 'first-run-human.json');
    expect(fs.existsSync(pathA)).toBe(true);
    expect(fs.existsSync(pathB)).toBe(true);
  });
});
