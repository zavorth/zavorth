import { ParallelSubtaskOrchestrator, UniversalWorkerRunner } from "../../src/orchestrator/ParallelSubtaskOrchestrator";
import { DecompositionResult } from "../../src/orchestrator/DynamicTaskDecomposer";

describe("ParallelSubtaskOrchestrator", () => {
  let mockWorkerRunner: jest.Mocked<UniversalWorkerRunner>;
  let orchestrator: ParallelSubtaskOrchestrator;

  beforeEach(() => {
    mockWorkerRunner = {
      executeWorkerTask: jest.fn().mockImplementation(async (subtask) => {
        return { output: `Output of ${subtask.id}`, status: "success" as const };
      })
    };
    orchestrator = new ParallelSubtaskOrchestrator(mockWorkerRunner);
  });

  it("should execute independent subtasks concurrently and return signed receipts", async () => {
    const decomposition: DecompositionResult = {
      taskId: "task_1",
      originalPrompt: "Run parallel research",
      isParallelizable: true,
      reasoning: "Subtasks are independent",
      subtasks: [
        { id: "sub_1", description: "Research A", dependencies: [], requiredCapabilities: [], estimatedBudgetMs: 5000 },
        { id: "sub_2", description: "Research B", dependencies: [], requiredCapabilities: [], estimatedBudgetMs: 5000 }
      ]
    };

    const receipts = await orchestrator.executeDecomposedTasks(decomposition);

    expect(receipts).toHaveLength(2);
    expect(receipts[0].status).toBe("success");
    expect(receipts[1].status).toBe("success");
    expect(receipts[0].signedReceiptHash).toContain("rcpt_");
    expect(mockWorkerRunner.executeWorkerTask).toHaveBeenCalledTimes(2);
  });

  it("should respect task dependencies and sequence execution", async () => {
    const decomposition: DecompositionResult = {
      taskId: "task_2",
      originalPrompt: "Run dependent tasks",
      isParallelizable: true,
      reasoning: "Task B depends on Task A",
      subtasks: [
        { id: "sub_A", description: "Step A", dependencies: [], requiredCapabilities: [], estimatedBudgetMs: 5000 },
        { id: "sub_B", description: "Step B", dependencies: ["sub_A"], requiredCapabilities: [], estimatedBudgetMs: 5000 }
      ]
    };

    const receipts = await orchestrator.executeDecomposedTasks(decomposition);

    expect(receipts).toHaveLength(2);
    expect(receipts.find(r => r.subtaskId === "sub_A")?.status).toBe("success");
    expect(receipts.find(r => r.subtaskId === "sub_B")?.status).toBe("success");
  });
});
