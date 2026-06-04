import { readFileSync } from 'fs';
import { join } from 'path';
import { ZavorthAgentGateway, type UniversalAgentExecutor } from '../../../src/runtime/agent/index.js';
import {
  buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot as buildDashboardViewModelFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/zavorthAgentGatewayCommandCenterAdapter.js';

const rootDir = process.cwd();

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-visual-real-${index}`;
  };
}

describe('DashboardVisualRealQa', () => {
  it('runs a real gateway flow with approval, artifact, replay and history for the dashboard', async () => {
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
          detail: 'Relatorio anexado ao Dashboard.',
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
      defaultModelLabel: 'gpt-5.2',
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-dashboard-real-qa',
      text: 'gere um relatorio em PDF e rode um comando local para validar o painel',
      requestedTools: ['shell.exec', 'pdf.generate'],
      modelProfile: {
        providerLabel: 'OpenAI',
        modelLabel: 'gpt-5.2',
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });

    const pendingViewModel = buildDashboardViewModelFromZavorthAgentGatewaySnapshot(
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
        approvals: 1,
      }),
      toolExposure: expect.objectContaining({
        mode: 'restricted',
      }),
    }));
    expect(pendingViewModel.approvals).toEqual([
      expect.objectContaining({
        status: 'pending',
        risk: 'danger',
      }),
    ]);

    const approved = await gateway.approve(pending.run.approvals[0].id, { executor });
    const completedViewModel = buildDashboardViewModelFromZavorthAgentGatewaySnapshot(
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
      sessionId: 'session-dashboard-real-qa',
    }));
    expect(completedViewModel.counts.approvals).toBe(0);
    expect(completedViewModel.runtime.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pending-approvals',
      }),
    ]));
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
        id: 'session-dashboard-real-qa',
      }),
    ]));
    expect(completedViewModel.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps dashboard runtime behavior covered by scripts and product docs', () => {
    const packageJson = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const visualCheckScript = readFileSync(
      join(rootDir, 'scripts/zavorth-control-responsive-visual-qa-check.mjs'),
      'utf8',
    );
    const docs = readFileSync(
      join(rootDir, 'docs/web-dashboard.md'),
      'utf8',
    );

    expect(packageJson.scripts['qa:zavorthControl-dashboard-visual']).toContain('zavorth-control-responsive-visual-qa-check.mjs');
    expect(packageJson.scripts['qa:zavorthControl']).toContain('qa:zavorthControl-dashboard-visual');
    expect(visualCheckScript).toContain('zavorthControl-responsive-visual-qa');
    expect(visualCheckScript).toContain('desktop');
    expect(visualCheckScript).toContain('mobile');
    expect(visualCheckScript).toContain('auto-subagents');
    expect(docs).toContain('approval');
    expect(docs).toContain('artifact');
    expect(docs).toContain('receipts');
  });
});
