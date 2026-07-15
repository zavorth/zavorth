import { NextResponse } from 'next/server';
import {
  getRuntimeEngineApiState,
  isExecutionEngineId,
  isUnsafeCrossSiteMutation,
  readJsonBody,
} from '../../runtime-engine-state';
import { nowIso } from '../zavorthControlApiSnapshot';

export const runtime = 'nodejs';

function inferOperation(
  _message: string,
  explicit: unknown,
):
  | 'chat'
  | 'read'
  | 'summarize'
  | 'code-question'
  | 'write'
  | 'delete'
  | 'shell'
  | 'network'
  | 'deploy'
  | 'transaction' {
  // Structured body.operation only — free-text keywords must never activate product operations.
  if (
    explicit === 'chat' ||
    explicit === 'read' ||
    explicit === 'summarize' ||
    explicit === 'code-question' ||
    explicit === 'write' ||
    explicit === 'delete' ||
    explicit === 'shell' ||
    explicit === 'network' ||
    explicit === 'deploy' ||
    explicit === 'transaction'
  ) {
    return explicit;
  }
  return 'chat';
}

function renderReply(input: {
  message: string;
  decision: ReturnType<ReturnType<typeof getRuntimeEngineApiState>['router']['decide']>;
}): string {
  const { decision } = input;
  if (decision.express) {
    return 'Express Mode selected. I can answer or inspect this without starting the heavier governed runtime. If the request turns into a file change, I will promote it to Velocity or Shield automatically.';
  }
  if (decision.engineId === 'velocity') {
    return 'Velocity selected. This looks eligible for a trusted-workspace diff, so Zavorth can prepare an interactive change and apply it directly only after you accept it.';
  }
  if (decision.mode === 'sandbox') {
    return 'Shield selected. This needs a sandbox preview first, then an approval or receipt before anything touches the host workspace.';
  }
  return 'Shield selected. This request has side effects or sensitive scope, so Zavorth will keep it behind policy, approval and receipts.';
}

export async function POST(request: Request) {
  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'cross-site mutation requests are blocked',
      },
      { status: 403 },
    );
  }
  const body = await readJsonBody(request);
  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : 'Hello';
  const { registry, router, trace } = getRuntimeEngineApiState();
  const operation = inferOperation(message, body.operation);
  const decision = router.decide({
    prompt: message,
    operation,
    targetPath: typeof body.targetPath === 'string' ? body.targetPath : null,
    command: typeof body.command === 'string' ? body.command : null,
    content: typeof body.content === 'string' ? body.content : null,
    requestedEngineId: isExecutionEngineId(body.engineId) ? body.engineId : registry.getActiveEngineId(),
    networkTargets: Array.isArray(body.networkTargets)
      ? body.networkTargets.filter((value): value is string => typeof value === 'string')
      : [],
  });
  const reply = renderReply({ message, decision });
  return NextResponse.json({
    ok: true,
    chat: {
      id: `chat-${Date.now()}`,
      status: decision.status === 'ready' ? 'accepted' : decision.status,
      message,
      reply,
      engineDecision: decision,
      traceEvents: trace.list(20),
      createdAt: nowIso(),
      mission: {
        id: `mission-${Date.now()}`,
        title: message,
        status: decision.express ? 'express' : decision.mode,
        summary: decision.reason,
        engineId: decision.engineId,
        nextSafeAction: decision.nextSafeAction,
      },
    },
  });
}
