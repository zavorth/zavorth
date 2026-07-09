import type {
  CapabilityImportInput,
  ZavorthCapabilityImportRuntime,
} from './ZavorthCapabilityImportService.js';
import {
  ZavorthCapabilityImportService,
} from './ZavorthCapabilityImportService.js';

import type {
  CapabilityImportSnapshot,
} from '../contracts/CapabilityImportContract.js';
import type { CapabilityHubItem } from '../contracts/CapabilityHubContract.js';

export class ZavorthCapabilityImportApiService {
  private readonly service: ZavorthCapabilityImportService;

  constructor(runtime: ZavorthCapabilityImportRuntime = {}) {
    this.service = new ZavorthCapabilityImportService(runtime);
  }

  public buildSnapshot(input: CapabilityImportInput = {}): CapabilityImportSnapshot {
    return this.service.buildSnapshot(input);
  }

  public listCapabilityHubItems(input: CapabilityImportInput = {}): CapabilityHubItem[] {
    return this.service.listCapabilityHubItems(input);
  }

  public renderReport(input: CapabilityImportInput = {}): string {
    return this.service.renderReport(input);
  }
}
