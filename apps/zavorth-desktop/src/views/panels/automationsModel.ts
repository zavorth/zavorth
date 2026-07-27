/**
 * Pure model helpers for the automations master/detail panel.
 */

export type AutomationJobKind = 'schedule' | 'runtime' | 'stream';

export type AutomationJob = {
  id: string;
  kind: AutomationJobKind;
  name: string;
  project?: string;
  prompt?: string;
  intervalMinutes?: number;
  enabled?: boolean;
  status: string;
  description: string;
  tone: 'ready' | 'warning' | 'muted' | 'danger';
  lastRun?: number;
  nextRun?: number;
  lastSessionId?: string;
  history?: Array<{ at: string; ok: boolean; message?: string | null }>;
};

export function mapScheduledTasks(
  tasks: Array<{
    id: string;
    name?: string;
    project?: string;
    prompt?: string;
    intervalMinutes?: number;
    enabled?: boolean;
    status?: string;
    lastRun?: number;
    nextRun?: number;
    lastSessionId?: string;
    history?: Array<{ at: string; ok: boolean; message?: string | null }>;
  }>,
): AutomationJob[] {
  return (tasks || []).map(task => {
    const enabled = task.enabled !== false;
    const status = enabled ? (task.status || 'idle') : 'paused';
    return {
      id: task.id,
      kind: 'schedule' as const,
      name: task.name || task.id,
      project: task.project,
      prompt: task.prompt,
      intervalMinutes: task.intervalMinutes,
      enabled,
      status,
      description: task.prompt
        ? String(task.prompt).slice(0, 140)
        : `Every ${task.intervalMinutes || '...'} min`,
      tone: status === 'failed' ? 'danger' as const
        : status === 'running' ? 'warning' as const
        : enabled ? 'ready' as const : 'muted' as const,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      lastSessionId: task.lastSessionId,
      history: task.history,
    };
  });
}

export function buildRuntimeAutomationJobs(input: {
  jobsSummary?: string | null;
  jobsStatus?: string | null;
  streamStatus?: string | null;
  streamResumable?: boolean;
  resumeToken?: string | null;
}): AutomationJob[] {
  const attention = String(input.jobsStatus || '').toLowerCase() === 'attention';
  return [
    {
      id: 'runtime-jobs',
      kind: 'runtime',
      name: 'Scheduled jobs',
      status: input.jobsStatus || 'unknown',
      description: input.jobsSummary || 'Scheduler state is not projected yet.',
      tone: attention ? 'warning' : input.jobsStatus ? 'ready' : 'muted',
    },
    {
      id: 'runtime-stream',
      kind: 'stream',
      name: 'Stream session',
      status: input.streamStatus || 'idle',
      description: input.resumeToken ? `Resume token available (${String(input.resumeToken).slice(0, 12)}…)`
        : 'No resumable stream token is active.',
      tone: input.streamResumable ? 'ready' : 'muted',
    },
  ];
}

export function mergeAutomationJobs(
  scheduled: AutomationJob[],
  runtime: AutomationJob[],
): AutomationJob[] {
  return [...scheduled, ...runtime];
}

export function filterAutomationJobs(jobs: AutomationJob[], query: string): AutomationJob[] {
  const q = query.trim().toLowerCase();
  if (!q) return jobs;
  return jobs.filter(j =>
    j.name.toLowerCase().includes(q)
    || j.status.toLowerCase().includes(q)
    || (j.project || '').toLowerCase().includes(q)
    || (j.description || '').toLowerCase().includes(q)
    || j.kind.includes(q),
  );
}

export function selectAutomationJob(
  jobs: AutomationJob[],
  selectedId: string | null,
): AutomationJob | null {
  if (!jobs.length) return null;
  if (selectedId) {
    const found = jobs.find(j => j.id === selectedId);
    if (found) return found;
  }
  return jobs[0] || null;
}
