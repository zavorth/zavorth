import {
  EXPERIENCE_EXECUTION_GRAPH_CONTRACT_VERSION,
  type ExperienceExecutionGraph,
  type ExperienceExecutionGraphNode,
  type ExperienceTimelineItem,
} from './ExperienceContracts.js';
import type {
  UniversalAgentEvent,
  UniversalAgentRun,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ExecutionGraphBuildInput = {
  activeRun?: UniversalAgentRun | null;
  runs?: UniversalAgentRun[];
  timeline?: ExperienceTimelineItem[];
  generatedAt?: string;
};

export class ExecutionGraphService {
  public build(input: ExecutionGraphBuildInput = {}): ExperienceExecutionGraph {
    const now = input.generatedAt || new Date().toISOString();
    const run = input.activeRun || input.runs?.[0] || null;
    const nodes = run
      ? this.nodesFromRun(run)
      : this.nodesFromTimeline(input.timeline || [], now);
    const edges = nodes.slice(1).map((node, index) => ({
      from: nodes[index].id,
      to: node.id,
      label: 'depois',
    }));

    return {
      contractVersion: EXPERIENCE_EXECUTION_GRAPH_CONTRACT_VERSION,
      nodes: nodes.slice(0, 16),
      edges: edges.slice(0, 15),
    };
  }

  private nodesFromRun(run: UniversalAgentRun): ExperienceExecutionGraphNode[] {
    const base: ExperienceExecutionGraphNode[] = [{
      id: `graph:${run.id}:prompt`,
      label: 'Prompt',
      kind: 'prompt',
      status: 'done',
      detail: run.input || run.title,
      createdAt: run.createdAt,
    }];

    const eventNodes = run.events.map((event) => this.nodeFromEvent(event));
    const artifactNodes = run.artifacts.slice(0, 3).map((artifact) => ({
      id: `graph:${run.id}:artifact:${artifact.id}`,
      label: artifact.title,
      kind: 'receipt' as const,
      status: artifact.status === 'failed' ? 'failed' as const : artifact.status === 'ready' ? 'done' as const : 'pending' as const,
      detail: `Artefato ${artifact.kind}.`,
      createdAt: artifact.createdAt,
    }));

    return [...base, ...eventNodes, ...artifactNodes]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  private nodesFromTimeline(timeline: ExperienceTimelineItem[], now: string): ExperienceExecutionGraphNode[] {
    if (timeline.length === 0) {
      return [{
        id: 'graph:idle',
        label: 'Aguardando comando',
        kind: 'router',
        status: 'pending',
        detail: 'Nenhuma jornada ativa foi encontrada.',
        createdAt: now,
      }];
    }
    return timeline.map((item) => ({
      id: `graph:${item.id}`,
      label: item.title,
      kind: this.kindFromTimeline(item.kind),
      status: item.status === 'running'
        ? 'running'
        : item.status === 'failed'
          ? 'failed'
          : item.status === 'blocked'
            ? 'blocked'
            : item.status === 'pending'
              ? 'pending'
              : 'done',
      detail: item.detail,
      createdAt: item.createdAt,
    }));
  }

  private nodeFromEvent(event: UniversalAgentEvent): ExperienceExecutionGraphNode {
    return {
      id: `graph:${event.runId}:${event.id}`,
      label: event.title,
      kind: this.kindFromEvent(event.kind, event.title),
      status: event.status === 'running'
        ? 'running'
        : event.status === 'failed'
          ? 'failed'
          : event.status === 'pending'
            ? 'pending'
            : 'done',
      detail: event.detail || event.kind,
      createdAt: event.createdAt,
    };
  }

  private kindFromEvent(kind: UniversalAgentEvent['kind'], title: string): ExperienceExecutionGraphNode['kind'] {
    const normalized = `${kind} ${title}`.toLowerCase();
    if (kind === 'input') return 'prompt';
    if (kind === 'planning') return normalized.includes('safety') || normalized.includes('policy') ? 'safety' : 'router';
    if (kind === 'tool') return normalized.includes('sandbox') ? 'sandbox' : 'tool';
    if (kind === 'approval') return 'approval';
    if (kind === 'artifact' || kind === 'reply') return 'receipt';
    if (normalized.includes('critic')) return 'critic';
    return 'llm';
  }

  private kindFromTimeline(kind: ExperienceTimelineItem['kind']): ExperienceExecutionGraphNode['kind'] {
    if (kind === 'intent') return 'prompt';
    if (kind === 'planning') return 'router';
    if (kind === 'tool') return 'tool';
    if (kind === 'approval') return 'approval';
    if (kind === 'receipt' || kind === 'reply') return 'receipt';
    return 'llm';
  }
}
