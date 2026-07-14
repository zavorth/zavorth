import type { SwarmSnapshot } from '../../runtime/sessions/v2/SwarmOrchestrator.js';
import type {
  SwarmV2BenchmarkSnapshot,
  SwarmV2OfficialState,
  SwarmV2OfficialSurface,
  SwarmV2ParallelMetrics,
  SwarmV2ReplayEvent,
  SwarmV2ReplayInsights,
} from './SwarmV2Types.js';
import { tService } from '../../i18n/services.js';

export function buildOfficialMetrics(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmV2ParallelMetrics {
  const roles = snapshot.roles || [];
  const completedRoles = roles.filter((role) => role.status === 'IDLE').length;
  const timedOutRoles = roles.filter((role) => role.status === 'TIMEOUT').length;
  const cancelledRoles = roles.filter((role) => role.status === 'CANCELLED').length;
  const failedRoles = roles.filter((role) => !['IDLE', 'TIMEOUT', 'CANCELLED'].includes(String(role.status))).length;
  const outputBytes = roles.reduce((total, role) => total + Buffer.byteLength(role.output.join(''), 'utf8'), 0);
  const started = new Date(state.startedAt).getTime();
  const elapsedMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;
  return {
    totalRoles: state.roles.length,
    queuedRoles: Math.max(0, state.roles.length - roles.length),
    runningRoles: state.batches.some((batch) => batch.status === 'running') ? state.maxConcurrency : 0,
    completedRoles,
    failedRoles,
    timedOutRoles,
    cancelledRoles,
    maxConcurrency: state.maxConcurrency,
    batchCount: state.batches.length,
    completedBatchCount: state.batches.filter((batch) => batch.status === 'completed').length,
    elapsedMs,
    outputBytes,
    synthesisChars: snapshot.synthesizedOutput?.length || 0,
    parallelismScore: Math.round((Math.min(state.maxConcurrency, state.roles.length) / Math.max(1, state.roles.length)) * 100),
  };
}

export function buildReplayTimelineItem(
  id: string,
  label: string,
  events: SwarmV2ReplayEvent[],
  types: SwarmV2ReplayEvent['type'][],
  status: SwarmV2ReplayInsights['timeline'][number]['status'],
): SwarmV2ReplayInsights['timeline'][number] {
  return {
    id,
    label,
    eventCount: events.filter((event) => types.includes(event.type)).length,
    status,
  };
}

export function buildReplayInsights(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmV2ReplayInsights {
  const events = state.replay;
  const roles = snapshot.roles || [];
  const roleOutputs = roles.map((role) => ({
    roleId: role.roleId,
    label: role.label,
    status: String(role.status || 'unknown'),
    outputBytes: Buffer.byteLength(role.output.join(''), 'utf8'),
    eventCount: events.filter((event) => event.roleId === role.roleId).length,
  }));
  const completedRoles = roles.filter((role) => role.status === 'IDLE').length;
  const failedRoles = roles.filter((role) => !['IDLE', 'PROCESSING'].includes(String(role.status))).length;
  const outputBytes = roleOutputs.map((role) => role.outputBytes);
  const strongest = roleOutputs.slice().sort((left, right) => right.outputBytes - left.outputBytes)[0] || null;
  const weakest = roleOutputs.slice().sort((left, right) => left.outputBytes - right.outputBytes)[0] || null;
  const outputSpreadBytes = outputBytes.length > 0
    ? Math.max(...outputBytes) - Math.min(...outputBytes)
    : 0;
  const bottlenecks: SwarmV2ReplayInsights['bottlenecks'] = [];
  if (state.batches.some((batch) => batch.status === 'failed')) {
    bottlenecks.push({
      id: 'batch-failed',
      severity: 'critical',
      summary: tService('swarm_runtime.batch_failed'),
    });
  }
  if (failedRoles > 0) {
    bottlenecks.push({
      id: 'role-failed',
      severity: 'warning',
      summary: `${failedRoles} role(s) terminaram sem sucesso limpo.`,
    });
  }
  if (outputSpreadBytes > 16_000) {
    bottlenecks.push({
      id: 'output-spread',
      severity: 'info',
      summary: 'One role produced much more context than the others; review the synthesis for volume bias.',
    });
  }
  const synthesisConfidence = Math.max(0, Math.min(100, Math.round(
    100
    - failedRoles * 18
    - (state.synthesisStatus === 'completed' ? 0 : 25)
    - (roles.length === 0 ? 20 : 0)
    - (bottlenecks.some((item) => item.severity === 'critical') ? 25 : 0),
  )));
  return {
    status: events.length === 0 ? 'empty' : state.queueStatus === 'running' ? 'recording' : 'ready',
    operatorSummary: events.length === 0
      ? 'Replay ainda sem eventos.'
      : `${events.length} event(s), ${completedRoles}/${state.roles.length} completed role(s), confidence ${synthesisConfidence}/100.`,
    timeline: [
      buildReplayTimelineItem('queued', 'Queue', events, ['swarm.queued', 'batch.queued'], state.queueStatus === 'queued' ? 'active' : 'done'),
      buildReplayTimelineItem('roles', 'Roles', events, ['role.started', 'role.output', 'role.finished'], state.queueStatus === 'running' ? 'active' : completedRoles > 0 ? 'done' : 'pending'),
      buildReplayTimelineItem('batches', 'Batches', events, ['batch.started', 'batch.finished'], state.batches.some((batch) => batch.status === 'failed') ? 'failed' : state.batches.some((batch) => batch.status === 'running') ? 'active' : 'done'),
      buildReplayTimelineItem('synthesis', 'Synthesis', events, ['swarm.synthesized', 'swarm.failed'], state.synthesisStatus === 'failed' ? 'failed' : state.synthesisStatus === 'completed' ? 'done' : 'pending'),
    ],
    byRole: roleOutputs.map((role) => ({
      ...role,
      confidence: role.status === 'IDLE'
        ? Math.min(100, 70 + Math.min(20, Math.floor(role.outputBytes / 400)))
        : role.status === 'PROCESSING'
          ? 45
          : 20,
    })),
    bottlenecks,
    compare: {
      completedRoles,
      failedRoles,
      outputSpreadBytes,
      strongestRoleId: strongest?.roleId || null,
      weakestRoleId: weakest?.roleId || null,
    },
    synthesisConfidence,
    nextReplayAction: bottlenecks.length > 0
      ? 'Abra os eventos por role e compare a sintese antes de confiar no resultado.'
      : state.synthesisStatus === 'completed'
        ? 'Use a sintese final e mantenha o replay como evidencia.'
        : 'Aguarde a sintese ou cancele se o swarm travar.',
  };
}

export function buildToolExecutionSnapshot(
  snapshot: SwarmSnapshot,
  state: SwarmV2OfficialState,
): SwarmV2OfficialSurface['toolExecution'] {
  const toolIds = state.roles.map((role) => String(role.toolSpecId || '')).filter(Boolean);
  const commandToolCount = state.roles.filter((role) => Boolean(role.command)).length;
  return {
    plannedToolCount: toolIds.length,
    executedToolCount: (snapshot.roles || []).filter((role) => toolIds.includes(role.roleId) || state.roles.find((item) => item.id === role.roleId)?.toolSpecId).length,
    commandToolCount,
    approvalRequiredToolCount: state.toolSpecs.filter((tool) => tool.requiresApproval !== false).length,
    toolIds,
  };
}

export function buildBenchmarkSnapshot(
  snapshot: SwarmSnapshot,
  state: SwarmV2OfficialState,
  metrics: SwarmV2ParallelMetrics,
): SwarmV2BenchmarkSnapshot {
  if (!state.benchmarkEnabled) {
    return {
      enabled: false,
      baseline: 'not-requested',
      elapsedMs: metrics.elapsedMs,
      estimatedSerialMs: 0,
      speedup: 0,
      throughputRolesPerSecond: 0,
      failureRate: 0,
      qualityScore: 0,
    };
  }
  const roleDurations = (snapshot.roles || []).map((role) => {
    const started = Date.parse(String(role.startedAt || ''));
    const finished = Date.parse(String(role.finishedAt || ''));
    return Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : 0;
  });
  const estimatedSerialMs = roleDurations.reduce((total, value) => total + value, 0) || metrics.elapsedMs;
  const failures = metrics.failedRoles + metrics.timedOutRoles + metrics.cancelledRoles;
  const failureRate = Math.round((failures / Math.max(1, metrics.totalRoles)) * 1000) / 1000;
  const qualityScore = Math.max(0, Math.min(100, Math.round(
    100
    - failureRate * 100
    - (metrics.synthesisChars > 0 ? 0 : 20)
    - (metrics.outputBytes > 0 ? 0 : 20),
  )));
  return {
    enabled: true,
    baseline: 'estimated-serial',
    elapsedMs: metrics.elapsedMs,
    estimatedSerialMs,
    speedup: Math.round((estimatedSerialMs / Math.max(1, metrics.elapsedMs)) * 100) / 100,
    throughputRolesPerSecond: Math.round((metrics.completedRoles / Math.max(1, metrics.elapsedMs / 1000)) * 100) / 100,
    failureRate,
    qualityScore,
  };
}
