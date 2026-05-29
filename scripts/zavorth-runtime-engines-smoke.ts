import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { ExecutionEngineRegistryService } from '../src/services/ExecutionEngineRegistryService.js';
import { ExecutionEngineRouterService } from '../src/services/ExecutionEngineRouterService.js';
import { GlassBoxTraceService } from '../src/services/GlassBoxTraceService.js';
import { InteractiveDiffReviewService } from '../src/services/InteractiveDiffReviewService.js';
import { TrustedWorkspacePolicyService } from '../src/services/TrustedWorkspacePolicyService.js';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

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

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-smoke-trusted-'));
  const untrustedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-smoke-untrusted-'));
  const target = path.join(root, 'note.txt');
  const outsideTarget = path.join(untrustedRoot, 'note.txt');
  const runtime = makeRuntime();
  runtime.trusted.add({ path: root, label: 'Runtime smoke trusted folder' });

  fs.writeFileSync(target, 'status=old\n', 'utf8');
  fs.writeFileSync(outsideTarget, 'status=old\n', 'utf8');
  const patch = createTwoFilesPatch('note.txt', 'note.txt', 'status=old\n', 'status=new\n');

  const trustedDecision = runtime.router.decide({
    operation: 'write',
    targetPath: target,
    content: 'status=new\n',
  });
  assert(trustedDecision.engineId === 'velocity', `expected trusted edit to route to Velocity, got ${trustedDecision.engineId}`);
  assert(trustedDecision.status === 'ready', `expected trusted edit to be ready, got ${trustedDecision.status}`);

  const apply = runtime.diff.apply({
    action: 'accept-file',
    targetId: 'note.txt',
    engineId: 'velocity',
    targetPath: target,
    diffText: patch,
  });
  assert(apply.applied === true, `expected trusted diff to apply, got ${apply.status}`);
  assert(fs.readFileSync(target, 'utf8') === 'status=new\n', 'trusted file did not contain the accepted diff result');

  const untrustedDecision = runtime.router.decide({
    operation: 'write',
    targetPath: outsideTarget,
    content: 'status=new\n',
  });
  assert(untrustedDecision.engineId === 'shield', `expected untrusted edit to route to Shield, got ${untrustedDecision.engineId}`);
  assert(untrustedDecision.status === 'needs-approval', `expected untrusted edit to require approval, got ${untrustedDecision.status}`);

  const blockedApply = runtime.diff.apply({
    action: 'accept-file',
    targetId: 'outside-note.txt',
    engineId: 'velocity',
    targetPath: outsideTarget,
    diffText: patch,
  });
  assert(blockedApply.applied === false, 'untrusted Velocity diff must not apply');
  assert(blockedApply.status === 'approval-required', `expected approval-required for untrusted diff, got ${blockedApply.status}`);
  assert(fs.readFileSync(outsideTarget, 'utf8') === 'status=old\n', 'untrusted file was modified unexpectedly');

  console.log(JSON.stringify({
    ok: true,
    trustedDecision: {
      engineId: trustedDecision.engineId,
      mode: trustedDecision.mode,
      status: trustedDecision.status,
    },
    trustedApply: {
      status: apply.status,
      applied: apply.applied,
    },
    untrustedDecision: {
      engineId: untrustedDecision.engineId,
      mode: untrustedDecision.mode,
      status: untrustedDecision.status,
    },
    untrustedApply: {
      status: blockedApply.status,
      applied: blockedApply.applied,
    },
    traceEvents: runtime.trace.list().length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
