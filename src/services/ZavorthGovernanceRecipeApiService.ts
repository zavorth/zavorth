import type {
  GovernanceRecipeExecutionReceipt,
  GovernanceRecipePlan,
  GovernanceRecipeSnapshot,
} from '../contracts/GovernanceRecipeContract.js';
import {
  ZavorthGovernanceRecipeService,
  type GovernanceRecipePlanInput,
  type ZavorthGovernanceRecipeRuntime,
} from './ZavorthGovernanceRecipeService.js';

export class ZavorthGovernanceRecipeApiService {
  private readonly service: ZavorthGovernanceRecipeService;

  constructor(runtime: ZavorthGovernanceRecipeRuntime = {}) {
    this.service = new ZavorthGovernanceRecipeService(runtime);
  }

  public buildSnapshot(input: GovernanceRecipePlanInput = {}): GovernanceRecipeSnapshot {
    return this.service.buildSnapshot(input);
  }

  public plan(input: GovernanceRecipePlanInput = {}): GovernanceRecipePlan | null {
    return this.service.buildPlan(input);
  }

  public dryRun(input: GovernanceRecipePlanInput = {}): GovernanceRecipeExecutionReceipt | null {
    return this.service.executeDryRun(input);
  }

  public renderReport(input: GovernanceRecipePlanInput = {}): string {
    return this.service.renderReport(input);
  }
}
