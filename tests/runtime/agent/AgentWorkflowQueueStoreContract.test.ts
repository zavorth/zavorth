import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  JsonAgentWorkflowQueueStore,
  MemoryAgentWorkflowQueueStore,
  type AgentWorkflowQueueStore,
  type UniversalAgentWorkflowJob,
} from '../../../src/runtime/agent/index.js';

function createJob(id: string): UniversalAgentWorkflowJob {
  return {
    id,
    kind: 'resume_after_approval',
    runId: `run-${id}`,
    approvalId: `approval-${id}`,
    request: {
      userId: 'grey',
      channel: 'web',
      sessionId: `session-${id}`,
      text: `execute ${id}`,
      requestedTools: ['write_file'],
    },
    status: 'queued',
    createdAt: '2026-04-26T15:00:00.000Z',
    updatedAt: '2026-04-26T15:00:00.000Z',
    attempts: 0,
    maxAttempts: 3,
    leaseOwner: null,
    leaseExpiresAt: null,
    lockedAt: null,
    heartbeatAt: null,
    nextRunAt: '2026-04-26T15:00:00.000Z',
    backoffMs: 1000,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    lastError: null,
    resultRunStatus: 'queued',
    metadata: {},
  };
}

function runQueueStoreContract(
  name: string,
  createStore: () => { store: AgentWorkflowQueueStore; cleanup: () => void },
): void {
  describe(name, () => {
    it('exposes stable v1 metadata and required operational methods', () => {
      const { store, cleanup } = createStore();

      expect(store.describe()).toEqual(expect.objectContaining({
        version: 'agent-workflow-queue-store/v1',
        capabilities: expect.objectContaining({
          atomicClaim: true,
          lease: true,
          heartbeat: true,
          backoff: true,
          retry: true,
        }),
      }));
      expect(typeof store.listJobs).toBe('function');
      expect(typeof store.upsertJob).toBe('function');
      expect(typeof store.claimQueuedJobs).toBe('function');
      expect(typeof store.heartbeatJob).toBe('function');
      expect(typeof store.releaseExpiredLeases).toBe('function');

      cleanup();
    });

    it('claims, heartbeats and recovers jobs through the same adapter contract', () => {
      const { store, cleanup } = createStore();
      store.upsertJob(createJob('contract-1'));

      const claimed = store.claimQueuedJobs({
        workerId: 'worker-a',
        now: '2026-04-26T15:00:01.000Z',
        leaseMs: 1000,
        limit: 1,
      });

      expect(claimed).toEqual([
        expect.objectContaining({
          id: 'contract-1',
          status: 'running',
          attempts: 1,
          leaseOwner: 'worker-a',
        }),
      ]);
      expect(store.claimQueuedJobs({
        workerId: 'worker-b',
        now: '2026-04-26T15:00:01.500Z',
        leaseMs: 1000,
        limit: 1,
      })).toHaveLength(0);

      const heartbeat = store.heartbeatJob({
        jobId: 'contract-1',
        workerId: 'worker-a',
        now: '2026-04-26T15:00:01.800Z',
        leaseMs: 1000,
      });

      expect(heartbeat).toEqual(expect.objectContaining({
        heartbeatAt: '2026-04-26T15:00:01.800Z',
        leaseOwner: 'worker-a',
      }));
      expect(store.releaseExpiredLeases({
        now: '2026-04-26T15:00:03.000Z',
      })).toEqual([
        expect.objectContaining({
          id: 'contract-1',
          status: 'queued',
          leaseOwner: null,
        }),
      ]);

      cleanup();
    });
  });
}

runQueueStoreContract('MemoryAgentWorkflowQueueStore contract', () => ({
  store: new MemoryAgentWorkflowQueueStore(),
  cleanup: () => undefined,
}));

runQueueStoreContract('JsonAgentWorkflowQueueStore contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-store-contract-'));
  return {
    store: new JsonAgentWorkflowQueueStore({
      filePath: path.join(dir, 'queue.json'),
    }),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
});
