/**
 * UsageMetrics — Tracks and reports usage metrics across all improvements.
 *
 * Collects metrics from:
 * - Cognitive Firewall: token savings, tool filtering stats
 * - Tiered Autonomy: auto/notify/approve counts
 * - Progressive Disclosure: level progression, suggestions shown
 * - Tool Cache: hits, misses, evictions
 * - Predictive Loading: prediction accuracy
 *
 * Provides a unified dashboard view for monitoring system health.
 */

export interface UsageMetricsSnapshot {
  generatedAt: string;
  cognitiveFirewall: {
    totalEvaluations: number;
    totalToolsFiltered: number;
    estimatedTokensSaved: number;
    compactModeUsage: number;
    clusterModeUsage: number;
    predictiveModeUsage: number;
  };
  tieredAutonomy: {
    totalCandidates: number;
    autoApplied: number;
    notifyApplied: number;
    queuedForApproval: number;
    autoPercentage: number;
  };
  progressiveDisclosure: {
    totalUsers: number;
    levelDistribution: {
      basic: number;
      intermediate: number;
      advanced: number;
      expert: number;
    };
    suggestionsShown: number;
  };
  toolCache: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    currentSize: number;
    evictions: number;
  };
  predictiveLoading: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
  };
}

export class UsageMetricsService {
  private readonly metrics: {
    evaluations: number;
    toolsFiltered: number;
    tokensSaved: number;
    compactUsage: number;
    clusterUsage: number;
    predictiveUsage: number;
    candidates: number;
    autoApplied: number;
    notifyApplied: number;
    queuedForApproval: number;
    suggestionsShown: number;
    predictions: number;
    correctPredictions: number;
  };

  constructor() {
    this.metrics = {
      evaluations: 0,
      toolsFiltered: 0,
      tokensSaved: 0,
      compactUsage: 0,
      clusterUsage: 0,
      predictiveUsage: 0,
      candidates: 0,
      autoApplied: 0,
      notifyApplied: 0,
      queuedForApproval: 0,
      suggestionsShown: 0,
      predictions: 0,
      correctPredictions: 0,
    };
  }

  /**
   * Records a Cognitive Firewall evaluation.
   */
  recordFirewallEvaluation(input: {
    toolsFiltered: number;
    tokensSaved: number;
    compactMode: boolean;
    clusterMode: boolean;
    predictiveMode: boolean;
  }): void {
    this.metrics.evaluations++;
    this.metrics.toolsFiltered += input.toolsFiltered;
    this.metrics.tokensSaved += input.tokensSaved;
    if (input.compactMode) this.metrics.compactUsage++;
    if (input.clusterMode) this.metrics.clusterUsage++;
    if (input.predictiveMode) this.metrics.predictiveUsage++;
  }

  /**
   * Records a tiered autonomy decision.
   */
  recordTieredDecision(tier: 'auto' | 'notify' | 'approve'): void {
    this.metrics.candidates++;
    switch (tier) {
      case 'auto':
        this.metrics.autoApplied++;
        break;
      case 'notify':
        this.metrics.notifyApplied++;
        break;
      case 'approve':
        this.metrics.queuedForApproval++;
        break;
    }
  }

  /**
   * Records a progressive disclosure suggestion.
   */
  recordSuggestion(): void {
    this.metrics.suggestionsShown++;
  }

  /**
   * Records a predictive loading prediction.
   */
  recordPrediction(correct: boolean): void {
    this.metrics.predictions++;
    if (correct) this.metrics.correctPredictions++;
  }

  /**
   * Returns a snapshot of all metrics.
   */
  getSnapshot(levelDistribution?: { basic: number; intermediate: number; advanced: number; expert: number }): UsageMetricsSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      cognitiveFirewall: {
        totalEvaluations: this.metrics.evaluations,
        totalToolsFiltered: this.metrics.toolsFiltered,
        estimatedTokensSaved: this.metrics.tokensSaved,
        compactModeUsage: this.metrics.compactUsage,
        clusterModeUsage: this.metrics.clusterUsage,
        predictiveModeUsage: this.metrics.predictiveUsage,
      },
      tieredAutonomy: {
        totalCandidates: this.metrics.candidates,
        autoApplied: this.metrics.autoApplied,
        notifyApplied: this.metrics.notifyApplied,
        queuedForApproval: this.metrics.queuedForApproval,
        autoPercentage: this.metrics.candidates > 0
          ? Math.round((this.metrics.autoApplied / this.metrics.candidates) * 100)
          : 0,
      },
      progressiveDisclosure: {
        totalUsers: 0, // Would be injected from ProgressiveDisclosureService
        levelDistribution: levelDistribution || { basic: 0, intermediate: 0, advanced: 0, expert: 0 },
        suggestionsShown: this.metrics.suggestionsShown,
      },
      toolCache: {
        totalHits: 0, // Would be injected from ToolResultCache
        totalMisses: 0,
        hitRate: 0,
        currentSize: 0,
        evictions: 0,
      },
      predictiveLoading: {
        totalPredictions: this.metrics.predictions,
        correctPredictions: this.metrics.correctPredictions,
        accuracy: this.metrics.predictions > 0
          ? Math.round((this.metrics.correctPredictions / this.metrics.predictions) * 100)
          : 0,
      },
    };
  }

  /**
   * Returns a formatted text summary for logging.
   */
  formatSummary(): string {
    const snapshot = this.getSnapshot();
    return [
      '═══ Usage Metrics ═══',
      '',
      `Cognitive Firewall:`,
      `  Evaluations: ${snapshot.cognitiveFirewall.totalEvaluations}`,
      `  Tools filtered: ${snapshot.cognitiveFirewall.totalToolsFiltered}`,
      `  Tokens saved: ~${snapshot.cognitiveFirewall.estimatedTokensSaved}`,
      `  Compact mode: ${snapshot.cognitiveFirewall.compactModeUsage}x`,
      `  Cluster mode: ${snapshot.cognitiveFirewall.clusterModeUsage}x`,
      `  Predictive mode: ${snapshot.cognitiveFirewall.predictiveModeUsage}x`,
      '',
      `Tiered Autonomy:`,
      `  Total candidates: ${snapshot.tieredAutonomy.totalCandidates}`,
      `  Auto-applied: ${snapshot.tieredAutonomy.autoApplied} (${snapshot.tieredAutonomy.autoPercentage}%)`,
      `  Notify: ${snapshot.tieredAutonomy.notifyApplied}`,
      `  Queued for approval: ${snapshot.tieredAutonomy.queuedForApproval}`,
      '',
      `Progressive Disclosure:`,
      `  Suggestions shown: ${snapshot.progressiveDisclosure.suggestionsShown}`,
      '',
      `Predictive Loading:`,
      `  Predictions: ${snapshot.predictiveLoading.totalPredictions}`,
      `  Accuracy: ${snapshot.predictiveLoading.accuracy}%`,
      '',
      '═══════════════════════',
    ].join('\n');
  }
}
