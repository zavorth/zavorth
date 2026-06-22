import fs from 'fs';
import os from 'os';
import path from 'path';
import { AchievementsService } from '../../src/services/plugins/AchievementsService';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'achievements-test-'));
    service = new AchievementsService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates user state on first access', () => {
    const state = service.getUserState('user1');
    expect(state.user_id).toBe('user1');
    expect(state.level).toBe(1);
    expect(state.total_points).toBe(0);
  });

  it('tracks tool execution events', () => {
    const result = service.trackEvent('user1', 'tool_executions', 1);
    expect(result).toBeTruthy();
  });

  it('unlocks first_tool achievement', () => {
    service.trackEvent('user1', 'tool_executions', 1);
    const state = service.getUserState('user1');
    expect(state.achievements['first_tool'].unlocked).toBe(true);
    expect(state.total_points).toBe(10);
  });

  it('unlocks tool_master after 100 executions', () => {
    service.trackEvent('user1', 'tool_executions', 100);
    const state = service.getUserState('user1');
    expect(state.achievements['tool_master'].unlocked).toBe(true);
    expect(state.achievements['first_tool'].unlocked).toBe(true);
  });

  it('tracks streak', () => {
    const result = service.updateStreak('user1', 'daily_usage');
    expect(result).toContain('1 days');
  });

  it('manually unlocks achievement', () => {
    const result = service.unlockManually('user1', 'hidden_easter_egg');
    expect(result).toContain('unblocked');
  });

  it('gets user profile', () => {
    service.trackEvent('user1', 'tool_executions', 5);
    const result = service.getProfile('user1');
    expect(result).toContain('Nivel');
    expect(result).toContain('Pontos');
  });

  it('gets leaderboard', () => {
    service.trackEvent('user1', 'tool_executions', 10);
    service.trackEvent('user2', 'tool_executions', 5);
    const result = service.getLeaderboard();
    expect(result).toContain('user1');
    expect(result).toContain('user2');
  });

  it('returns error for non-existent achievement', () => {
    const result = service.unlockManually('user1', 'nonexistent');
    expect(result).toContain('not found');
  });

  it('returns error for already unlocked', () => {
    service.unlockManually('user1', 'hidden_easter_egg');
    const result = service.unlockManually('user1', 'hidden_easter_egg');
    expect(result).toContain('already unlocked');
  });

  it('calculates level correctly', () => {
    service.trackEvent('user1', 'tool_executions', 1000);
    const state = service.getUserState('user1');
    expect(state.level).toBeGreaterThan(1);
  });
});
