import type {
  ZavorthReplayLearningCard,
  ZavorthReplayLearningControlPlaneSnapshot,
} from '../ZavorthReplayLearningControlPlaneService.js';
import type { ExecutionLifecycleReadModelSnapshot } from '../ExecutionLifecycleReadModelService.js';
import { isReplayLearningColdStart, text } from './ReplayLearningControlPlaneSupport.js';

export function buildReplayLearningCards(input: {
  memoryPlane: any;
  layeredMemory: any;
  layeredMemoryMetrics: any;
  learningPlane: any;
  procedures: any;
  lifecycle: ExecutionLifecycleReadModelSnapshot;
  summary: ZavorthReplayLearningControlPlaneSnapshot['summary'];
}): ZavorthReplayLearningCard[] {
  const coldStart = isReplayLearningColdStart(input.summary);
  return [
    {
      id: 'replay',
      label: 'Replay timeline',
      posture: coldStart ? 'healthy' : (input.summary.resumeReady || input.summary.compareReady ? 'healthy' : 'attention'),
      summary: coldStart ? 'without enough replay yet; the plan raises itself as runs, workflows, or artifacts arrive.'
        : `${input.summary.timelineEvents} event(s), ${input.summary.workflowRuns} workflow(s), ${input.summary.resumableWorkflowRuns} retomavel(is).`,
      nextAction: coldStart ? 'Generate the first runs to enable compare, resume, and restore.'
        : input.summary.resumeReady ? 'resume pelo melhor ponto de entrada do replay.'
        : 'Generate more history before comparing or resuming.',
      command: '/memoryplane',
    },
    {
      id: 'artifacts',
      label: 'Artifacts reutilizaveis',
      posture: coldStart ? 'healthy' : (input.summary.reusableArtifacts > 0 ? 'healthy' : 'attention'),
      summary: coldStart ? 'No artifact registrado ainda; isso e normal before das primeiras execucoes operacionais.'
        : `${input.summary.recentArtifacts} artifact(s) recente(s), ${input.summary.reusableArtifacts} reutilizavel(is).`,
      nextAction: coldStart ? 'Aguardar artifacts de tasks ou workflows para habilitar resume from artifact.'
        : input.summary.reusableArtifacts > 0
        ? 'Usar resume from artifact para abrir uma nova session guiada.'
        : 'Esperar artifacts de workflow ou task para habilitar resumed.',
      command: '/memoryplane',
    },
    {
      id: 'lifecycle',
      label: 'Execution lifecycle',
      posture: input.summary.lifecycleAttention > 0 ? 'attention' : 'healthy',
      summary: input.summary.lifecycleEvents > 0
        ? `${input.summary.lifecycleEvents} event(s), ${input.summary.lifecycleRuns} run(s), ${input.summary.lifecycleApprovals} approval(s), ${input.summary.lifecycleArtifacts} artifact(s).`
        : 'No lifecycle canonical exposto ainda neste recorte.',
      nextAction: input.summary.lifecycleAttention > 0
        ? input.lifecycle.narrative.nextAction
        : 'Keep recording traceId/runId in mutable flows.',
      command: '/memoryplane',
    },
    {
      id: 'learning',
      label: 'Learning promotions',
      posture: input.summary.pendingLearning > 0 ? 'attention' : 'healthy',
      summary: text(input.learningPlane?.narrative?.operatorSummary, `${input.summary.learningCandidates} candidate(s) no learning plane.`),
      nextAction: input.summary.pendingLearning > 0
        ? 'review pending candidates and promote only trusted ones.'
        : 'Keep promoted candidates under periodic review.',
      command: '/learning candidates',
    },
    {
      id: 'memory',
      label: 'Layered memory',
      posture: input.summary.memoryPressure === 'critical'
        ? 'critical'
        : (input.summary.memoryPressure === 'elevated' ? 'attention' : 'healthy'),
      summary: text(input.layeredMemory?.narrative?.operatorSummary, `${input.summary.memoryEntries} memory entry/entries.`),
      nextAction: input.summary.memoryPressure === 'ok'
        ? 'Use search when an episode, fact, or procedure must be recovered.'
        : 'Review memory budgets before promoting more learning.',
      command: '/memory status',
    },
    {
      id: 'workspace',
      label: 'Workspace restore',
      posture: coldStart ? 'healthy' : (input.summary.restoreReady ? 'healthy' : 'attention'),
      summary: coldStart ? 'Workspace ainda without continuidade suficiente; o restore aparece after dos primeiros runs e procedimentos.'
        : text(input.memoryPlane?.workspace?.summary, `${Number(input.procedures?.total || 0)} procedure(s) available(is).`),
      nextAction: coldStart ? 'run uma task real para registrar continuidade e procedimentos.'
        : input.summary.restoreReady ? 'Restore context by continuity, workflow, or recent artifact.'
        : 'Still missing sinal de workspace suficiente para restore guiado.',
      command: '/sessions',
    },
  ];
}
