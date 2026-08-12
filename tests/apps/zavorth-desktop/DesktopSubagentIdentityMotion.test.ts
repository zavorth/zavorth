import {
  appendSubagentTask,
  completeSubagentTask,
  createSubagent,
} from '../../../apps/zavorth-desktop/src/desktop-state/subagents';

describe('desktop subagent identity motion', () => {
  it('binds animated identity motion to the actual subagent runtime state', () => {
    const now = () => '2026-07-03T12:00:00.000Z';
    const agent = createSubagent('QA Reviewer', 'auditor', () => 'agent_fixed', now);
    const started = appendSubagentTask([agent], 'agent_fixed', 'Check the desktop shell.', now);
    const completed = completeSubagentTask(started, 'agent_fixed', 'Check the desktop shell.', now);

    expect(agent.identity).toMatchObject({
      identiconSeed: 'agent_fixed:auditor',
      motionState: 'idle',
      motion: {
        active: false,
        className: 'zvd-motion-static',
      },
    });
    expect(started[0].identity).toMatchObject({
      identiconSeed: 'agent_fixed:auditor',
      motionState: 'running',
      activityMode: 'audit',
      motion: {
        active: true,
        kind: 'audit-border',
        className: 'zvd-motion-audit-border',
      },
    });
    expect(started[0].identity.surface.className).toContain('zvd-activity-audit');
    expect(completed[0].identity).toMatchObject({
      motionState: 'completed',
      motion: {
        active: false,
        className: 'zvd-motion-static',
      },
    });
  });
});
