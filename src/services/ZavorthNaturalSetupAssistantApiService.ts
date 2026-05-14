import type {
  NaturalSetupAssistantInput,
  NaturalSetupAssistantSnapshot,
} from '../contracts/NaturalSetupAssistantContract.js';
import {
  ZavorthNaturalSetupAssistantService,
  type ZavorthNaturalSetupAssistantRuntime,
} from './ZavorthNaturalSetupAssistantService.js';

export class ZavorthNaturalSetupAssistantApiService {
  private readonly service: ZavorthNaturalSetupAssistantService;

  constructor(runtime: ZavorthNaturalSetupAssistantRuntime = {}) {
    this.service = new ZavorthNaturalSetupAssistantService(runtime);
  }

  public buildSnapshot(input: NaturalSetupAssistantInput): NaturalSetupAssistantSnapshot {
    return this.service.buildSnapshot(input);
  }

  public renderReply(input: NaturalSetupAssistantInput): string {
    return this.service.renderReply(input);
  }
}
