import {
  isPermissionDecisionEvent,
  isUndoEvent,
  parseSurfaceInteraction,
  SEMANTIC_INTERACTION_CONTRACT_VERSION,
  toPermissionApprovalArgs,
} from '../../../src/domain/surface/application/surface-projection/index.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('SurfaceInteractionNormalizer (F4)', () => {
  it('parses modern task callbacks once/session/always/deny', () => {
    for (const choice of ['once', 'session', 'always', 'deny'] as const) {
      const event = parseSurfaceInteraction({
        surface: 'telegram',
        raw: `task:${choice}:${TASK_ID}`,
        kindHint: 'callback',
      });
      expect(event?.version).toBe(SEMANTIC_INTERACTION_CONTRACT_VERSION);
      expect(event?.kind).toBe('callback');
      expect(event?.choice).toBe(choice);
      expect(event?.approvalId).toBe(TASK_ID);
      expect(event?.controlId).toBe('agent-permission-choices');
      expect(isPermissionDecisionEvent(event!)).toBe(true);
      expect(toPermissionApprovalArgs(event!)?.choice).toBe(choice);
    }
  });

  it('parses legacy task:approve as once and task:reject as deny', () => {
    const approve = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `task:approve:${TASK_ID}`,
      kindHint: 'callback',
    });
    expect(approve?.choice).toBe('once');
    expect(approve?.metadata?.legacyCallback).toBe(true);

    const reject = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `task:reject:${TASK_ID}`,
      kindHint: 'callback',
    });
    expect(reject?.choice).toBe('deny');
    expect(reject?.action).toBe('reject');
  });

  it('parses task:undo callbacks', () => {
    const event = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `task:undo:${TASK_ID}`,
      kindHint: 'callback',
    });
    expect(isUndoEvent(event!)).toBe(true);
    expect(event?.approvalId).toBe(TASK_ID);
    expect(toPermissionApprovalArgs(event!)).toBeNull();
  });

  it('parses slash /approve and /reject', () => {
    const once = parseSurfaceInteraction({
      surface: 'cli',
      raw: `/approve ${TASK_ID} once`,
      kindHint: 'text',
    });
    expect(once?.kind).toBe('slash');
    expect(once?.choice).toBe('once');
    expect(once?.approvalId).toBe(TASK_ID);

    const session = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `/approve ${TASK_ID} session`,
    });
    expect(session?.choice).toBe('session');

    const reject = parseSurfaceInteraction({
      surface: 'cli',
      raw: `/reject ${TASK_ID}`,
    });
    expect(reject?.choice).toBe('deny');
    expect(reject?.action).toBe('reject');
  });

  it('accepts /deny as an exact synonym of /reject', () => {
    const viaReject = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `/reject ${TASK_ID}`,
      kindHint: 'text',
    });
    const viaDeny = parseSurfaceInteraction({
      surface: 'telegram',
      raw: `/deny ${TASK_ID}`,
      kindHint: 'text',
    });
    expect(viaDeny?.kind).toBe(viaReject?.kind);
    expect(viaDeny?.choice).toBe('deny');
    expect(viaDeny?.action).toBe(viaReject?.action);
    expect(viaDeny?.approvalId).toBe(TASK_ID);
  });

  it('parses bare approve/reject commands (CLI style)', () => {
    const event = parseSurfaceInteraction({
      surface: 'cli',
      raw: `approve ${TASK_ID} always`,
      kindHint: 'text',
    });
    expect(event?.kind).toBe('command');
    expect(event?.choice).toBe('always');
  });

  it('parses API JSON and kv choice payloads', () => {
    const json = parseSurfaceInteraction({
      surface: 'desktop',
      raw: JSON.stringify({ choice: 'session', approvalId: TASK_ID }),
      kindHint: 'api',
    });
    expect(json?.kind).toBe('api_choice');
    expect(json?.choice).toBe('session');
    expect(json?.approvalId).toBe(TASK_ID);

    const short = parseSurfaceInteraction({
      surface: 'web',
      raw: `once ${TASK_ID}`,
      kindHint: 'api',
    });
    expect(short?.choice).toBe('once');
    expect(short?.approvalId).toBe(TASK_ID);
  });

  it('parses numbered replies when options provided', () => {
    const event = parseSurfaceInteraction({
      surface: 'whatsapp',
      raw: '2',
      kindHint: 'text',
      numberedOptions: ['once', 'session', 'always', 'deny'],
    });
    expect(event?.kind).toBe('numbered_reply');
    expect(event?.choice).toBe('session');
    expect(event?.optionId).toBe('session');
  });

  it('returns unknown for noise (not null)', () => {
    const event = parseSurfaceInteraction({
      surface: 'telegram',
      raw: 'hello world',
    });
    expect(event?.kind).toBe('unknown');
    expect(event?.action).toBe('unknown');
    expect(isPermissionDecisionEvent(event!)).toBe(false);
  });

  it('returns null for empty input', () => {
    expect(parseSurfaceInteraction({ surface: 'cli', raw: '   ' })).toBeNull();
  });

  it('N inputs map to same once choice (interaction matrix)', () => {
    const inputs = [
      { surface: 'telegram', raw: `task:once:${TASK_ID}`, kindHint: 'callback' as const },
      { surface: 'telegram', raw: `task:approve:${TASK_ID}`, kindHint: 'callback' as const },
      { surface: 'cli', raw: `/approve ${TASK_ID} once`, kindHint: 'text' as const },
      { surface: 'cli', raw: `approve ${TASK_ID} once`, kindHint: 'text' as const },
      {
        surface: 'desktop',
        raw: JSON.stringify({ choice: 'once', approvalId: TASK_ID }),
        kindHint: 'api' as const,
      },
      { surface: 'web', raw: `once ${TASK_ID}`, kindHint: 'api' as const },
    ];

    for (const input of inputs) {
      const event = parseSurfaceInteraction(input);
      const args = toPermissionApprovalArgs(event!);
      expect(args).toEqual({ taskId: TASK_ID, choice: 'once' });
    }
  });
});
