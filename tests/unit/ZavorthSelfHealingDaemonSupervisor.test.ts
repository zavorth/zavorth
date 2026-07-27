import { ZavorthSelfHealingDaemonSupervisor, ManagedTaskWorker } from "../../src/services/ZavorthSelfHealingDaemonSupervisor";

describe("ZavorthSelfHealingDaemonSupervisor", () => {
  let supervisor: ZavorthSelfHealingDaemonSupervisor;

  beforeEach(() => {
    supervisor = new ZavorthSelfHealingDaemonSupervisor();
  });

  afterEach(() => {
    supervisor.stopSupervision();
  });

  it("should monitor workers and trigger restart on failure", async () => {
    const mockWorker: ManagedTaskWorker = {
      id: "worker_101",
      name: "GatewayWorker",
      isAlive: jest.fn().mockResolvedValueOnce(false),
      restart: jest.fn().mockResolvedValue(undefined)
    };

    supervisor.registerWorker(mockWorker);
    const reports = await supervisor.performHealthCheckSweep();

    expect(reports).toHaveLength(1);
    expect(reports[0].status).toBe("restarted");
    expect(mockWorker.restart).toHaveBeenCalled();
  });
});
