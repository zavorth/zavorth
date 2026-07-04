import {
  buildSubagentIdentity,
  buildSubagentIconFrame,
  decorateSubagentRole,
} from '../../src/services/ZavorthSubagentIdentityService.js';

describe('ZavorthSubagentIdentityService', () => {
  it('creates deterministic identities with stable display data and animated running frames', () => {
    const idle = buildSubagentIdentity({
      roleId: 'planner',
      sessionId: 'session-alpha',
      status: 'idle',
      label: 'Planner',
    });
    const running = buildSubagentIdentity({
      roleId: 'planner',
      sessionId: 'session-alpha',
      status: 'running',
      label: 'Planner',
    });
    const same = buildSubagentIdentity({
      roleId: 'planner',
      sessionId: 'session-alpha',
      status: 'running',
      label: 'Planner',
    });

    expect(running).toMatchObject({
      id: 'session-alpha:planner',
      roleId: 'planner',
      status: 'running',
      motionState: 'running',
      label: 'Planner',
    });
    expect(running.displayName).toMatch(/\S+ \(Planner\)/);
    expect(running.glyph).toMatch(/^[A-Z0-9]{2}$/);
    expect(running.palette.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(running.iconFrames).toHaveLength(4);
    expect(running.identiconSeed).toBe('session-alpha:planner');
    expect(running.motion).toMatchObject({
      active: true,
      kind: 'orchestrator-ring',
      className: 'zvd-motion-orchestrator-ring',
      frameCount: 8,
    });
    expect(running.motion.delayMs).toBeGreaterThanOrEqual(0);
    expect(running.motion.delayMs).toBeLessThan(running.motion.intervalMs);
    expect(new Set(running.iconFrames).size).toBeGreaterThan(1);
    expect(running.iconSvg).toContain('zvd-identicon-motion-frame');
    expect(running.iconSvg).toContain('zvd-frame-0');
    expect(running.iconSvg).toContain('zvd-frame-7');
    expect(running.iconSvg).toContain('visibility="hidden"');
    expect(running.iconSvg).not.toContain('opacity=');
    expect(running.iconSvg).not.toContain('fill="#0c0c0e"');
    const fills = Array.from(running.iconSvg.matchAll(/fill="([^"]+)"/g)).map(match => match[1]);
    expect(new Set(fills).size).toBe(1);
    expect(buildSubagentIconFrame(running, 1)).not.toBe(buildSubagentIconFrame(running, 2));
    expect(buildSubagentIconFrame(idle, 1)).toBe(buildSubagentIconFrame(idle, 2));
    expect(same).toEqual(running);
  });

  it('keeps non-running states visually still and only animates active execution', () => {
    const ready = buildSubagentIdentity({
      roleId: 'planner',
      sessionId: 'session-alpha',
      status: 'ready',
      label: 'Planner',
    });
    const approvalRequired = buildSubagentIdentity({
      roleId: 'planner',
      sessionId: 'session-alpha',
      status: 'approval-required',
      label: 'Planner',
    });

    expect(ready.motionState).toBe('idle');
    expect(ready.motion.active).toBe(false);
    expect(buildSubagentIconFrame(ready, 3)).toBe(ready.iconFrames[0]);
    expect(approvalRequired.motionState).toBe('approval-required');
    expect(approvalRequired.motion.active).toBe(false);
  });

  it('detects the Zavorth mascot from the visible name as well as the internal role id', () => {
    const byLabel = buildSubagentIdentity({
      roleId: 'core',
      sessionId: 'agent-fixed',
      status: 'running',
      label: 'Zavorth',
    });
    const byRole = buildSubagentIdentity({
      roleId: 'zvd',
      sessionId: 'agent-fixed',
      status: 'idle',
      label: 'Core',
    });

    expect(byLabel.isMascot).toBe(true);
    expect(byLabel.motion.className).toBe('zvd-motion-mascot-sprite');
    expect(byLabel.motion.intervalMs).toBeGreaterThan(0);
    expect(byLabel.iconSvg).toContain('viewBox="0 0 512 512"');
    expect(byLabel.iconSvg).toContain('zvd-mascot-frame');
    expect(byLabel.iconSvg).toContain('zvd-mascot-frame-5');
    expect(byLabel.iconSvg).not.toContain('2048');
    expect(byRole.isMascot).toBe(true);
  });

  it('decorates role lists with the same identity used by UI surfaces', () => {
    const decorated = decorateSubagentRole({
      roleId: 'qa',
      sessionId: 'session-beta',
      status: 'completed',
      label: 'Quality Analyst',
    });

    expect(decorated.identity.roleId).toBe('qa');
    expect(decorated.label).toBe(decorated.identity.displayName);
    expect(decorated.identity.motionState).toBe('completed');
    expect(decorated.identity.iconFrames[0]).toContain(decorated.identity.glyph[0]);
  });

  it('derives activity-specific motion and status marks for every surface', () => {
    const researcher = buildSubagentIdentity({
      roleId: 'research',
      sessionId: 'session-activity',
      status: 'running',
      label: 'Codebase Researcher',
    });
    const auditor = buildSubagentIdentity({
      roleId: 'auditor',
      sessionId: 'session-activity',
      status: 'blocked',
      label: 'Security Auditor',
    });
    const debuggerAgent = buildSubagentIdentity({
      roleId: 'debugger',
      sessionId: 'session-activity',
      status: 'completed',
      label: 'Test Debugger',
    });
    const orchestrator = buildSubagentIdentity({
      roleId: 'orchestrator',
      sessionId: 'session-activity',
      status: 'queued',
      label: 'Task Orchestrator',
    });

    expect(researcher.activityMode).toBe('research');
    expect(researcher.motion.kind).toBe('research-scan');
    expect(researcher.iconSvg).toContain('zvd-activity-research');
    expect(researcher.iconSvg).toContain('zvd-status-running');
    expect(researcher.surface.className).toContain('zvd-activity-research');
    expect(researcher.surface.i18nKey).toBe('subagent.status.running');

    expect(auditor.activityMode).toBe('audit');
    expect(auditor.motion.kind).toBe('none');
    expect(auditor.iconSvg).toContain('zvd-activity-audit');
    expect(auditor.iconSvg).toContain('zvd-status-blocked');
    expect(auditor.statusGlyph).toBe('!');

    expect(debuggerAgent.activityMode).toBe('debug');
    expect(debuggerAgent.iconSvg).toContain('zvd-activity-debug');
    expect(debuggerAgent.iconSvg).toContain('zvd-status-completed');
    expect(debuggerAgent.statusGlyph).toBe('✓');

    expect(orchestrator.activityMode).toBe('orchestrate');
    expect(orchestrator.iconSvg).toContain('zvd-activity-orchestrate');
    expect(orchestrator.iconSvg).toContain('zvd-status-queued');
    expect(orchestrator.statusGlyph).toBe('…');
    expect(orchestrator.motionState).toBe('queued');

    for (const identity of [researcher, auditor, debuggerAgent, orchestrator]) {
      expect(identity.iconSvg).not.toContain('opacity=');
      expect(identity.surface.ariaLabel).toContain(identity.displayName);
      expect(identity.surface.title).toContain(identity.displayName);
    }
  });
});
