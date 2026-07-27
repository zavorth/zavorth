import { IntentRouter } from '../../src/orchestrator/IntentRouter';

describe('IntentRouter', () => {
  const router = new IntentRouter();

  it('routes basic web research in /task to the structured web route', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'research today main AI news on the web',
      normalized_message: 'research today main ai news on the web',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBeNull();
    expect(route.dispatch_mode).toBe('execution');
    expect(route.intent).toBe('web_search');
  });

  it('routes interface generation in /task to Stitch', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'gere uma landing page moderna com hero e cta',
      normalized_message: 'gere uma landing page moderna com hero e cta',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBe('stitch');
    expect(route.dispatch_mode).toBe('execution');
    expect(route.intent).toBe('design_generation');
  });

  it('routes code investigation in /auto to ExternalExecutor', () => {
    const route = router.route({
      command_type: '/auto',
      command_args: 'investigate this project bug and review the code',
      normalized_message: 'investigate this project bug and review the code',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBe('external_executor');
    expect(route.dispatch_mode).toBe('execution');
    expect(route.intent).toBe('code_execution');
  });

  it('mantem conversa quando not there is executor implicito claro', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'I want to think about ideas to organize my routine',
      normalized_message: 'I want to think about ideas to organize my routine',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBeNull();
    expect(route.dispatch_mode).toBe('conversation');
    expect(route.intent).toBe('hybrid_task');
  });

  it('not trata pergunta cotidiana como tarefa tecnica so por conter problema', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'is it harmful or problematic to leave the laptop lid partly closed-',
      normalized_message: 'is it harmful or problematic to leave the laptop lid partly closed-',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBeNull();
    expect(route.dispatch_mode).toBe('conversation');
    expect(route.intent).toBe('hybrid_task');
  });
});
