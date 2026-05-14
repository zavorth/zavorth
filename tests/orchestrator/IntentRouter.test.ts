import { IntentRouter } from '../../src/orchestrator/IntentRouter';

describe('IntentRouter', () => {
  const router = new IntentRouter();

  it('roteia pesquisa web basica em /task para a rota web estruturada', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'pesquise as principais noticias de IA de hoje na web',
      normalized_message: 'pesquise as principais noticias de ia de hoje na web',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBe('web_research');
    expect(route.dispatch_mode).toBe('execution');
    expect(route.intent).toBe('web_research');
  });

  it('roteia geracao de interface em /task para Stitch', () => {
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

  it('roteia investigacao de codigo em /auto para ExternalExecutor', () => {
    const route = router.route({
      command_type: '/auto',
      command_args: 'investigue esse bug no projeto e revise o codigo',
      normalized_message: 'investigue esse bug no projeto e revise o codigo',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBe('external_executor');
    expect(route.dispatch_mode).toBe('execution');
    expect(route.intent).toBe('code_execution');
  });

  it('mantem conversa quando nao ha executor implicito claro', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'quero pensar em ideias para organizar minha rotina',
      normalized_message: 'quero pensar em ideias para organizar minha rotina',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBeNull();
    expect(route.dispatch_mode).toBe('conversation');
    expect(route.intent).toBe('hybrid_task');
  });

  it('nao trata pergunta cotidiana como tarefa tecnica so por conter problema', () => {
    const route = router.route({
      command_type: '/task',
      command_args: 'deixar a tampa do notebook semi fechada faz mal ou tem problema?',
      normalized_message: 'deixar a tampa do notebook semi fechada faz mal ou tem problema?',
      explicit_executor: null,
      references_last_task: false,
    });

    expect(route.executor_preference).toBeNull();
    expect(route.dispatch_mode).toBe('conversation');
    expect(route.intent).toBe('hybrid_task');
  });
});
