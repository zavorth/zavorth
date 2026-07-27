import { RecentTaskResolver } from '../../src/services/RecentTaskResolver';

describe('RecentTaskResolver', () => {
  it('prefers an active task when the user asks a short follow-up', () => {
    const resolver = new RecentTaskResolver({
      getRecentTasks: jest.fn().mockReturnValue([
        {
          task_id: 'task-running',
          status: 'running',
          raw_message: '/ag pesquise noticias',
          normalized_message: '/ag pesquise noticias',
          command_type: '/ag',
          intent: 'plan_execution',
          result_summary: 'Coletando fontes',
        },
        {
          task_id: 'task-completed',
          status: 'completed',
          raw_message: '/research noticias',
          normalized_message: '/research noticias',
          command_type: '/research',
          intent: 'query',
          result_summary: 'Resumo final',
        },
      ]),
    } as any);

    const reply = resolver.resolve('user-1', 'current-task', 'where is it-');

    expect(reply).toContain('A ultima tarefa ainda esta em andamento.');
    expect(reply).toContain('task-run');
    expect(reply).toContain('Collecting sources');
  });
});
