import { ProfileTieredAutonomyService } from '../../src/services/ProfileTieredAutonomyService';

describe('ProfileTieredAutonomyService', () => {
  const service = new ProfileTieredAutonomyService();

  describe('getConfig', () => {
    it('returns config for personal profile with full autonomy', () => {
      const config = service.getConfig('personal');

      expect(config.profileId).toBe('personal');
      expect(config.autoRiskThreshold).toBe('medium');
      expect(config.notifyRiskThreshold).toBe('high');
      expect(config.description).toContain('Maximum autonomy');
    });

    it('returns config for business profile with strict audit', () => {
      const config = service.getConfig('business');

      expect(config.profileId).toBe('business');
      expect(config.autoRiskThreshold).toBe('low');
      expect(config.forceApprovalKinds.length).toBeGreaterThan(0);
    });

    it('returns config for developer profile', () => {
      const config = service.getConfig('developer');

      expect(config.profileId).toBe('developer');
      expect(config.autoRiskThreshold).toBe('medium');
    });

    it('returns config for creator profile', () => {
      const config = service.getConfig('creator');

      expect(config.profileId).toBe('creator');
      expect(config.autoRiskThreshold).toBe('low');
    });

    it('returns config for power profile', () => {
      const config = service.getConfig('power');

      expect(config.profileId).toBe('power');
      expect(config.autoRiskThreshold).toBe('medium');
    });
  });

  describe('getAllConfigs', () => {
    it('returns configs for all 5 profiles', () => {
      const configs = service.getAllConfigs();

      expect(configs).toHaveLength(5);
      expect(configs.map((c) => c.profileId)).toEqual(
        expect.arrayContaining(['personal', 'creator', 'developer', 'business', 'power']),
      );
    });
  });

  describe('getAutonomySummary', () => {
    it('returns summary with correct structure', () => {
      const summary = service.getAutonomySummary();

      expect(summary).toHaveLength(5);

      const personal = summary.find((s) => s.profileId === 'personal');
      expect(personal).toBeDefined();
      expect(personal?.autoThreshold).toContain('medium');
      expect(personal?.description).toContain('Maximum');
    });

    it('personal has highest auto threshold (most autonomous)', () => {
      const summary = service.getAutonomySummary();
      const personal = summary.find((s) => s.profileId === 'personal')!;
      const business = summary.find((s) => s.profileId === 'business')!;

      // Personal should auto-apply more than business
      expect(personal.autoThreshold).toContain('medium');
      expect(business.autoThreshold).toContain('low');
    });
  });
});
