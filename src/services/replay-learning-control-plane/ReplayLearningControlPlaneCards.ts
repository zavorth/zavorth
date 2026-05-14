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
      summary: coldStart
        ? 'Sem replay suficiente ainda; o plano sobe sozinho assim que chegarem runs, workflows ou artifacts.'
        : `${input.summary.timelineEvents} evento(s), ${input.summary.workflowRuns} workflow(s), ${input.summary.resumableWorkflowRuns} retomavel(is).`,
      nextAction: coldStart
        ? 'Gerar os primeiros runs para habilitar compare, resume e restore.'
        : input.summary.resumeReady
        ? 'Retomar pelo melhor ponto de entrada do replay.'
        : 'Gerar mais historico antes de comparar ou retomar.',
      command: '/memoryplane',
    },
    {
      id: 'artifacts',
      label: 'Artifacts reutilizaveis',
      posture: coldStart ? 'healthy' : (input.summary.reusableArtifacts > 0 ? 'healthy' : 'attention'),
      summary: coldStart
        ? 'Nenhum artifact registrado ainda; isso e normal antes das primeiras execucoes operacionais.'
        : `${input.summary.recentArtifacts} artifact(s) recente(s), ${input.summary.reusableArtifacts} reutilizavel(is).`,
      nextAction: coldStart
        ? 'Aguardar artifacts de tasks ou workflows para habilitar resume from artifact.'
        : input.summary.reusableArtifacts > 0
        ? 'Usar resume from artifact para abrir uma nova sessao guiada.'
        : 'Esperar artifacts de workflow ou task para habilitar retomada.',
      command: '/memoryplane',
    },
    {
      id: 'lifecycle',
      label: 'Execution lifecycle',
      posture: input.summary.lifecycleAttention > 0 ? 'attention' : 'healthy',
      summary: input.summary.lifecycleEvents > 0
        ? `${input.summary.lifecycleEvents} evento(s), ${input.summary.lifecycleRuns} run(s), ${input.summary.lifecycleApprovals} approval(s), ${input.summary.lifecycleArtifacts} artifact(s).`
        : 'Nenhum lifecycle canonico exposto ainda neste recorte.',
      nextAction: input.summary.lifecycleAttention > 0
        ? input.lifecycle.narrative.nextAction
        : 'Continuar registrando traceId/runId nos fluxos mutaveis.',
      command: '/memoryplane',
    },
    {
      id: 'learning',
      label: 'Learning promotions',
      posture: input.summary.pendingLearning > 0 ? 'attention' : 'healthy',
      summary: text(input.learningPlane?.narrative?.operatorSummary, `${input.summary.learningCandidates} candidato(s) no learning plane.`),
      nextAction: input.summary.pendingLearning > 0
        ? 'Revisar candidatos pendentes e promover apenas os confiaveis.'
        : 'Manter candidatos promovidos sob revisao periodica.',
      command: '/learning candidates',
    },
    {
      id: 'memory',
      label: 'Layered memory',
      posture: input.summary.memoryPressure === 'critical'
        ? 'critical'
        : (input.summary.memoryPressure === 'elevated' ? 'attention' : 'healthy'),
      summary: text(input.layeredMemory?.narrative?.operatorSummary, `${input.summary.memoryEntries} entrada(s) na memoria.`),
      nextAction: input.summary.memoryPressure === 'ok'
        ? 'Usar search quando precisar recuperar episodio, fato ou procedimento.'
        : 'Revisar budgets da memoria antes de promover mais learning.',
      command: '/memory status',
    },
    {
      id: 'workspace',
      label: 'Workspace restore',
      posture: coldStart ? 'healthy' : (input.summary.restoreReady ? 'healthy' : 'attention'),
      summary: coldStart
        ? 'Workspace ainda sem continuidade suficiente; o restore aparece depois dos primeiros runs e procedimentos.'
        : text(input.memoryPlane?.workspace?.summary, `${Number(input.procedures?.total || 0)} procedimento(s) disponivel(is).`),
      nextAction: coldStart
        ? 'Executar uma tarefa real para registrar continuidade e procedimentos.'
        : input.summary.restoreReady
        ? 'Restaurar contexto por continuidade, workflow ou artifact recente.'
        : 'Ainda falta sinal de workspace suficiente para restore guiado.',
      command: '/sessions',
    },
  ];
}
