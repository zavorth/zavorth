import type { CapabilityHubCompletionSnapshot } from '../contracts/CapabilityHubCompletionContract.js';
import {
  ZavorthCapabilityHubCompletionService,
  type ZavorthCapabilityHubCompletionRuntime,
} from './ZavorthCapabilityHubCompletionService.js';

export class ZavorthCapabilityHubCompletionApiService {
  private readonly service: ZavorthCapabilityHubCompletionService;

  constructor(runtime: ZavorthCapabilityHubCompletionRuntime = {}) {
    this.service = new ZavorthCapabilityHubCompletionService(runtime);
  }

  public buildSnapshot(): CapabilityHubCompletionSnapshot {
    return this.service.buildSnapshot();
  }

  public renderReport(): string {
    return this.service.renderReport();
  }
}

