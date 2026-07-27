import { GovernedToolExposureServer, ToolImplementation } from "../../src/mcp/GovernedToolExposureServer";
import { DynamicScopePolicyEngine } from "../../src/mcp/DynamicScopePolicyEngine";
import { ToolExposureAuditService } from "../../src/mcp/ToolExposureAuditService";

describe("GovernedToolExposureServer", () => {
  let policyEngine: DynamicScopePolicyEngine;
  let auditService: ToolExposureAuditService;
  let server: GovernedToolExposureServer;

  beforeEach(() => {
    policyEngine = new DynamicScopePolicyEngine();
    auditService = new ToolExposureAuditService();
    server = new GovernedToolExposureServer(policyEngine, auditService);
  });

  it("should allow read-only tool calls without requiring user approval", async () => {
    const memoryReadTool: ToolImplementation = {
      name: "zavorth.memory.read",
      description: "Read memory item",
      execute: jest.fn().mockResolvedValue({ data: "secret_context" })
    };
    server.registerTool(memoryReadTool);

    const res = await server.handleToolCall("worker_x", "zavorth.memory.read", { key: "item_1" });

    expect(res.success).toBe(true);
    expect(res.result).toEqual({ data: "secret_context" });
    expect(auditService.getWorkerAuditLogs("worker_x")).toHaveLength(1);
    expect(auditService.getWorkerAuditLogs("worker_x")[0].outputStatus).toBe("success");
  });

  it("should deny sensitive tools when approval handler disallows or is unattached", async () => {
    const channelSendTool: ToolImplementation = {
      name: "zavorth.channel.send",
      description: "Send channel message",
      execute: jest.fn().mockResolvedValue({ messageId: "123" })
    };
    server.registerTool(channelSendTool);

    const res = await server.handleToolCall("worker_y", "zavorth.channel.send", { text: "Hello" });

    expect(res.success).toBe(false);
    expect(res.error).toContain("disapproved");
    expect(channelSendTool.execute).not.toHaveBeenCalled();
  });
});
