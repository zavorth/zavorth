import { ZavorthActionCatalog } from '../../../src/runtime/actions/ZavorthActionCatalog';
import { ZavorthActionGateway } from '../../../src/runtime/actions/ZavorthActionGateway';
import { ZavorthEchoOrchestrator } from '../../../src/echo/orchestrator/ZavorthEchoOrchestrator';

const EXTENDED_ACTION_IDS = [
  'video.generate',
  'kanban.board',
  'skills.feedback',
  'trajectories.batch',
  'terminal.backend',
  'email.smtp.send',
  'calendar.local.event',
  'code.review',
  'database.sqlite.query',
];

const EXTENDED_TOOL_NAMES = [
  'video_generate',
  'kanban_board',
  'skills_feedback',
  'trajectories_batch',
  'terminal_backend',
  'email_smtp_send',
  'calendar_local_event',
  'code_review',
  'database_sqlite_query',
];

const LEGACY_DIRECT_TOOL_NAMES = [
  'generate_video',
  'send_email',
  'skill_feedback',
  'batch_trajectory',
  'calendar_event',
  'database_query',
];

describe('Zavorth extended native tool actions', () => {
  it('registers all extended tools as verified LLM-facing Action Harness actions', () => {
    const catalog = new ZavorthActionCatalog();

    for (const actionId of EXTENDED_ACTION_IDS) {
      const action = catalog.get(actionId);
      expect(action).toEqual(expect.objectContaining({
        id: actionId,
        verificationStatus: 'verified',
        capabilityId: 'native-extended-tools',
      }));
      expect(action?.surface).toContain('llm');
    }
  });

  it('exposes all extended actions to the Echo LLM tool surface', () => {
    const orchestrator = new ZavorthEchoOrchestrator({
      startBackgroundBridges: false,
      actionGateway: new ZavorthActionGateway(),
    });
    const toolNames = orchestrator.listRegisteredTools().map((tool) => tool.name);

    for (const toolName of EXTENDED_TOOL_NAMES) {
      expect(toolNames).toContain(toolName);
    }
    for (const legacyName of LEGACY_DIRECT_TOOL_NAMES) {
      expect(toolNames).not.toContain(legacyName);
    }
  });

  it('keeps risky extended actions approval-gated through the Action Harness', async () => {
    const gateway = new ZavorthActionGateway({ mutationPlane: null });

    for (const actionId of ['video.generate', 'terminal.backend', 'email.smtp.send', 'database.sqlite.query']) {
      const result = await gateway.apply(actionId, { prompt: 'test', command: 'echo test', to: 'a@example.com', subject: 's', body: 'b', query: 'SELECT 1' });
      expect(result.status).toBe('approval_required');
    }
  });
});
