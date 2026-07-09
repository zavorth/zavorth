import { UsageMetricsService } from '../../src/services/UsageMetricsService';

describe('UsageMetricsService', () => {
  let service: UsageMetricsService;

  beforeEach(() => {
    service = new UsageMetricsService();
  });

  describe('recordFirewallEvaluation', () => {
    it('tracks evaluations and token savings', () => {
      service.recordFirewallEvaluation({
        toolsFiltered: 5,
        tokensSaved: 120,
        compactMode: true,
        clusterMode: true,
        predictiveMode: false,
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.cognitiveFirewall.totalEvaluations).toBe(1);
      expect(snapshot.cognitiveFirewall.totalToolsFiltered).toBe(5);
      expect(snapshot.cognitiveFirewall.estimatedTokensSaved).toBe(120);
      expect(snapshot.cognitiveFirewall.compactModeUsage).toBe(1);
      expect(snapshot.cognitiveFirewall.clusterModeUsage).toBe(1);
      expect(snapshot.cognitiveFirewall.predictiveModeUsage).toBe(0);
    });

    it('accumulates multiple evaluations', () => {
      service.recordFirewallEvaluation({ toolsFiltered: 3, tokensSaved: 60, compactMode: true, clusterMode: false, predictiveMode: false });
      service.recordFirewallEvaluation({ toolsFiltered: 4, tokensSaved: 80, compactMode: true, clusterMode: true, predictiveMode: true });

      const snapshot = service.getSnapshot();
      expect(snapshot.cognitiveFirewall.totalEvaluations).toBe(2);
      expect(snapshot.cognitiveFirewall.totalToolsFiltered).toBe(7);
      expect(snapshot.cognitiveFirewall.estimatedTokensSaved).toBe(140);
    });
  });

  describe('recordTieredDecision', () => {
    it('tracks tier distribution', () => {
      service.recordTieredDecision('auto');
      service.recordTieredDecision('auto');
      service.recordTieredDecision('notify');
      service.recordTieredDecision('approve');

      const snapshot = service.getSnapshot();
      expect(snapshot.tieredAutonomy.totalCandidates).toBe(4);
      expect(snapshot.tieredAutonomy.autoApplied).toBe(2);
      expect(snapshot.tieredAutonomy.notifyApplied).toBe(1);
      expect(snapshot.tieredAutonomy.queuedForApproval).toBe(1);
      expect(snapshot.tieredAutonomy.autoPercentage).toBe(50);
    });
  });

  describe('recordPrediction', () => {
    it('tracks prediction accuracy', () => {
      service.recordPrediction(true);
      service.recordPrediction(true);
      service.recordPrediction(false);

      const snapshot = service.getSnapshot();
      expect(snapshot.predictiveLoading.totalPredictions).toBe(3);
      expect(snapshot.predictiveLoading.correctPredictions).toBe(2);
      expect(snapshot.predictiveLoading.accuracy).toBe(67);
    });
  });

  describe('getSnapshot', () => {
    it('returns complete snapshot structure', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot.generatedAt).toBeDefined();
      expect(snapshot.cognitiveFirewall).toBeDefined();
      expect(snapshot.tieredAutonomy).toBeDefined();
      expect(snapshot.progressiveDisclosure).toBeDefined();
      expect(snapshot.toolCache).toBeDefined();
      expect(snapshot.predictiveLoading).toBeDefined();
    });

    it('accepts custom level distribution', () => {
      const snapshot = service.getSnapshot({
        basic: 10,
        intermediate: 5,
        advanced: 3,
        expert: 1,
      });

      expect(snapshot.progressiveDisclosure.levelDistribution.basic).toBe(10);
      expect(snapshot.progressiveDisclosure.levelDistribution.expert).toBe(1);
    });
  });

  describe('formatSummary', () => {
    it('returns formatted text', () => {
      service.recordFirewallEvaluation({ toolsFiltered: 5, tokensSaved: 120, compactMode: true, clusterMode: false, predictiveMode: false });
      service.recordTieredDecision('auto');

      const summary = service.formatSummary();

      expect(summary).toContain('Usage Metrics');
      expect(summary).toContain('Cognitive Firewall:');
      expect(summary).toContain('Tiered Autonomy:');
      expect(summary).toContain('5'); // tools filtered
      expect(summary).toContain('120'); // tokens saved
    });
  });
});
