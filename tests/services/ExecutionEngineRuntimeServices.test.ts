import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { CanvasEgressGuardService } from '../../src/services/CanvasEgressGuardService.js';
import { CanvasPreviewServer } from '../../src/services/CanvasPreviewServer.js';
import { CanvasSessionService } from '../../src/services/CanvasSessionService.js';
import { ExecutionEngineRegistryService } from '../../src/services/ExecutionEngineRegistryService.js';
import { ExecutionEngineRouterService } from '../../src/services/ExecutionEngineRouterService.js';
import { GlassBoxTraceService } from '../../src/services/GlassBoxTraceService.js';
import { InteractiveDiffReviewService } from '../../src/services/InteractiveDiffReviewService.js';
import { TrustedWorkspacePolicyService } from '../../src/services/TrustedWorkspacePolicyService.js';

function makeRuntime() {
  const registry = new ExecutionEngineRegistryService();
  const trusted = new TrustedWorkspacePolicyService();
  const trace = new GlassBoxTraceService();
  return {
    registry,
    trusted,
    trace,
    router: new ExecutionEngineRouterService(registry, trusted, trace),
    diff: new InteractiveDiffReviewService(trusted, trace),
  };
}

describe('Execution runtime engines', () => {
  it('registers lite, velocity and shield with admin lock support', () => {
    const registry = new ExecutionEngineRegistryService({
      shieldOnly: true,
      lockReason: 'enterprise lock',
    });

    expect(registry.listPolicies().map((engine) => engine.id)).toEqual(['lite', 'velocity', 'shield']);
    expect(registry.select('velocity')).toEqual(expect.objectContaining({
      ok: false,
      activeEngineId: 'shield',
      availability: expect.objectContaining({
        reason: 'enterprise lock',
      }),
    }));
  });

  it('routes simple questions through Express without Swarm-shaped side effects', () => {
    const runtime = makeRuntime();

    const decision = runtime.router.decide({
      prompt: 'Explain what this file does',
      operation: 'code-question',
    });

    expect(decision.engineId).toBe('lite');
    expect(decision.mode).toBe('express');
    expect(decision.express).toBe(true);
    expect(decision.events[0]).toEqual(expect.objectContaining({
      kind: 'express-route',
    }));
  });

  it('routes simple edits inside a trusted workspace to Velocity', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engine-trusted-'));
    const targetPath = path.join(root, 'src', 'note.ts');
    const runtime = makeRuntime();
    runtime.trusted.add({ path: root, label: 'trusted test' });

    const decision = runtime.router.decide({
      operation: 'write',
      targetPath,
      content: 'export const ok = true;',
    });

    expect(decision.engineId).toBe('velocity');
    expect(decision.mode).toBe('trusted-workspace');
    expect(decision.status).toBe('ready');
  });

  it('promotes secrets, destructive commands and paths outside trust to Shield', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engine-safe-'));
    const runtime = makeRuntime();
    runtime.trusted.add({ path: root, label: 'trusted test' });

    expect(runtime.router.decide({
      operation: 'write',
      targetPath: path.join(root, '.env'),
      content: 'TOKEN=secret',
    })).toEqual(expect.objectContaining({
      engineId: 'shield',
      status: 'needs-approval',
      risk: 'critical',
    }));

    expect(runtime.router.decide({
      operation: 'shell',
      command: 'rm -rf .',
    })).toEqual(expect.objectContaining({
      engineId: 'shield',
      status: 'needs-approval',
    }));

    expect(runtime.router.decide({
      operation: 'write',
      targetPath: path.join(root, '..', 'outside', 'file.ts'),
      content: 'x',
    })).toEqual(expect.objectContaining({
      engineId: 'shield',
      mode: 'sandbox',
    }));
  });
});

describe('Trusted workspaces, diff review and Z-Canvas', () => {
  it('blocks traversal outside the trusted folder for Velocity writes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-'));
    const service = new TrustedWorkspacePolicyService();
    service.add({ path: root });

    expect(service.assertVelocityWrite({
      targetPath: path.join(root, 'ok.ts'),
      content: 'ok',
    })).toEqual(expect.objectContaining({ allowed: true }));

    expect(service.assertVelocityWrite({
      targetPath: path.join(root, '..', 'escape.ts'),
      content: 'ok',
    })).toEqual(expect.objectContaining({ allowed: false }));
  });

  it('rejects broad or sensitive trusted workspace roots', () => {
    const service = new TrustedWorkspacePolicyService();

    expect(service.validatePolicyInput(path.parse(os.tmpdir()).root)).toEqual(expect.objectContaining({
      ok: false,
    }));
    expect(service.validatePolicyInput(os.homedir())).toEqual(expect.objectContaining({
      ok: false,
      reason: expect.stringContaining('home'),
    }));
    expect(() => service.add({ path: os.homedir() })).toThrow(/home|broad|root/i);
  });

  it('blocks external egress by default in canvas preview policy', () => {
    const guard = new CanvasEgressGuardService();

    expect(guard.evaluateRequest('/asset.css')).toEqual(expect.objectContaining({ allowed: true }));
    expect(guard.evaluateRequest('http://127.0.0.1:3000/asset.css')).toEqual(expect.objectContaining({ allowed: true }));
    expect(guard.evaluateRequest('https://example.com/track')).toEqual(expect.objectContaining({
      allowed: false,
      event: expect.objectContaining({
        url: 'https://example.com/track',
      }),
    }));
  });

  it('records interactive diff decisions without applying outside policy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diff-'));
    const runtime = makeRuntime();
    runtime.trusted.add({ path: root });

    expect(runtime.diff.review({
      action: 'accept-file',
      targetId: 'file-1',
      engineId: 'velocity',
      targetPath: path.join(root, 'feature.ts'),
    })).toEqual(expect.objectContaining({
      status: 'host-direct-ready',
      requiresApproval: false,
    }));

    expect(runtime.diff.review({
      action: 'reject-hunk',
      targetId: 'hunk-1',
      engineId: 'velocity',
      targetPath: path.join(root, 'feature.ts'),
    })).toEqual(expect.objectContaining({
      status: 'sandbox-recompose-required',
      requiresSandbox: true,
    }));

    expect(runtime.diff.review({
      action: 'accept-file',
      targetId: 'file-2',
      engineId: 'velocity',
      targetPath: path.join(root, '..', 'outside.ts'),
    })).toEqual(expect.objectContaining({
      status: 'approval-required',
      requiresApproval: true,
    }));
  });

  it('applies accepted Velocity diffs only inside trusted workspaces', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diff-apply-'));
    const targetPath = path.join(root, 'feature.ts');
    const runtime = makeRuntime();
    runtime.trusted.add({ path: root });
    fs.writeFileSync(targetPath, 'export const enabled = false;\n', 'utf8');
    const patch = createTwoFilesPatch(
      'feature.ts',
      'feature.ts',
      'export const enabled = false;\n',
      'export const enabled = true;\n',
    );

    const result = runtime.diff.apply({
      action: 'accept-file',
      targetId: 'feature.ts',
      engineId: 'velocity',
      targetPath,
      diffText: patch,
    });

    expect(result).toEqual(expect.objectContaining({
      applied: true,
      status: 'applied',
    }));
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('export const enabled = true;\n');

    const blocked = runtime.diff.apply({
      action: 'accept-file',
      targetId: 'outside.ts',
      engineId: 'velocity',
      targetPath: path.join(root, '..', 'outside.ts'),
      diffText: patch,
    });
    expect(blocked).toEqual(expect.objectContaining({
      applied: false,
      status: 'approval-required',
    }));
  });

  it('records the full product story for a trusted Velocity diff and promotes untrusted work to Shield', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-story-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-story-outside-'));
    const targetPath = path.join(root, 'note.txt');
    const runtime = makeRuntime();
    runtime.registry.select('velocity');
    runtime.trusted.add({ path: root, label: 'story trusted' });
    fs.writeFileSync(targetPath, 'before\n', 'utf8');

    const route = runtime.router.decide({
      prompt: 'Update the trusted note',
      operation: 'write',
      targetPath,
      content: 'after',
      requestedEngineId: 'velocity',
    });
    const patch = createTwoFilesPatch('note.txt', 'note.txt', 'before\n', 'after\n');
    const apply = runtime.diff.apply({
      action: 'accept-file',
      targetId: 'story-note',
      engineId: 'velocity',
      targetPath,
      diffText: patch,
    });
    const shield = runtime.router.decide({
      prompt: 'Update an untrusted note',
      operation: 'write',
      targetPath: path.join(outsideRoot, 'note.txt'),
      content: 'after',
      requestedEngineId: 'velocity',
    });
    const traceKinds = runtime.trace.list(20).map((event) => event.kind);

    expect(route).toEqual(expect.objectContaining({
      engineId: 'velocity',
      mode: 'trusted-workspace',
    }));
    expect(apply).toEqual(expect.objectContaining({
      applied: true,
      status: 'applied',
    }));
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('after\n');
    expect(traceKinds).toEqual(expect.arrayContaining(['engine-decision', 'diff', 'receipt']));
    expect(runtime.trace.list(20).find((event) => event.kind === 'receipt')).toEqual(expect.objectContaining({
      title: 'Velocity apply receipt',
      metadata: expect.objectContaining({
        targetPath,
        policy: 'trusted-workspace-only',
      }),
    }));
    expect(shield).toEqual(expect.objectContaining({
      engineId: 'shield',
      status: 'needs-approval',
      mode: 'sandbox',
    }));
  });

  it('blocks oversized Velocity diffs before host-direct apply', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diff-large-'));
    const targetPath = path.join(root, 'feature.ts');
    const runtime = makeRuntime();
    runtime.trusted.add({ path: root });
    fs.writeFileSync(targetPath, 'export const enabled = false;\n', 'utf8');

    const result = runtime.diff.apply({
      action: 'accept-file',
      targetId: 'feature.ts',
      engineId: 'velocity',
      targetPath,
      diffText: `${'x'.repeat(1024 * 1024 + 1)}`,
    });

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      status: 'blocked',
      summary: expect.stringContaining('too large'),
    }));
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('export const enabled = false;\n');
  });

  it('creates canvas sessions, attempts and local preview URLs', async () => {
    const trace = new GlassBoxTraceService();
    const preview = new CanvasPreviewServer(new CanvasEgressGuardService());
    const service = new CanvasSessionService(preview, trace);

    try {
      const session = await service.create({
        engineId: 'velocity',
        files: [{
          path: 'index.html',
          mimeType: 'text/html',
          content: '<!doctype html><html><head></head><body>hello</body></html>',
        }],
      });
      expect(session.previewUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/session\//);
      expect(session.attempts).toHaveLength(1);

      const withAttempt = await service.addAttempt({
        sessionId: session.sessionId,
        summary: 'second attempt',
        logs: ['retry'],
      });
      expect(withAttempt?.attempts).toHaveLength(2);
      expect(withAttempt?.activeAttemptId).toBe(withAttempt?.attempts[1].id);

      const selected = await service.selectAttempt(session.sessionId, session.attempts[0].id);
      expect(selected?.activeAttemptId).toBe(session.attempts[0].id);

      const latest = await service.getOrCreate();
      expect(latest.sessionId).toBe(session.sessionId);
    } finally {
      await preview.stop();
    }
  });

  it('syncs speculative autonomy attempts into Z-Canvas timeline snapshots', async () => {
    const trace = new GlassBoxTraceService();
    const preview = new CanvasPreviewServer(new CanvasEgressGuardService());
    const service = new CanvasSessionService(preview, trace);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-canvas-spec-'));
    const sandbox = path.join(workspace, 'sandbox');
    fs.mkdirSync(sandbox, { recursive: true });
    fs.writeFileSync(path.join(sandbox, 'index.html'), '<!doctype html><html><head></head><body>spec</body></html>', 'utf8');

    try {
      const attempt = {
        id: 'attempt-1',
        round: 1,
        sandboxWorkspace: sandbox,
        status: 'approved',
        summary: 'Preview rendered in sandbox.',
        touchedFiles: ['index.html'],
        diffText: 'diff --git a/index.html b/index.html\n',
        diffHash: null,
        astGraph: { generatedAt: '', workspaceRoot: sandbox, entryFiles: [], files: [], edges: [], summary: { fileCount: 0, edgeCount: 0, symbolCount: 0, parseErrorCount: 0 } },
        validationResults: [{ command: 'npm test', status: 'passed', exitCode: 0, stdout: 'ok', stderr: '', durationMs: 12 }],
        sandboxBackend: { kind: 'local-copy', requested: 'local-copy', validationExecution: 'host', runtime: 'local', hardened: true, detail: 'test' },
        critic: { approved: true, findings: [] },
        readinessGate: {},
        blockedReasons: [],
      };
      const session = await service.createFromSpeculativeAutonomyResult({
        id: 'spec-1',
        status: 'approved',
        summary: 'Speculative run approved.',
        workspaceRoot: workspace,
        runRoot: sandbox,
        attempts: [attempt],
        finalAttempt: attempt,
        mutationPlan: null,
        validationCommands: ['npm test'],
        receipts: [],
        autoHealing: {},
      } as never, 'shield');

      expect(session.sandboxRunId).toBe('spec-1');
      expect(session.attempts).toHaveLength(1);
      expect(session.files[0]).toEqual(expect.objectContaining({
        path: 'index.html',
        content: expect.stringContaining('spec'),
      }));
      expect(session.previewUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/session\//);
    } finally {
      await preview.stop();
    }
  });

  it('does not expose speculative attempt files outside the recorded run root', async () => {
    const trace = new GlassBoxTraceService();
    const preview = new CanvasPreviewServer(new CanvasEgressGuardService());
    const service = new CanvasSessionService(preview, trace);
    const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-canvas-run-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-canvas-outside-'));
    fs.writeFileSync(path.join(outsideRoot, 'secret.txt'), 'do-not-expose', 'utf8');

    try {
      const attempt = {
        id: 'attempt-outside',
        round: 1,
        sandboxWorkspace: outsideRoot,
        status: 'approved',
        summary: 'Forged outside attempt.',
        touchedFiles: ['secret.txt'],
        diffText: '',
        diffHash: null,
        astGraph: { generatedAt: '', workspaceRoot: outsideRoot, entryFiles: [], files: [], edges: [], summary: { fileCount: 0, edgeCount: 0, symbolCount: 0, parseErrorCount: 0 } },
        validationResults: [],
        sandboxBackend: { kind: 'local-copy', requested: 'local-copy', validationExecution: 'host', runtime: 'local', hardened: true, detail: 'test' },
        critic: { approved: true, findings: [] },
        readinessGate: {},
        blockedReasons: [],
      };
      const session = await service.createFromSpeculativeAutonomyResult({
        id: 'spec-outside',
        status: 'approved',
        summary: 'Speculative run approved.',
        workspaceRoot: runRoot,
        runRoot,
        attempts: [attempt],
        finalAttempt: attempt,
        mutationPlan: null,
        validationCommands: [],
        receipts: [],
        autoHealing: {},
      } as never, 'shield');

      expect(JSON.stringify(session.files)).not.toContain('do-not-expose');
      expect(session.logs[0]).toContain('outside');
    } finally {
      await preview.stop();
    }
  });

  it('does not expose sensitive sandbox files such as .env through Z-Canvas preview', async () => {
    const trace = new GlassBoxTraceService();
    const preview = new CanvasPreviewServer(new CanvasEgressGuardService());
    const service = new CanvasSessionService(preview, trace);
    const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-canvas-sensitive-'));
    const sandbox = path.join(runRoot, 'sandbox');
    fs.mkdirSync(sandbox, { recursive: true });
    fs.writeFileSync(path.join(sandbox, '.env'), 'API_KEY=do-not-render', 'utf8');
    fs.writeFileSync(path.join(sandbox, 'index.html'), '<!doctype html><html><head></head><body>safe</body></html>', 'utf8');

    try {
      const attempt = {
        id: 'attempt-sensitive',
        round: 1,
        sandboxWorkspace: sandbox,
        status: 'approved',
        summary: 'Sensitive file was touched but must stay hidden.',
        touchedFiles: ['.env', 'index.html'],
        diffText: 'diff --git a/.env b/.env\n',
        diffHash: null,
        astGraph: { generatedAt: '', workspaceRoot: sandbox, entryFiles: [], files: [], edges: [], summary: { fileCount: 0, edgeCount: 0, symbolCount: 0, parseErrorCount: 0 } },
        validationResults: [],
        sandboxBackend: { kind: 'local-copy', requested: 'local-copy', validationExecution: 'host', runtime: 'local', hardened: true, detail: 'test' },
        critic: { approved: true, findings: [] },
        readinessGate: {},
        blockedReasons: [],
      };
      const session = await service.createFromSpeculativeAutonomyResult({
        id: 'spec-sensitive',
        status: 'approved',
        summary: 'Speculative run approved.',
        workspaceRoot: runRoot,
        runRoot,
        attempts: [attempt],
        finalAttempt: attempt,
        mutationPlan: null,
        validationCommands: [],
        receipts: [],
        autoHealing: {},
      } as never, 'shield');

      expect(JSON.stringify(session.files)).not.toContain('do-not-render');
      expect(session.files.map((file) => file.path)).toEqual(['index.html']);
    } finally {
      await preview.stop();
    }
  });

  it('expires old preview sessions and enforces the local preview session cap', async () => {
    let now = 1_000;
    const trace = new GlassBoxTraceService();
    const preview = new CanvasPreviewServer(new CanvasEgressGuardService(), {
      ttlMs: 5_000,
      maxSessions: 1,
      now: () => now,
    });
    const service = new CanvasSessionService(preview, trace);

    try {
      await service.create({ summary: 'first' });
      await service.create({ summary: 'second' });
      expect(preview.getDiagnostics().sessionCount).toBe(1);

      now += 6_000;
      expect(preview.getDiagnostics()).toEqual(expect.objectContaining({
        sessionCount: 0,
        ttlMs: 5_000,
        maxSessions: 1,
      }));
    } finally {
      await preview.stop();
    }
  });
});
