import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { capabilityChoices, choice, commonCapabilityQuestion, mode, question, req, step } from './builders.js';

export const LOCAL_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'AIGateway',
    label: 'AIGateway',
    aliases: ['ai-gateway-local'],
    summary: 'Gateway local-first ja integrado ao Zavorth.',
    description: 'Funciona como sidecar local e conversa diretamente com o runtime do Zavorth.',
    supportLevel: 'native',
    category: 'local',
    tags: ['provider', 'sidecar', 'local-first'],
    modes: [
      mode('cli', 'Worktree local', 'Usa o sidecar ja vendorado no Zavorth.', true),
      mode('docker', 'Container local', 'Alternativa futura para mais isolamento.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'provider',
      key: 'AIGateway',
      status: 'ready',
      summary: 'Provider e sidecar ja suportados.',
    },
    requirements: [
      req('vendor', 'Vendor AIGateway presente', 'O worktree local do sidecar precisa existir.', {
        type: 'binary',
      }),
      req('upstream_key', 'Credencial upstream', 'Dependendo da sua configuracao, o gateway pode precisar de uma chave por tras.', {
        type: 'env',
        secret: true,
        envKey: 'AIGateway_API_KEY',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer rodar o AIGateway?', 'single_choice', 'O worktree local e o fluxo ja dominado pelo Zavorth.', {
        required: false,
        choices: [
          choice('cli', 'Worktree local', 'Recomendado: usa o sidecar atual.'),
          choice('docker', 'Container local', 'Planejado para mais isolamento.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Verificar sidecar', 'Confirmar se o sidecar ja existe e se precisa ficar quente.', 'guided'),
      step('bootstrap', 'Checar sidecar', 'Validar dependencias e estado do sidecar.', 'verification', 'npm run sidecars:status'),
      step('doctor', 'Rodar doctor', 'Confirmar se o gateway esta roteavel.', 'verification', 'npm run integrations:doctor -- --id AIGateway'),
    ],
    safetyNotes: ['Como e local-first, preserva melhor soberania e latencia.'],
    goodFor: ['Gateway principal', 'Baixa latencia', 'Soberania local'],
  },
  {
    id: 'zavorth-terminal',
    label: 'ZavorthBridge Remote',
    aliases: ['zavorth-bridge-remote', 'zavorth-terminal', 'agremote', 'omni-zavorth-bridge-remote-chat'],
    summary: 'Sidecar remoto oficial do ZavorthBridge, vendorado e operado pelo Zavorth.',
    description: 'Expoe a UI remota do ZavorthBridge via sidecar local, com doctor proprio, modo remoto e playbook seguro.',
    supportLevel: 'native',
    category: 'local',
    tags: ['zavorthBridge', 'remote-ui', 'sidecar', 'mobile'],
    modes: [
      mode('cli', 'Worktree local', 'Usa o worktree vendorado e o sidecar remoto oficial.', true),
      mode('browser', 'UI remota', 'Usa a interface remota protegida do ZavorthBridge.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['browser', 'vision', 'automation'],
    binding: {
      kind: 'service',
      key: 'zavorth-terminal',
      status: 'ready',
      summary: 'Sidecar remoto e doctor do ZavorthBridge ja sao conhecidos pelo runtime.',
    },
    requirements: [
      req('vendor', 'Vendor ZavorthBridge Remote presente', 'O worktree local do sidecar precisa existir.', {
        type: 'binary',
      }),
      req('app_password', 'Senha do app remoto', 'Protege o acesso web do sidecar remoto.', {
        type: 'env',
        secret: true,
        envKey: 'ZAVORTH_BRIDGE_REMOTE_APP_PASSWORD',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer operar o remoto do ZavorthBridge?', 'single_choice', 'O worktree local e o fluxo padrao recomendado.', {
        required: false,
        choices: [
          choice('cli', 'Worktree local', 'Recomendado: usa o vendor ja controlado pelo Zavorth.'),
          choice('browser', 'UI remota', 'Abre a interface remota protegida do ZavorthBridge.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Revisar sidecar remoto', 'Confirmar se o vendor remoto ja existe e se o modo remoto deve ficar ativo.', 'guided'),
      step('bootstrap', 'Checar sidecar', 'Validar dependencias e estado do sidecar remoto.', 'verification', 'npm run sidecars:status'),
      step('doctor', 'Rodar doctor remoto', 'Confirmar se o remoto do ZavorthBridge esta pronto para uso seguro.', 'verification', 'npm run integrations:doctor -- --id zavorth-terminal'),
    ],
    safetyNotes: [
      'Mantenha a senha do app remoto fora de chats, logs e do Git.',
      'So exponha a UI remota em redes e superficies que voce controla.',
      'Prefira diagnosticar primeiro e reparar depois; o doctor do Zavorth ja conhece esse fluxo.',
    ],
    goodFor: ['Acesso remoto ao ZavorthBridge', 'Controle mobile', 'Playbook de retomada'],
  },
  {
    id: 'external-executor',
    label: 'External Executor',
    aliases: ['external_executor', 'external-runner', 'local-agent-bridge', 'agent-bridge'],
    summary: 'Executor local/WSL ja suportado no Zavorth para codigo e agentes.',
    description: 'O hub o trata como conector local com foco em revisao, execucao e orquestracao.',
    supportLevel: 'native',
    category: 'local',
    tags: ['executor', 'wsl', 'code'],
    modes: [
      mode('cli', 'CLI local/WSL', 'Usa o executor ja embutido no Zavorth.', true),
      mode('docker', 'Container local', 'Planejado para isolamento adicional.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['code', 'agents', 'automation'],
    binding: {
      kind: 'executor',
      key: 'external_executor',
      status: 'ready',
      summary: 'Executor local ja presente no gateway.',
    },
    requirements: [
      req('external_executor_cli', 'CLI do executor externo acessivel', 'O Zavorth precisa conseguir chamar a CLI.', {
        type: 'binary',
      }),
      req('workspace_binding', 'Workspace autorizado', 'O executor externo pode exigir binding explicito do workspace.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer rodar o executor externo?', 'single_choice', 'O Zavorth ja fala bem com a CLI local/WSL.', {
        required: false,
        choices: [
          choice('cli', 'CLI local/WSL', 'Recomendado.'),
          choice('docker', 'Container local', 'Planejado para depois.'),
        ],
      }),
      question('capabilities', 'Quais capacidades voce quer priorizar?', 'multi_choice', 'Esta ponte costuma ser mais util em codigo e automacao.', {
        required: false,
        choices: capabilityChoices.filter((entry) => ['code', 'agents', 'automation'].includes(entry.value)),
      }),
    ],
    installSteps: [
      step('review', 'Confirmar transporte', 'Definir se a CLI vai rodar em WSL ou direto.', 'guided'),
      step('doctor', 'Rodar doctor', 'Validar CLI, binding e workspace.', 'verification', 'npm run integrations:doctor -- --id external-executor'),
    ],
    safetyNotes: ['Como e executor local, respeite as politicas de permissao do Zavorth.'],
    goodFor: ['Revisao de codigo', 'Execucao local', 'Fluxos autonomos'],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    aliases: ['local-llm'],
    summary: 'Receita local para rodar modelos no proprio host com foco em soberania.',
    description: 'O Zavorth ainda nao tem provider Ollama nativo, mas ja consegue orientar instalacao e healthcheck.',
    supportLevel: 'recipe',
    category: 'local',
    tags: ['local', 'privacy', 'recipe'],
    modes: [
      mode('docker', 'Docker local', 'Recomendado para comecar com mais isolamento.'),
      mode('cli', 'Instalacao nativa', 'Bom quando voce quer controle total do host.'),
    ],
    defaultMode: 'docker',
    capabilities: ['chat', 'code'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'A receita e suportada, mas o binding automatico ainda e planejado.',
    },
    requirements: [
      req('host_resources', 'Recursos do host', 'Modelos locais podem consumir muita RAM, CPU e disco.', {
        type: 'manual',
      }),
      req('docker_optional', 'Docker funcional', 'Necessario apenas se voce escolher o modo container.', {
        type: 'docker',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer instalar o Ollama?', 'single_choice', 'Docker tende a ser mais previsivel para comecar.', {
        required: false,
        choices: [
          choice('docker', 'Docker local', 'Recomendado para mais isolamento.'),
          choice('cli', 'Instalacao nativa', 'Quando voce quer controle total do host.'),
        ],
      }),
      question('model_family', 'Que perfil de modelo local voce quer primeiro?', 'single_choice', 'Isso ajuda a estimar requisito de maquina.', {
        required: false,
        choices: [
          choice('small', 'Leve', 'Mais simples para hosts modestos.'),
          choice('coding', 'Codigo', 'Melhor para revisao e implementacao locais.'),
          choice('general', 'Uso geral', 'Equilibrio entre chat e raciocinio.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Revisar capacidade do host', 'Confirmar se o host aguenta um LLM local sem atrapalhar o restante.', 'guided'),
      step('install', 'Instalar Ollama', 'Executar a receita escolhida, nativa ou Docker.', 'manual'),
      step('doctor', 'Rodar doctor', 'Validar se a instalacao realmente subiu.', 'verification', 'npm run integrations:doctor -- --id ollama'),
    ],
    safetyNotes: ['Modelos locais podem disputar recursos com o Zavorth.'],
    goodFor: ['Privacidade maxima', 'Soberania local', 'Uso offline'],
  },
  {
    id: 'copilot',
    label: 'Microsoft Copilot',
    aliases: ['microsoft-copilot', 'github-copilot'],
    summary: 'Receita experimental para orientar conexao com ecossistemas Copilot.',
    description: 'Ainda nao existe binding nativo de producao no Zavorth, mas o hub ja consegue guiar o onboarding.',
    supportLevel: 'experimental',
    category: 'remote',
    tags: ['copilot', 'experimental', 'browser'],
    modes: [
      mode('browser', 'Browser assistido', 'Fluxo experimental guiado por navegacao.'),
      mode('mcp', 'Conector MCP', 'Para quando houver adaptador MCP confiavel.'),
      mode('api', 'API oficial', 'Somente se existir endpoint estavel e suportado.'),
    ],
    defaultMode: 'browser',
    capabilities: ['chat', 'code', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Ainda nao existe binding nativo de producao.',
    },
    requirements: [
      req('official_access', 'Acesso oficial', 'O Zavorth so trabalha com fluxos permitidos e legitimos.', {
        type: 'account',
      }),
      req('supported_recipe', 'Receita suportada', 'Sem receita oficial a integracao fica apenas exploratoria.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Qual caminho voce quer tentar primeiro?', 'single_choice', 'Browser assistido costuma ser o caminho menos invasivo.', {
        required: false,
        choices: [
          choice('browser', 'Browser assistido', 'Util quando ha acesso, mas ainda nao existe API integrada.'),
          choice('mcp', 'Conector MCP', 'Melhor quando surgir um adaptador confiavel.'),
          choice('api', 'API oficial', 'Escolha isso apenas se voce ja souber que ela existe.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar forma de acesso', 'Identificar se a integracao sera por browser, MCP ou API.', 'guided'),
      step('recipe', 'Aplicar receita suportada', 'Seguir somente fluxos realmente suportados.', 'manual'),
      step('doctor', 'Rodar doctor', 'Avaliar se a integracao ficou pelo menos parcialmente operacional.', 'verification', 'npm run integrations:doctor -- --id copilot'),
    ],
    safetyNotes: [
      'O Zavorth nao tenta driblar CAPTCHA, 2FA ou bloqueios proprietarios.',
      'Integracao experimental: nao presuma compatibilidade total.',
    ],
    goodFor: ['Benchmark', 'Planejamento de conectores futuros'],
  },
  {
    id: 'custom-api',
    label: 'Conector customizado por API',
    aliases: ['api-template'],
    summary: 'Template para servicos com API oficial que ainda nao tem conector nativo.',
    description: 'E o caminho mais limpo para novos servicos remotos que tem documentacao propria.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'api', 'custom'],
    modes: [mode('api', 'API remota', 'Template generico para novos conectores baseados em HTTP.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'browser', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando implementacao especifica.',
    },
    requirements: [
      req('api_docs', 'Documentacao oficial', 'Sem docs confiaveis o conector nao deve ser automatizado.', {
        type: 'manual',
      }),
      req('credential', 'Credencial oficial', 'Chave, token ou OAuth legitimo do servico.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual e o nome do servico?', 'text', 'Exemplo: ZeroCloud, NanoCloud, MeuHubAI.', {
        placeholder: 'Nome do servico',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Capturar detalhes da API', 'Listar autenticacao, base URL e capacidades desejadas.', 'guided'),
      step('scaffold', 'Criar receita especifica', 'Preparar o esqueleto do conector a partir deste template.', 'manual'),
    ],
    safetyNotes: ['Este template nao cria integracao magica: ele abre um caminho limpo para um adapter real.'],
    goodFor: ['Novos servicos com API oficial', 'Conectores proprios'],
  },
  {
    id: 'custom-cli',
    label: 'Conector customizado por CLI',
    aliases: ['cli-template'],
    summary: 'Template para CLIs locais ou wrappers que o Zavorth ainda nao conhece.',
    description: 'Bom para agentes locais, ferramentas de terminal e runtimes que expÃµem uma CLI estavel.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'cli', 'local'],
    modes: [mode('cli', 'CLI local', 'Template para integracao por binario e terminal.')],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando adaptacao especifica do executor.',
    },
    requirements: [
      req('binary', 'CLI instalada ou instalavel', 'Voce precisa saber como instalar ou localizar o binario.', {
        type: 'binary',
      }),
      req('invocation_contract', 'Contrato de uso conhecido', 'Sem saber entrada e saida da CLI, o adapter fica incompleto.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual CLI voce quer conectar?', 'text', 'Exemplo: ZeroCloud CLI, MeuAssistenteLocal.', {
        placeholder: 'Nome da CLI',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Mapear a CLI', 'Capturar comando, argumentos, saida e autenticacao.', 'guided'),
      step('scaffold', 'Preparar adapter', 'Criar o esqueleto de execucao e healthcheck.', 'manual'),
    ],
    safetyNotes: ['Valide a CLI em sandbox ou workspace de teste antes de liberar em producao.'],
    goodFor: ['Agentes locais', 'Ferramentas de terminal'],
  },
  {
    id: 'custom-docker-agent',
    label: 'Conector customizado em Docker',
    aliases: ['docker-template', 'nanocloud', 'zerocloud', 'opencloud'],
    summary: 'Template para agentes e servicos que voce quer instalar em Docker antes de ligar ao Zavorth.',
    description: 'E o melhor ponto de entrada para ideias como NanoCloud, ZeroCloud e sidecars proprios.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'docker', 'agent'],
    modes: [mode('docker', 'Docker local', 'Template para servicos instalados em container.')],
    defaultMode: 'docker',
    capabilities: ['chat', 'code', 'browser', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando manifesto especifico do servico.',
    },
    requirements: [
      req('docker', 'Docker funcional', 'O host precisa rodar Docker sem erro.', { type: 'docker' }),
      req('image_recipe', 'Imagem ou compose conhecido', 'Voce precisa saber imagem, porta e variaveis do servico.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual e o nome do agente/servico?', 'text', 'Exemplo: ZeroCloud, NanoCloud, MeuAgenteDocker.', {
        placeholder: 'Nome do servico',
      }),
      question('expose_port', 'Esse servico precisa expor porta local?', 'boolean', 'Se ele expoe uma API local, o Zavorth pode monitorar depois.', {
        required: false,
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar modelo Docker', 'Identificar se e container unico, compose ou sidecar complexo.', 'guided'),
      step('scaffold', 'Gerar receita Docker', 'Preparar compose, env e doctor para esse agente.', 'manual'),
    ],
    safetyNotes: ['Nunca exponha containers sensiveis sem autenticacao e escopo claro.'],
    goodFor: ['Agentes em container', 'Novos sidecars', 'Provas de conceito locais'],
  },
];
