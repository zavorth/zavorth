import { SelfRepairingToolCallService } from "../../src/autonomy/SelfRepairingToolCallService";

describe("SelfRepairingToolCallService", () => {
  let service: SelfRepairingToolCallService;

  beforeEach(() => {
    service = new SelfRepairingToolCallService();
  });

  it("should return valid object arguments unchanged", async () => {
    const res = await service.repairAndValidateToolCall({
      toolName: "test_tool",
      rawArguments: { param: "value" }
    });

    expect(res.wasRepaired).toBe(false);
    expect(res.parsedArguments).toEqual({ param: "value" });
  });

  it("should parse valid JSON strings without repair", async () => {
    const res = await service.repairAndValidateToolCall({
      toolName: "test_tool",
      rawArguments: '{"query": "search term"}'
    });

    expect(res.wasRepaired).toBe(false);
    expect(res.parsedArguments).toEqual({ query: "search term" });
  });

  it("should extract and repair JSON substrings embedded within markdown text", async () => {
    const res = await service.repairAndValidateToolCall({
      toolName: "test_tool",
      rawArguments: 'Here is the JSON call: ```json\n{"action": "deploy"}\n``` Hope this works!'
    });

    expect(res.wasRepaired).toBe(true);
    expect(res.parsedArguments).toEqual({ action: "deploy" });
  });
});
