import { UniversalStreamingAdapter } from "../src/adapters/overlord/UniversalStreamingAdapter";
import { ChannelStreamRelay } from "../src/gateways/channels/ChannelStreamRelay";
import { StreamChannelAdapter, TokenChunk } from "../src/contracts/StreamingContract";
import { ParallelSubtaskOrchestrator, UniversalWorkerRunner } from "../src/orchestrator/ParallelSubtaskOrchestrator";
import { DynamicTaskDecomposer, DecompositionResult } from "../src/orchestrator/DynamicTaskDecomposer";
import { ResultSynthesizerService } from "../src/orchestrator/ResultSynthesizerService";
import { GovernedToolExposureServer, ToolImplementation } from "../src/mcp/GovernedToolExposureServer";
import { DynamicScopePolicyEngine } from "../src/mcp/DynamicScopePolicyEngine";
import { ToolExposureAuditService } from "../src/mcp/ToolExposureAuditService";
import { DynamicVoiceInteractionService } from "../src/voice/DynamicVoiceInteractionService";
import { AdaptiveMultiModalMediaEngine } from "../src/gateways/media/AdaptiveMultiModalMediaEngine";
import { SelfRepairingToolCallService } from "../src/autonomy/SelfRepairingToolCallService";
import { MnemosGraphCurator, MemoryNode } from "../src/storage/MnemosGraphCurator";
import { ZavorthSelfHealingDaemonSupervisor, ManagedTaskWorker } from "../src/services/ZavorthSelfHealingDaemonSupervisor";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAllTests() {
  console.log("=== Running Zavorth Dynamic Native Architecture Suite ===");

  // Test 1: UniversalStreamingAdapter
  console.log("[Test 1/8] UniversalStreamingAdapter...");
  const streamingAdapter = new UniversalStreamingAdapter();
  const received: TokenChunk[] = [];
  const unsub = streamingAdapter.subscribe("w1", (chunk) => { received.push(chunk); });
  await streamingAdapter.emitTokenDelta("w1", "Hello ");
  await streamingAdapter.emitTokenDelta("w1", "World", true);
  assert(received.length === 2, "Received chunks count mismatch");
  assert(received[0].sequenceId === 1, "Sequence 1 failed");
  assert(received[1].isFinal === true, "IsFinal flag failed");
  unsub();
  console.log("  ✓ UniversalStreamingAdapter passed.");

  // Test 2: ChannelStreamRelay
  console.log("[Test 2/8] ChannelStreamRelay...");
  let sentText = "";
  const mockChannel: StreamChannelAdapter = {
    async sendStreamChunk(chanId, msgId, text) {
      sentText = text;
      return msgId || "msg_1";
    }
  };
  const relay = new ChannelStreamRelay(mockChannel, { minChunkIntervalMs: 10 });
  await relay.processTokenChunk("c1", "w1", { workerId: "w1", sequenceId: 1, content: "Streamed ", isFinal: false, timestamp: Date.now() });
  await relay.processTokenChunk("c1", "w1", { workerId: "w1", sequenceId: 2, content: "Output", isFinal: true, timestamp: Date.now() });
  assert(sentText === "Streamed Output", "Relay text mismatch");
  assert(relay.getActiveStreamCount() === 0, "Active streams not cleared");
  console.log("  ✓ ChannelStreamRelay passed.");

  // Test 3: ParallelSubtaskOrchestrator & Decomposer & Synthesizer
  console.log("[Test 3/8] ParallelSubtaskOrchestrator & Synthesizer...");
  const mockRunner: UniversalWorkerRunner = {
    async executeWorkerTask(subtask) {
      return { output: `Result of ${subtask.id}`, status: "success" };
    }
  };
  const decomposer = new DynamicTaskDecomposer();
  const decomp = await decomposer.decomposeTask("task_100", "Analyze repository");
  assert(decomp.subtasks.length > 0, "Decomposition subtasks empty");

  const orchestrator = new ParallelSubtaskOrchestrator(mockRunner);
  const receipts = await orchestrator.executeDecomposedTasks(decomp);
  assert(receipts.length > 0, "Receipts empty");
  assert(receipts[0].status === "success", "Receipt status failed");

  const synthesizer = new ResultSynthesizerService();
  const syn = await synthesizer.synthesizeResults("Analyze repository", receipts);
  assert(syn.successCount === receipts.length, "Synthesizer success count mismatch");
  console.log("  ✓ ParallelSubtaskOrchestrator passed.");

  // Test 4: GovernedToolExposureServer & Policy Engine
  console.log("[Test 4/8] GovernedToolExposureServer & Policy Engine...");
  const policyEngine = new DynamicScopePolicyEngine();
  const auditService = new ToolExposureAuditService();
  const server = new GovernedToolExposureServer(policyEngine, auditService);
  const readTool: ToolImplementation = {
    name: "zavorth.memory.read",
    description: "Read memory",
    execute: async () => ({ key: "val" })
  };
  server.registerTool(readTool);
  const toolRes = await server.handleToolCall("worker_test", "zavorth.memory.read", {});
  assert(toolRes.success === true, "Governed tool call failed");
  assert(auditService.getWorkerAuditLogs("worker_test").length === 1, "Audit log failed");
  console.log("  ✓ GovernedToolExposureServer passed.");

  // Test 5: DynamicVoiceInteractionService
  console.log("[Test 5/8] DynamicVoiceInteractionService...");
  const voiceService = new DynamicVoiceInteractionService(undefined, { cooldownWindowMs: 100 });
  voiceService.handleSystemSpeechFinished();
  assert(voiceService.shouldProcessAudioInputWithoutWakeWord() === true, "Talk mode cooldown state failed");
  const approval = await voiceService.classifyVoiceApprovalIntent("please execute the task");
  assert(approval.approved === true, "Voice approval intent failed");
  voiceService.resetState();
  console.log("  ✓ DynamicVoiceInteractionService passed.");

  // Test 6: AdaptiveMultiModalMediaEngine
  console.log("[Test 6/8] AdaptiveMultiModalMediaEngine...");
  const mediaEngine = new AdaptiveMultiModalMediaEngine();
  const mediaRes = await mediaEngine.adaptIncomingMediaPayload({ mediaType: "audio", channelType: "telegram" }, "Status report");
  assert(mediaRes.shouldGenerateAudio === true, "Media adaptation failed");
  console.log("  ✓ AdaptiveMultiModalMediaEngine passed.");

  // Test 7: SelfRepairingToolCallService & MnemosGraphCurator
  console.log("[Test 7/8] SelfRepairingToolCallService & MnemosGraphCurator...");
  const repairService = new SelfRepairingToolCallService();
  const repaired = await repairService.repairAndValidateToolCall({ toolName: "deploy", rawArguments: 'Prefix text ```json\n{"env": "prod"}\n``` Suffix' });
  assert(repaired.wasRepaired === true, "Tool repair flag failed");
  assert((repaired.parsedArguments as any).env === "prod", "Tool repaired arguments failed");

  const curator = new MnemosGraphCurator();
  const curated = await curator.consolidateMemoryNodes([{ id: "n1", category: "episodic", content: "Action 1", tags: [], timestamp: Date.now() }]);
  assert(curated.nodesConsolidated === 1, "Curator node count mismatch");
  console.log("  ✓ SelfRepairingToolCallService & MnemosGraphCurator passed.");

  // Test 8: ZavorthSelfHealingDaemonSupervisor
  console.log("[Test 8/8] ZavorthSelfHealingDaemonSupervisor...");
  const supervisor = new ZavorthSelfHealingDaemonSupervisor();
  let restarted = false;
  const worker: ManagedTaskWorker = {
    id: "w_super",
    name: "ChannelDaemon",
    async isAlive() { return false; },
    async restart() { restarted = true; }
  };
  supervisor.registerWorker(worker);
  const reports = await supervisor.performHealthCheckSweep();
  assert(reports.length === 1, "Daemon report count mismatch");
  assert(restarted === true, "Daemon restart failed");
  console.log("  ✓ ZavorthSelfHealingDaemonSupervisor passed.");

  console.log("=== ALL 8 DYNAMIC NATIVE ARCHITECTURE TESTS PASSED CLEANLY ===");
}

runAllTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
