import type {
  CapabilityNaturalOperatorInput,
  CapabilityNaturalOperatorResult,
} from '../contracts/CapabilityNaturalOperatorContract.js';
import {
  ZavorthCapabilityNaturalOperatorService,
  type ZavorthCapabilityNaturalOperatorRuntime,
} from './ZavorthCapabilityNaturalOperatorService.js';

export class ZavorthCapabilityNaturalOperatorApiService {
  private readonly service: ZavorthCapabilityNaturalOperatorService;

  constructor(runtime: ZavorthCapabilityNaturalOperatorRuntime = {}) {
    this.service = new ZavorthCapabilityNaturalOperatorService(runtime);
  }

  public execute(input: CapabilityNaturalOperatorInput): CapabilityNaturalOperatorResult {
    return this.service.execute(input);
  }

  public renderReply(input: CapabilityNaturalOperatorInput): string {
    return this.service.renderReply(input);
  }
}

