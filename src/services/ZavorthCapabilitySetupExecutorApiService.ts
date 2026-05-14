import type {
  CapabilitySetupExecutorInput,
  CapabilitySetupExecutorResult,
  CapabilitySetupExecutorSnapshot,
} from '../contracts/CapabilitySetupExecutorContract.js';
import {
  ZavorthCapabilitySetupExecutorService,
  type ZavorthCapabilitySetupExecutorRuntime,
} from './ZavorthCapabilitySetupExecutorService.js';

export class ZavorthCapabilitySetupExecutorApiService {
  private readonly service: ZavorthCapabilitySetupExecutorService;

  constructor(runtime: ZavorthCapabilitySetupExecutorRuntime = {}) {
    this.service = new ZavorthCapabilitySetupExecutorService(runtime);
  }

  public execute(input: CapabilitySetupExecutorInput): CapabilitySetupExecutorResult {
    return this.service.execute(input);
  }

  public listRequests(limit?: number): CapabilitySetupExecutorSnapshot {
    return this.service.listRequests(limit);
  }

  public renderReport(limit?: number): string {
    return this.service.renderReport(limit);
  }
}

