import type {
  CapabilityActivationFlowInput,
  CapabilityActivationFlowSnapshot,
} from '../contracts/CapabilityActivationFlowContract.js';
import {
  ZavorthCapabilityActivationFlowService,
  type ZavorthCapabilityActivationFlowRuntime,
} from './ZavorthCapabilityActivationFlowService.js';

export class ZavorthCapabilityActivationFlowApiService {
  private readonly service: ZavorthCapabilityActivationFlowService;

  constructor(runtime: ZavorthCapabilityActivationFlowRuntime = {}) {
    this.service = new ZavorthCapabilityActivationFlowService(runtime);
  }

  public buildSnapshot(input: CapabilityActivationFlowInput = {}): CapabilityActivationFlowSnapshot {
    return this.service.buildSnapshot(input);
  }

  public renderReport(input: CapabilityActivationFlowInput = {}): string {
    return this.service.renderReport(input);
  }
}
