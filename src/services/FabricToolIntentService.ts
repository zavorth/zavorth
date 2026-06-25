import type { IntelligenceFabricSnapshot, IntelligenceRiskLevel } from '../contracts/native/IntelligenceFabricContract.js';
import type { FabricToolIntentSnapshot } from '../contracts/PracticalAgencyContract.js';

export class FabricToolIntentService {
  public buildSnapshot(input: { fabric: IntelligenceFabricSnapshot }): FabricToolIntentSnapshot {
    const actions = input.fabric.executionProposal.actions;
    const safeToolIntents = actions.filter((action) => action.riskLevel <= 2);
    const draftToolIntents = actions.filter((action) => action.riskLevel === 3);
    const gatedToolIntents = actions.filter((action) => action.riskLevel === 4);
    const blockedToolIntents = actions.filter((action) => action.riskLevel >= 5);
    const highestRisk = actions.reduce(
      (max, action) => (action.riskLevel > max ? action.riskLevel : max),
      0 as IntelligenceRiskLevel,
    );

    return {
      source: 'FabricToolIntentService',
      safeThinkingAllowed: true,
      safeToolIntents,
      draftToolIntents,
      gatedToolIntents,
      blockedToolIntents,
      highestRisk,
      nextStep: this.nextStep(highestRisk, safeToolIntents.length, draftToolIntents.length, gatedToolIntents.length),
      liveActionApplied: false,
    };
  }

  private nextStep(
    highestRisk: FabricToolIntentSnapshot['highestRisk'],
    safeCount: number,
    draftCount: number,
    gatedCount: number,
  ): FabricToolIntentSnapshot['nextStep'] {
    if (highestRisk >= 5) return 'block';
    if (gatedCount > 0) return 'ask_approval_or_sandbox';
    if (draftCount > 0) return 'draft_or_simulate';
    if (safeCount > 0 && highestRisk > 0) return 'read_or_inspect';
    return 'answer';
  }
}
