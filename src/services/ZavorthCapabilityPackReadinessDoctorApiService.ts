import type {
  CapabilityPackReadinessInput,
  CapabilityPackReadinessSnapshot,
} from '../contracts/CapabilityPackReadinessContract.js';
import {
  ZavorthCapabilityPackReadinessDoctorService,
  type ZavorthCapabilityPackReadinessDoctorRuntime,
} from './ZavorthCapabilityPackReadinessDoctorService.js';

export class ZavorthCapabilityPackReadinessDoctorApiService {
  private readonly service: ZavorthCapabilityPackReadinessDoctorService;

  constructor(runtime: ZavorthCapabilityPackReadinessDoctorRuntime = {}) {
    this.service = new ZavorthCapabilityPackReadinessDoctorService(runtime);
  }

  public buildSnapshot(input: CapabilityPackReadinessInput = {}): CapabilityPackReadinessSnapshot {
    return this.service.buildSnapshot(input);
  }

  public renderReport(input: CapabilityPackReadinessInput = {}): string {
    return this.service.renderReport(input);
  }
}
