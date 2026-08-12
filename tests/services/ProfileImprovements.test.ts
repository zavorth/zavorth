import { ProfileOnboardingService } from '../../src/services/ProfileOnboardingService';
import { SmartDefaultsService } from '../../src/services/SmartDefaultsService';
import { ProgressiveDisclosureService } from '../../src/services/ProgressiveDisclosureService';

describe('ProfileOnboardingService', () => {
  const service = new ProfileOnboardingService();

  it('returns correct question count per profile', () => {
    expect(service.getQuestionCount('personal')).toBe(3);
    expect(service.getQuestionCount('creator')).toBe(4);
    expect(service.getQuestionCount('developer')).toBe(5);
    expect(service.getQuestionCount('business')).toBe(6);
    expect(service.getQuestionCount('power')).toBe(2);
  });

  it('power has fastest onboarding (fewest questions)', () => {
    const counts = service.getAllFlows().map((f) => f.questions.length);
    const minCount = Math.min(...counts);
    expect(service.getQuestionCount('power')).toBe(minCount);
  });

  it('personal has second-fastest onboarding', () => {
    const counts = service.getAllFlows().map((f) => f.questions.length);
    const sorted = [...counts].sort((a, b) => a - b);
    expect(service.getQuestionCount('personal')).toBe(sorted[1]);
  });

  it('all flows have provider and apiKey questions', () => {
    for (const flow of service.getAllFlows()) {
      const questionIds = flow.questions.map((q) => q.id);
      expect(questionIds).toContain('provider');
      expect(questionIds).toContain('apiKey');
    }
  });

  it('getSummary returns all profiles', () => {
    const summary = service.getSummary();
    expect(summary).toHaveLength(5);
    expect(summary.map((s) => s.profileId)).toEqual(
      expect.arrayContaining(['personal', 'creator', 'developer', 'business', 'power']),
    );
  });
});

describe('SmartDefaultsService', () => {
  const service = new SmartDefaultsService();

  it('personal has lightweight memory and fast safety', () => {
    const defaults = service.getDefaults('personal');

    expect(defaults.memory.mode).toBe('local-metadata');
    expect(defaults.safety.mode).toBe('preview-first');
  });

  it('business has strict safety and full receipts', () => {
    const defaults = service.getDefaults('business');

    expect(defaults.safety.mode).toBe('governed');
    expect(defaults.receipts.level).toBe('audit');
  });

  it('developer has auto-install skills and cron enabled', () => {
    const defaults = service.getDefaults('developer');

    expect(defaults.skills.mode).toBe('auto-install');
    expect(defaults.cron.enabled).toBe(true);
  });

  it('personal has cron disabled', () => {
    const defaults = service.getDefaults('personal');
    expect(defaults.cron.enabled).toBe(false);
  });

  it('getComparisonTable returns all profiles', () => {
    const table = service.getComparisonTable();
    expect(table).toHaveLength(5);
  });

  it('personal is most autonomous in tiered autonomy', () => {
    const personal = service.getDefaults('personal');
    const business = service.getDefaults('business');

    expect(personal.tieredAutonomy.autoRiskThreshold).toBe('medium');
    expect(business.tieredAutonomy.autoRiskThreshold).toBe('low');
  });
});

describe('ProgressiveDisclosureService', () => {
  const service = new ProgressiveDisclosureService();

  it('starts at basic level', () => {
    const state = service.getState('user-1', 'personal');
    expect(state.currentLevel).toBe('basic');
  });

  it('promotes to intermediate after 10 conversations', () => {
    const userId = 'user-2';
    service.getState(userId, 'personal');

    for (let i = 0; i < 10; i++) {
      service.recordActivity(userId, 'conversation', { conversationCount: i + 1 });
    }

    expect(service.getLevel(userId)).toBe('intermediate');
  });

  it('promotes to advanced after skill use', () => {
    const userId = 'user-3';
    service.getState(userId, 'developer');

    // First get to intermediate
    for (let i = 0; i < 10; i++) {
      service.recordActivity(userId, 'conversation', { conversationCount: i + 1 });
    }

    // Then use a skill
    service.recordActivity(userId, 'skill-use');

    expect(service.getLevel(userId)).toBe('advanced');
  });

  it('returns suggestions for new milestones', () => {
    const userId = 'user-4';
    service.getState(userId, 'personal');

    const suggestions = service.recordActivity(userId, 'skill-use');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('does not repeat suggestions', () => {
    const userId = 'user-5';
    service.getState(userId, 'personal');

    service.recordActivity(userId, 'skill-use');
    const secondCall = service.recordActivity(userId, 'skill-use');

    expect(secondCall).toHaveLength(0);
  });

  it('manual promotion works', () => {
    const userId = 'user-6';
    service.getState(userId, 'personal');

    const newLevel = service.promoteLevel(userId);
    expect(newLevel).toBe('intermediate');
  });

  it('getAvailableFeatures returns empty for basic level', () => {
    const userId = 'user-7';
    service.getState(userId, 'personal');

    const features = service.getAvailableFeatures(userId);
    expect(features).toHaveLength(0);
  });

  it('getAvailableFeatures returns features after promotion', () => {
    const userId = 'user-8';
    service.getState(userId, 'personal');
    service.promoteLevel(userId); // to intermediate

    const features = service.getAvailableFeatures(userId);
    expect(features).toContain('stats-dashboard');
  });
});
