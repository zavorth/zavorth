import { DynamicVoiceInteractionService } from "../../src/voice/DynamicVoiceInteractionService";

describe("DynamicVoiceInteractionService", () => {
  let service: DynamicVoiceInteractionService;

  beforeEach(() => {
    service = new DynamicVoiceInteractionService(undefined, { cooldownWindowMs: 200 });
  });

  afterEach(() => {
    service.resetState();
  });

  it("should enter cooldown mode after system speech finishes and allow hands-free listening", () => {
    expect(service.shouldProcessAudioInputWithoutWakeWord()).toBe(false);

    service.handleSystemSpeechFinished();

    expect(service.getCurrentState()).toBe("cooldown");
    expect(service.shouldProcessAudioInputWithoutWakeWord()).toBe(true);
  });

  it("should classify semantic voice approvals and denials without regex dependence", async () => {
    const approvalRes = await service.classifyVoiceApprovalIntent("please execute it");
    expect(approvalRes.approved).toBe(true);

    const denialRes = await service.classifyVoiceApprovalIntent("I do not authorize this action");
    expect(denialRes.approved).toBe(false);
  });
});
