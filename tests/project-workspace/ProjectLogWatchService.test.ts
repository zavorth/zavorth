import * as path from 'path';
import {
  ProjectLogWatchService,
  type ProjectManifestHook,
  type ProjectManifestMode,
  type ProjectManifestProcess,
  type ProjectProcessLogEntry,
  type ResolvedProjectManifest,
} from '../../src/project-workspace/index.js';
import type { UniversalAgentRunResult } from '../../src/runtime/agent/UniversalAgentRuntimeTypes.js';


function processFixture(): ProjectManifestProcess {
  return {
    id: 'app',
    name: 'App',
    command: 'npm test',
    cwd: '.',
    restart: 'never',
    health: { type: 'none' },
  };
}

function createResolved(input: {
  mode?: ProjectManifestMode;
  policyScopes?: string[];
  pattern?: string;
} = {}): ResolvedProjectManifest {
  const root = path.join(__dirname, '.tmp', 'project-log-watch-test');
  const manifestProcess = processFixture();
  const hook: ProjectManifestHook = {
    id: 'app-error',
    when: {
      process: manifestProcess.id,
      pattern: input.pattern || '(FAIL|Error|EADDRINUSE)',
    },
    action: {
      type: 'agent-run',
      mode: input.mode || 'suggest',
      prompt: 'Diagnose the app failure.',
    },
  };
  return {
    manifestPath: path.join(root, 'zavorth.yml'),
    manifestDir: root,
    projectRoot: root,
    manifest: {
      version: 1,
      project: {
        name: 'log-watch-demo',
        root: '.',
        description: 'Log watch demo.',
      },
      processes: [manifestProcess],
      mcp: {
        servers: [],
      },
      agents: [],
      hooks: [hook],
      policy: {
        defaultMode: input.mode || 'suggest',
        requireApprovalFor: input.policyScopes || ['filesystem.write', 'process.kill', 'network.public', 'selfmod.apply'],
      },
    },
    processResolutions: [{
      id: manifestProcess.id,
      cwd: manifestProcess.cwd,
      resolvedCwd: root,
      outsideProject: false,
    }],
    sideEffects: 'none',
  };
}

function logFixture(text: string, id = 'log-1'): ProjectProcessLogEntry {
  return {
    id,
    sequence: Number(id.replace(/\D+/g, '') || 1),
    processId: 'app',
    stream: 'stderr',
    text,
    timestamp: '2026-05-03T12:00:00.000Z',
  };
}

function idFactory(): (prefix: string) => string {
  let count = 0;
  return (prefix: string) => `${prefix}-${++count}`;
}

function agentResult(runId = 'run-1'): UniversalAgentRunResult {
  return {
    ok: true,
    run: {
      id: runId,
      status: 'completed',
    },
    replies: [],
  } as unknown as UniversalAgentRunResult;
}

describe('ProjectLogWatchService', () => {
  it('detects a simulated log error through manifest hooks', async () => {
    const service = new ProjectLogWatchService({ idFactory: idFactory() });
    const [result] = await service.inspectLog({
      resolved: createResolved(),
      log: logFixture('FAIL tests/app.test.ts AssertionError: expected true'),
    });

    expect(result).toEqual(expect.objectContaining({
      matched: true,
      status: 'agent_run_unavailable',
    }));
    expect(result.event?.classification).toEqual(expect.objectContaining({
      category: 'test_failure',
      risk: 'medium',
    }));
    expect(result.event?.policyDecision.action).toBe('create-agent-run');
  });

  it('deduplicates repeated hook events in the dedupe window', async () => {
    const service = new ProjectLogWatchService({ idFactory: idFactory() });
    const resolved = createResolved();
    const log = logFixture('Error: same failure');

    const [first] = await service.inspectLog({ resolved, log });
    const [second] = await service.inspectLog({ resolved, log });
    const events = service.listEvents({ manifestPath: resolved.manifestPath });

    expect(first.status).toBe('agent_run_unavailable');
    expect(second.status).toBe('deduped');
    expect(events).toHaveLength(1);
    expect(events[0].audit.duplicateCount).toBe(2);
  });

  it('creates an agent run in suggest mode through the canonical gateway', async () => {
    const gateway = {
      handle: jest.fn(async () => agentResult('run-suggest-1')),
    };
    const service = new ProjectLogWatchService({
      idFactory: idFactory(),
      agentGateway: gateway,
    });

    const [result] = await service.inspectLog({
      resolved: createResolved({ mode: 'suggest' }),
      log: logFixture('Error: dev server failed'),
    });

    expect(result.status).toBe('agent_run_created');
    expect(result.event?.agentRunId).toBe('run-suggest-1');
    expect(gateway.handle).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'api',
      userId: 'project-log-watch',
      metadata: expect.objectContaining({
        source: 'project-log-watch',
        hookId: 'app-error',
      }),
    }));
  });

  it('blocks apply mode when policy requires approval for sensitive scopes', async () => {
    const gateway = {
      handle: jest.fn(async () => agentResult('run-apply-1')),
    };
    const service = new ProjectLogWatchService({
      idFactory: idFactory(),
      agentGateway: gateway,
    });

    const [result] = await service.inspectLog({
      resolved: createResolved({
        mode: 'apply',
        policyScopes: ['filesystem.write'],
      }),
      log: logFixture('EADDRINUSE: port 3000 is already in use'),
    });

    expect(result.status).toBe('blocked');
    expect(result.event?.policyDecision).toEqual(expect.objectContaining({
      allowed: false,
      requiresApproval: true,
      action: 'blocked',
      blockedScopes: expect.arrayContaining(['filesystem.write']),
    }));
    expect(gateway.handle).not.toHaveBeenCalled();
  });

  it('records an auditable event with a redacted log snippet', async () => {
    const service = new ProjectLogWatchService({ idFactory: idFactory() });
    const resolved = createResolved({ mode: 'observe', pattern: 'TOKEN|Error' });

    const [result] = await service.inspectLog({
      resolved,
      log: logFixture('API_TOKEN=super-secret Error: auth failed'),
    });

    expect(result.status).toBe('recorded');
    expect(result.event?.audit).toEqual(expect.objectContaining({
      id: expect.stringContaining('project-log-watch-audit'),
      hookId: 'app-error',
      processId: 'app',
      mode: 'observe',
      duplicateCount: 1,
      rateLimited: false,
      tags: expect.arrayContaining(['project-log-watch', 'mode:observe']),
    }));
    expect(result.event?.log.textSnippet).toContain('API_TOKEN=[REDACTED]');
    expect(result.event?.log.textSnippet).not.toContain('super-secret');
  });
});
