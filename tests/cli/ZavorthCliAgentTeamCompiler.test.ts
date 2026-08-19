import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildAgentTeamCompilerCliLaunchResult,
  buildAgentTeamCompilerCliSnapshot,
  formatAgentTeamCompilerSnapshot,
  resolveAgentTeamCompilerApprovalId,
  resolveAgentTeamCompilerCliAction,
  resolveAgentTeamCompilerCliText,
} from '../../src/cli/ZavorthCliAgentTeamCompilerRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-agent-team',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Agent Team Compiler', () => {
  it('parses agent-team text after subcommands', () => {
    expect(resolveAgentTeamCompilerCliText('preview "implemente com subagentes"')).toBe('implemente com subagentes');
    expect(resolveAgentTeamCompilerCliAction('launch "implemente com subagentes" --approval-id abc')).toBe('launch');
    expect(resolveAgentTeamCompilerApprovalId('launch "implemente" --approval-id agent-team-approval:run-1')).toBe('agent-team-approval:run-1');
  });

  it('renders agent-team JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'agent-team',
      normalized: 'agent-team',
      args: 'preview "implemente com subagentes"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      source: 'AgentTeamCompilerService',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: expect.any(Number),
        approvalRequiredCount: expect.any(Number),
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth agent-team');
  });

  it('renders approved agent-team launch JSON through the registry command', async () => {
    const writes: string[] = [];
    const preview = buildAgentTeamCompilerCliSnapshot({
      text: 'implemente com subagentes',
      userId: 'grey',
      sessionId: 'session-cli-agent-team-launch',
    });

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: {
        ...createFlags(true),
        sessionId: 'session-cli-agent-team-launch',
      },
      commandName: 'agent-team',
      normalized: 'agent-team',
      args: `launch "implemente com subagentes" --approval-id ${preview.approval.approvalId}`,
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      source: 'AgentTeamCompilerService',
      status: 'prepared',
      approval: expect.objectContaining({
        matched: true,
      }),
      synthesis: expect.objectContaining({
        status: 'ready-for-final-synthesis',
      }),
      policy: expect.objectContaining({
        noDirectToolExecution: true,
        peerReviewRequiredBeforeSynthesis: true,
      }),
    }));
    expect(payload.turns.some((turn: any) => turn.phase === 'peer-review')).toBe(true);
  });

  it('blocks agent-team launch JSON without approval', () => {
    const result = buildAgentTeamCompilerCliLaunchResult({
      text: 'implemente com subagentes',
      userId: 'grey',
      sessionId: 'session-cli-agent-team-launch-blocked',
      approvalId: null,
    });

    expect(result.status).toBe('blocked');
    expect(result.blockedReasons).toContain('approval-id-mismatch');
    expect(result.policy.noDirectToolExecution).toBe(true);
  });

  it('does not silently render preview for parsed inspect and synthesize actions', async () => {
    for (const action of ['inspect', 'synthesize']) {
      const writes: string[] = [];
      const result = await handleZavorthCliRegistryOpsCommand({
        runtime: {} as any,
        effectiveFlags: createFlags(false),
        commandName: 'agent-team',
        normalized: 'agent-team',
        args: `${action} run-1`,
        writer: {
          line: (text) => writes.push(text),
          error: (text) => writes.push(text),
        },
      });

      expect(result).toEqual(expect.objectContaining({
        ok: false,
        handled: true,
        error: `Action "${action}" has not been implemented for agent-team yet.`,
      }));
      expect(writes[0]).toBe(`Action "${action}" has not been implemented for agent-team yet.`);
    }
  });

  it('formats a compact human summary', () => {
    const snapshot = buildAgentTeamCompilerCliSnapshot({
      text: 'compile equipe para entrega',
      userId: 'grey',
      sessionId: 'session-cli-agent-team-human',
    });

    const text = formatAgentTeamCompilerSnapshot(snapshot);

    expect(text).toContain('Agent Team Compiler - Channel mesh0');
    expect(text).toContain('Roles');
    expect(text).toContain('no subagent was launched');
    expect(text).toMatch(/\/zavorthControl\.\.\.sector=agents/);
  });
});
