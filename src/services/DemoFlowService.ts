export type DemoScenario = {
  key: string;
  title: string;
  objective: string;
  prompt: string;
  highlight: string[];
  speakerNote: string;
  successSignal: string;
  permissionNote?: string;
};

export class DemoFlowService {
  private readonly scenarios: DemoScenario[] = [
    {
      key: 'research',
      title: 'Pesquisa web',
      objective: 'Mostrar que o Zavorth responde perguntas cotidianas sem soar tecnico demais.',
      prompt: '/task pesquise na web se deixar a tampa do notebook quase fechada faz mal a longo prazo',
      highlight: [
        'O Zavorth responde pela rota de pesquisa web estruturada, sem pedir AI Studio a toa.',
        'A resposta deve sair clara, pratica e sem jargao interno.',
      ],
      speakerNote: 'Use essa etapa para mostrar que ele resolve uma pergunta comum como assistente, nao como painel tecnico.',
      successSignal: 'A resposta chega no proprio chat, com linguagem simples e utilidade imediata.',
    },
    {
      key: 'files',
      title: 'Arquivos',
      objective: 'Mostrar listagem de pasta, permissao especifica e envio de arquivo.',
      prompt: '/arquivo me envie o arquivo index.html da pasta C:/workspace/zavorth-web',
      highlight: [
        'Se a pasta estiver fora da area liberada, o Zavorth abre uma aprovacao especifica e read-only.',
        'Depois da aprovacao, ele retoma sozinho e envia o arquivo corretamente.',
      ],
      speakerNote: 'Aqui o foco e mostrar seguranca com conforto: o usuario aprova so aquela pasta e a tarefa continua sozinha.',
      successSignal: 'O chat mostra a aprovacao, retoma o fluxo e envia o arquivo solicitado como documento.',
      permissionNote: 'Se aparecer permissao, destaque que ela e especifica, read-only e limitada a esta tarefa ou projeto.',
    },
    {
      key: 'workflow',
      title: 'Workflow composto',
      objective: 'Mostrar que o Zavorth encadeia etapas maiores em vez de responder de forma rasa.',
      prompt: '/workflow research pesquise o mercado de IA local e entregue um briefing curto',
      highlight: [
        'Esse fluxo mostra pesquisa, sintese e entrega final dentro do mesmo pedido.',
        'A percepcao aqui e de orquestrador, nao so de chatbot.',
      ],
      speakerNote: 'Vale reforcar que ele nao responde de forma rasa; ele encadeia etapas e devolve uma entrega pronta.',
      successSignal: 'O resultado final aparece como briefing sintetizado, nao como uma lista crua de passos tecnicos.',
    },
    {
      key: 'stitch',
      title: 'Geracao com Stitch',
      objective: 'Mostrar geracao visual real com entrega de artefato.',
      prompt: '/stitch crie uma landing page moderna para um app de tarefas com hero, CTA e secao de beneficios',
      highlight: [
        'O Stitch devolve imagem e HTML, e o Zavorth trata isso como artefato de primeira classe.',
        'Esse e um dos demos mais fortes para mostrar criacao real, nao so texto.',
      ],
      speakerNote: 'Use essa parte para mostrar criacao visual de verdade e entrega de artefatos, nao so conversa.',
      successSignal: 'O Zavorth entrega imagem, HTML ou link de artefato de forma organizada no chat.',
    },
  ];

  public formatOverview(options: { demoModeEnabled?: boolean } = {}): string {
    const lines = [
      'Roteiro de demo do Zavorth',
      '',
      options.demoModeEnabled ? 'Modo demo: ativo e pronto para apresentacao.' : 'Modo demo: inativo. Use /demo on para preparar o Zavorth antes de apresentar.',
      '',
      'Antes de comecar:',
      '- Ative /demo on para limpar a experiencia e reduzir jargao interno.',
      '- Se quiser mais controle na apresentacao, combine com /operator on.',
      '',
      'Cenas prontas para mostrar:',
    ];

    for (const scenario of this.scenarios) {
      lines.push(`- ${scenario.title}: /demo ${scenario.key}`);
    }

    lines.push('', 'Sequencia guiada sugerida:');
    lines.push('- /demo start para abrir a apresentacao guiada');
    lines.push('- /demo next para avancar passo a passo');
    lines.push('- /demo short para ver a versao resumida');
    lines.push('1. /demo research');
    lines.push('2. /demo files');
    lines.push('3. /demo workflow');
    lines.push('4. /demo stitch');
    lines.push('', 'Fechamento sugerido: /demo pitch ou /status');

    return lines.join('\n');
  }

  public formatPitch(): string {
    return [
      'Pitch curto do Zavorth',
      '',
      'O Zavorth e um assistente operacional inteligente que transforma pedidos em linguagem natural em acoes reais, com memoria, seguranca e varios executores especializados por baixo.',
      '',
      'Em vez de ser so um chatbot, ele funciona como uma camada de comando pessoal: entende o pedido, escolhe a melhor rota, pede aprovacao quando necessario e entrega o resultado no canal certo.',
      '',
      'Como resumir em uma conversa curta:',
      '- ele pesquisa, organiza e executa',
      '- ele trata seguranca como parte da experiencia',
      '- ele entrega texto, arquivos e resultados visuais',
      '',
      'Destaques para mostrar:',
      '- pesquisa web clara e sem jargao',
      '- leitura e envio de arquivos com permissao especifica',
      '- workflows compostos',
      '- geracao visual com Stitch',
    ].join('\n');
  }

  public formatChecklist(): string {
    return [
      'Checklist de demo do Zavorth',
      '',
      'Preparacao:',
      '- /demo on',
      '- confirme /status e /tasks',
      '',
      'Sequencia:',
      '- /demo start',
      '- use /demo next ate concluir as etapas',
      '',
      'Fechamento:',
      '- /demo pitch',
      '- /status',
    ].join('\n');
  }

  public formatScenario(key: string): string | null {
    const scenario = this.scenarios.find((entry) => entry.key === key);
    if (!scenario) {
      return null;
    }

    return [
      `Cena de demo: ${scenario.title}`,
      '',
      `Objetivo: ${scenario.objective}`,
      '',
      'Prompt sugerido:',
      scenario.prompt,
      '',
      'O que mostrar:',
      ...scenario.highlight.map((line) => `- ${line}`),
      '',
      `Frase de apoio: ${scenario.speakerNote}`,
      `Sinal de sucesso: ${scenario.successSignal}`,
      scenario.permissionNote ? `Se aparecer permissao: ${scenario.permissionNote}` : null,
    ].join('\n');
  }

  public formatFullRunbook(): string {
    const lines = ['Demo completa do Zavorth', ''];

    for (const scenario of this.scenarios) {
      lines.push(`Passo: ${scenario.title}`);
      lines.push(`Objetivo: ${scenario.objective}`);
      lines.push(`Prompt: ${scenario.prompt}`);
      lines.push(`Frase de apoio: ${scenario.speakerNote}`);
      lines.push(`Sinal de sucesso: ${scenario.successSignal}`);
      if (scenario.permissionNote) {
        lines.push(`Se aparecer permissao: ${scenario.permissionNote}`);
      }
      lines.push('O que mostrar:');
      lines.push(...scenario.highlight.map((line) => `- ${line}`));
      lines.push('');
    }

    lines.push('Fechamento sugerido:');
    lines.push('- Mostre /tasks para reforcar a central de tarefas.');
    lines.push('- Mostre /status para provar que o runtime esta supervisionado.');

    return lines.join('\n').trim();
  }

  public formatShortPresentation(): string {
    return [
      'Apresentacao curta do Zavorth',
      '',
      'Abertura sugerida:',
      'Apresente o Zavorth como um assistente operacional que pesquisa, executa e entrega com seguranca.',
      '',
      'Sequencia curta para mostrar ao vivo:',
      `1. ${this.scenarios[0].prompt}`,
      `2. ${this.scenarios[1].prompt}`,
      '',
      'Frase de apoio:',
      'Comece com uma pergunta cotidiana e depois mostre um pedido com arquivo para provar utilidade e controle.',
      '',
      'Fechamento sugerido:',
      'Mostre /tasks ou /status para reforcar que ele orquestra e acompanha tarefas reais.',
    ].join('\n');
  }

  public getScenarios(): DemoScenario[] {
    return [...this.scenarios];
  }

  public formatGuidedStep(index: number): string | null {
    const scenario = this.scenarios[index];
    if (!scenario) {
      return null;
    }

    return [
      `Passo ${index + 1}/${this.scenarios.length}: ${scenario.title}`,
      '',
      `Objetivo: ${scenario.objective}`,
      '',
      'Prompt para usar agora:',
      scenario.prompt,
      '',
      'O que mostrar na tela:',
      ...scenario.highlight.map((line) => `- ${line}`),
      '',
      `Frase de apoio: ${scenario.speakerNote}`,
      `Sinal de sucesso: ${scenario.successSignal}`,
      scenario.permissionNote ? `Se aparecer permissao: ${scenario.permissionNote}` : null,
      '',
      index < this.scenarios.length - 1
        ? 'Quando terminar esta etapa, use /demo next.'
        : 'Esta e a ultima etapa. Para reiniciar a sequencia, use /demo reset.',
    ].join('\n');
  }

  public formatGuidedStart(): string {
    return [
      'Sequencia guiada iniciada.',
      '',
      'Como abrir a apresentacao:',
      'Comece dizendo que o Zavorth nao e so um chat: ele pesquisa, executa, pede aprovacao quando necessario e entrega o resultado no mesmo fluxo.',
      '',
      'Agora vamos para a primeira cena.',
    ].join('\n');
  }

  public formatGuidedCompletion(): string {
    return [
      'Sequencia guiada concluida.',
      '',
      'Fechamento sugerido:',
      '- use /demo pitch para encerrar com a visao do produto',
      '- use /tasks para reforcar o acompanhamento das tarefas',
      '- use /status para mostrar que o runtime esta supervisionado',
      '',
      'Se quiser rodar tudo de novo, use /demo reset e depois /demo start.',
    ].join('\n');
  }
}
