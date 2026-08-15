import { readFileSync } from 'fs';
import {join, resolve} from 'path';
import { ZavorthAgentGateway, type UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';

import {
  buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthAgentGatewayZavorthControlAdapter';

const rootDir = resolve(__dirname, '../../../');

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-visual-real-${index}`;
  };
}

describe('ZavorthControlVisualRealQa', () => {
  it('runs a real gateway flow with approval, artifact, replay and history for the zavorthControl', async () => {
    let tick = 0;
    const executor: UniversalAgentExecutor = ({ run }) => ({
      status: 'completed',
      summary: 'QA visual real concluido: approval aprovado e artifact pronto.',
      replyText: 'Relatorio de QA visual real pronto.',
      events: [
        {
          kind: 'tool',
          title: 'Ferramenta executada',
          detail: 'shell.exec liberado pelo approval universal.',
          status: 'done',
        },
        {
          kind: 'artifact',
          title: 'Artifact gerado',
          detail: 'Relatorio anexado ao ZavorthControl.',
          status: 'done',
        },
      ],
      artifacts: [
        {
          id: 'qa-visual-real-report',
          title: 'Relatorio de QA Visual Real',
          kind: 'report',
          createdAt: run.updatedAt,
          sessionId: run.sessionId,
          status: 'ready',
        },
      ],
    });

    const gateway = new ZavorthAgentGateway({
      now: () => {
        tick += 1;
        return new Date(Date.parse('2026-04-26T18:00:00.000Z') + tick * 1000);
      },
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-zavorthControl-real-qa',
      text: 'gere um relatorio em PDF e rode um comando local para validar o painel',
      requestedTools: ['shell.exec', 'pdf.generate'],
      modelProfile: {
        providerLabel: 'OpenAI',
        modelLabel: 'gpt-4o',
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });

    const pendingViewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: pending.run.id }),
    );

    expect(pending.run.status).toBe('waiting_approval');
    expect(pendingViewModel).toEqual(expect.objectContaining({
      runtime: expect.objectContaining({
        status: 'degraded',
      }),
      agentRun: expect.objectContaining({
        status: 'waiting_approval',
      }),
      counts: expect.objectContaining({
        approvals: expect.any(Number),
      }),
      toolExposure: expect.objectContaining({
        mode: 'restricted',
      }),
    }));
    expect(pendingViewModel.approvals.length).toBeGreaterThanOrEqual(1);
    expect(pendingViewModel.approvals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'pending',
        risk: 'danger',
      }),
    ]));

    const approved = await gateway.approve(pending.run.approvals[0].id, { executor });
    const completedViewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: approved?.run.id }),
    );

    expect(approved).toEqual(expect.objectContaining({
      ok: true,
      resumed: true,
      run: expect.objectContaining({
        status: 'completed',
      }),
    }));
    expect(completedViewModel.runtime.status).toBe('ready');
    expect(completedViewModel.agentRun).toEqual(expect.objectContaining({
      status: 'completed',
      sessionId: 'session-zavorthControl-real-qa',
    }));
    expect(completedViewModel.counts.approvals).toBeLessThan(pendingViewModel.counts.approvals);
    expect(completedViewModel.artifacts).toEqual([
      expect.objectContaining({
        id: 'qa-visual-real-report',
        status: 'ready',
        kind: 'report',
      }),
    ]);
    expect(completedViewModel.replay).toEqual(expect.objectContaining({
      status: 'available',
      artifactCount: 1,
    }));
    expect(completedViewModel.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'session-zavorthControl-real-qa',
      }),
    ]));
    expect(completedViewModel.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes the real visual QA as a product script and documentation', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(rootDir, 'scripts/dashboard-real-flow-qa.ts'),
      'utf8',
    );
    const liveVisualScript = readFileSync(
      join(rootDir, 'scripts/dashboard-live-visual-qa.ts'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/web-dashboard.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-real']).toContain('scripts/dashboard-real-flow-qa.ts --require-pass');
    expect(packageJson.scripts['qa:zavorthControl-live-visual']).toBe('npx tsx scripts/zavorthControl-live-visual-qa.ts --require-pass');
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-real');
    expect(script).toContain('pending-approval-created');
    expect(script).toContain('artifact-generated');
    expect(script).toContain('history-and-replay-visible');
    expect(script).toContain('no-stale-pending-approval');
    expect(liveVisualScript).toContain('state.authState === "unlocked"');
    expect(liveVisualScript).toContain('01-chat-unlocked.png');
    expect(liveVisualScript).toContain('02-overview-unlocked.png');
    expect(liveVisualScript).toContain('forbiddenDemoData');
    expect(docs).toContain('qa:zavorthControl-real');
    expect(docs).toContain('qa:zavorthControl-live-visual');
    expect(docs).toContain('approval');
    expect(docs).toContain('artifact');
    expect(docs).toContain('replay');
  });
});
