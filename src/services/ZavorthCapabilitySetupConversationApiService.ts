import type {
  CapabilitySetupConversationInput,
  CapabilitySetupConversationSnapshot,
} from '../contracts/CapabilitySetupConversationContract.js';
import {
  ZavorthCapabilitySetupConversationService,
  type ZavorthCapabilitySetupConversationRuntime,
} from './ZavorthCapabilitySetupConversationService.js';

export class ZavorthCapabilitySetupConversationApiService {
  private readonly service: ZavorthCapabilitySetupConversationService;

  constructor(runtime: ZavorthCapabilitySetupConversationRuntime = {}) {
    this.service = new ZavorthCapabilitySetupConversationService(runtime);
  }

  public buildSnapshot(input: CapabilitySetupConversationInput = {}): CapabilitySetupConversationSnapshot {
    return this.service.buildSnapshot(input);
  }

  public renderReply(input: CapabilitySetupConversationInput = {}): string {
    return this.service.renderReply(input);
  }
}
