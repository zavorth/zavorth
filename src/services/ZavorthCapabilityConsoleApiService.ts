import type {
  CapabilityConsoleInput,
  CapabilityConsoleSnapshot,
} from '../contracts/CapabilityConsoleContract.js';
import {
  ZavorthCapabilityConsoleService,
  type ZavorthCapabilityConsoleRuntime,
} from './ZavorthCapabilityConsoleService.js';

export class ZavorthCapabilityConsoleApiService {
  private readonly service: ZavorthCapabilityConsoleService;

  constructor(runtime: ZavorthCapabilityConsoleRuntime = {}) {
    this.service = new ZavorthCapabilityConsoleService(runtime);
  }

  public buildSnapshot(input: CapabilityConsoleInput = {}): CapabilityConsoleSnapshot {
    return this.service.buildSnapshot(input);
  }

  public renderConsole(input: CapabilityConsoleInput = {}): string {
    return this.service.renderConsole(input);
  }
}

