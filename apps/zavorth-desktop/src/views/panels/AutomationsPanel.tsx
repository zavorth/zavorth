import type { RuntimeCapabilitiesSnapshot } from '../../apiClient';
import { DetailRows, PageFrame } from './panelPrimitives';

export function AutomationsPanel(props: {
  busy: boolean;
  runtimeCapabilities: RuntimeCapabilitiesSnapshot | null;
  onRuntimeStateAction(input: { domain: string; operation: string; metadata?: Record<string, unknown> }): void | Promise<void>;
}) {
  const capabilities = props.runtimeCapabilities;
  const jobRows = [
    {
      id: 'runtime-jobs',
      title: 'Scheduled jobs',
      description: capabilities?.jobs?.summary || 'Scheduler recovery state is not projected yet.',
      meta: capabilities?.jobs?.status || 'unknown',
      tone: capabilities?.jobs?.status === 'attention' ? 'warning' as const : capabilities?.jobs ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'cron',
              operation: 'recover',
              metadata: {
                runtimeActionType: 'recover-scheduled-jobs',
                scheduledJobs: {
                  recoverable: capabilities?.jobs?.status === 'attention' ? 1 : 0,
                  actionIds: capabilities?.jobs?.actionIds || [],
                },
              },
            })}
            type="button"
          >
            Recover
          </button>
        </div>
      ),
    },
    {
      id: 'runtime-stream',
      title: 'Stream session',
      description: capabilities?.streamSession?.resumeToken
        ? `Resume token: ${capabilities.streamSession.resumeToken}`
        : 'No resumable stream token is active.',
      meta: capabilities?.streamSession?.status || 'idle',
      tone: capabilities?.streamSession?.resumable ? 'ready' as const : 'muted' as const,
      actions: (
        <div className="zvd-row-actions">
          <button
            disabled={props.busy || !capabilities?.streamSession?.resumeToken}
            onClick={() => void props.onRuntimeStateAction({
              domain: 'session',
              operation: 'resume-stream',
              metadata: {
                runtimeActionType: 'resume-stream',
                streamSession: {
                  sessionId: capabilities?.streamSession?.resumeToken ? 'desktop-main' : null,
                  status: capabilities?.streamSession?.resumeToken ? 'streaming' : 'idle',
                  resumeToken: capabilities?.streamSession?.resumeToken || null,
                },
              },
            })}
            type="button"
          >
            Resume
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      eyebrow="Automacoes"
      description="Jobs locais, streams retomaveis e rotinas seguras do runtime."
      meta={capabilities?.jobs?.status || 'runtime'}
      title="Automacoes"
    >
      <DetailRows rows={jobRows} empty="No automation state is available." />
    </PageFrame>
  );
}
