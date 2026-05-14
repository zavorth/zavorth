import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_REMOTE_PROVIDER_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'gemini',
    label: 'Google Gemini / AI Studio',
    aliases: ['google', 'aistudio', 'google-ai-studio'],
    summary: 'Conector nativo para chat, visÃƒÂ£o e pesquisa com modelos Gemini.',
    description: 'Provider jÃƒÂ¡ existente no Zavorth. Ãƒâ€° um dos caminhos mais simples para comeÃƒÂ§ar.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'google', 'multimodal'],
    modes: [mode('api', 'API remota', 'Usa chave do Google AI Studio.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'search', 'agents'],
    binding: {
      kind: 'provider',
      key: 'gemini',
      status: 'ready',
      summary: 'Provider nativo jÃƒÂ¡ presente no runtime.',
    },
    requirements: [
      req('gemini_api_key', 'Chave Gemini', 'NecessÃƒÂ¡ria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'GEMINI_API_KEY',
      }),
      req('google_account', 'Conta Google', 'NecessÃƒÂ¡ria para gerar e gerenciar a chave.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÂª quer usar o Gemini?', 'single_choice', 'API remota ÃƒÂ© o caminho padrÃƒÂ£o.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado: nÃƒÂ£o instala nada localmente.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Revisar escopo', 'Definir se vocÃƒÂª quer chat, cÃƒÂ³digo, visÃƒÂ£o ou pesquisa.', 'guided'),
      step('configure-key', 'Adicionar a chave', 'Configurar GEMINI_API_KEY em local seguro.', 'manual', 'GEMINI_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Validar se a integraÃƒÂ§ÃƒÂ£o ficou pronta.', 'verification', 'npm run integrations:doctor -- --id gemini'),
    ],
    safetyNotes: [
      'Esta integraÃƒÂ§ÃƒÂ£o envia prompts e arquivos para um serviÃƒÂ§o remoto.',
      'Ative visÃƒÂ£o apenas quando vocÃƒÂª realmente precisar.',
    ],
    goodFor: ['Pesquisa', 'AnÃƒÂ¡lise multimodal', 'Uso geral'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    aliases: ['chatgpt'],
    summary: 'Conector nativo para modelos GPT com foco em chat, cÃƒÂ³digo e visÃƒÂ£o.',
    description: 'Usa o provider OpenAI jÃƒÂ¡ embutido no Zavorth.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'openai', 'vision'],
    modes: [mode('api', 'API remota', 'Usa OPENAI_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents'],
    binding: {
      kind: 'provider',
      key: 'openai',
      status: 'ready',
      summary: 'Provider nativo jÃƒÂ¡ presente no runtime.',
    },
    requirements: [
      req('openai_api_key', 'Chave OpenAI', 'NecessÃƒÂ¡ria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENAI_API_KEY',
      }),
      req('billing', 'Billing ativo', 'Sem billing a integraÃƒÂ§ÃƒÂ£o costuma falhar.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÂª quer usar a OpenAI?', 'single_choice', 'API remota ÃƒÂ© o caminho padrÃƒÂ£o.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e jÃƒÂ¡ suportado.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar objetivo', 'Definir se o foco serÃƒÂ¡ chat, cÃƒÂ³digo ou visÃƒÂ£o.', 'guided'),
      step('configure-key', 'Adicionar OPENAI_API_KEY', 'Sem a chave o provider nÃƒÂ£o sobe.', 'manual', 'OPENAI_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Validar se o provider ficou pronto.', 'verification', 'npm run integrations:doctor -- --id openai'),
    ],
    safetyNotes: ['Custos variam por modelo.', 'Evite enviar segredos em prompts livres sem necessidade.'],
    goodFor: ['Chat', 'CÃƒÂ³digo', 'VisÃƒÂ£o'],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    aliases: ['minimax-direct', 'minimax-api'],
    summary: 'Conector nativo direto para a API OpenAI-compatible do MiniMax.',
    description: 'Permite usar MiniMax sem depender do OpenRouter, mantendo o provider principal padrao intacto.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'minimax', 'coding', 'agents'],
    modes: [mode('api', 'API remota', 'Usa MINIMAX_API_KEY com endpoint OpenAI-compatible.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents'],
    binding: {
      kind: 'provider',
      key: 'minimax',
      status: 'ready',
      summary: 'Provider nativo opcional para MiniMax direto.',
    },
    requirements: [
      req('minimax_api_key', 'Chave MiniMax', 'Necessaria para autenticar o provider direto.', {
        type: 'env',
        secret: true,
        envKey: 'MINIMAX_API_KEY',
      }),
      req('minimax_model', 'Modelo MiniMax', 'O padrao recomendado e MiniMax-M2.7.', {
        type: 'manual',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer usar o MiniMax?', 'single_choice', 'API remota direta e o caminho suportado hoje.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado para usar MiniMax sem OpenRouter.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Definir papel do MiniMax', 'Escolher se ele sera complementar ou provider principal em momentos especificos.', 'guided'),
      step('configure-key', 'Adicionar MINIMAX_API_KEY', 'Sem a chave o provider direto nao ativa.', 'manual', 'MINIMAX_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Confirmar se a chave e o binding ficaram prontos.', 'verification', 'npm run integrations:doctor -- --id minimax'),
    ],
    safetyNotes: ['Use MiniMax direto quando quiser reduzir dependencia de gateways intermediarios.'],
    goodFor: ['Coding', 'Agentic tasks', 'Uso direto sem OpenRouter'],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    aliases: ['router'],
    summary: 'Gateway nativo para vÃƒÂ¡rios modelos remotos com um ponto ÃƒÂºnico de entrada.',
    description: 'JÃƒÂ¡ existe no Zavorth e ÃƒÂ© excelente para testar vÃƒÂ¡rios modelos com menos atrito.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'gateway', 'routing'],
    modes: [mode('api', 'API remota', 'Usa OPENROUTER_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'agents', 'search'],
    binding: {
      kind: 'provider',
      key: 'openrouter',
      status: 'ready',
      summary: 'Provider nativo jÃƒÂ¡ embutido.',
    },
    requirements: [
      req('openrouter_api_key', 'Chave OpenRouter', 'NecessÃƒÂ¡ria para autenticaÃƒÂ§ÃƒÂ£o.', {
        type: 'env',
        secret: true,
        envKey: 'OPENROUTER_API_KEY',
      }),
      req('model_strategy', 'EstratÃƒÂ©gia de modelo', 'VocÃƒÂª vai querer escolher um perfil padrÃƒÂ£o.', {
        type: 'manual',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÂª quer usar o OpenRouter?', 'single_choice', 'API remota ÃƒÂ© o caminho padrÃƒÂ£o.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e jÃƒÂ¡ suportado.')],
      }),
      commonCapabilityQuestion,
      question('routing_goal', 'Qual serÃƒÂ¡ o uso principal?', 'single_choice', 'Isso ajuda o Zavorth a sugerir um perfil.', {
        required: false,
        choices: [
          choice('balanced', 'Uso geral', 'EquilÃƒÂ­brio entre chat, cÃƒÂ³digo e pesquisa.'),
          choice('research', 'Pesquisa', 'Mais profundidade e evidÃƒÂªncia.'),
          choice('code', 'CÃƒÂ³digo', 'ÃƒÅ nfase em revisÃƒÂ£o e implementaÃƒÂ§ÃƒÂ£o.'),
        ],
      }),
    ],
    installSteps: [
      step('review', 'Escolher papel do gateway', 'Definir se ele serÃƒÂ¡ principal ou complementar.', 'guided'),
      step('configure-key', 'Adicionar OPENROUTER_API_KEY', 'Sem a chave o provider nÃƒÂ£o ativa.', 'manual', 'OPENROUTER_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Confirmar se a chave e o binding estÃƒÂ£o prontos.', 'verification', 'npm run integrations:doctor -- --id openrouter'),
    ],
    safetyNotes: ['Comece com poucos modelos liberados para manter previsibilidade.'],
    goodFor: ['ComparaÃƒÂ§ÃƒÂ£o de modelos', 'Roteamento flexÃƒÂ­vel', 'Pesquisa'],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    aliases: ['open-code'],
    summary: 'Conector nativo para o provider OpenCode jÃƒÂ¡ suportado pelo Zavorth.',
    description: 'ÃƒÅ¡til para ampliar opÃƒÂ§ÃƒÂµes de provider focadas em cÃƒÂ³digo sem depender de um sidecar novo.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['provider', 'code', 'api'],
    modes: [mode('api', 'API remota', 'Usa OPENCODE_API_KEY.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'agents'],
    binding: {
      kind: 'provider',
      key: 'opencode',
      status: 'ready',
      summary: 'Provider nativo jÃƒÂ¡ disponÃƒÂ­vel.',
    },
    requirements: [
      req('opencode_api_key', 'Chave OpenCode', 'NecessÃƒÂ¡ria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENCODE_API_KEY',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÂª quer usar o OpenCode?', 'single_choice', 'API remota ÃƒÂ© o caminho padrÃƒÂ£o.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e jÃƒÂ¡ suportado.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('configure-key', 'Adicionar OPENCODE_API_KEY', 'Sem a chave o provider nÃƒÂ£o ativa.', 'manual', 'OPENCODE_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Confirmar se o provider ficou pronto.', 'verification', 'npm run integrations:doctor -- --id opencode'),
    ],
    safetyNotes: ['Como toda API remota, avalie bem o tipo de dado que vocÃƒÂª envia.'],
    goodFor: ['CÃƒÂ³digo', 'Fallback de provider'],
  },
  {
    id: 'copilot',
    label: 'Microsoft Copilot',
    aliases: ['microsoft-copilot', 'github-copilot'],
    summary: 'Receita experimental para orientar conexÃƒÂ£o com ecossistemas Copilot.',
    description: 'Ainda nÃƒÂ£o existe binding nativo de produÃƒÂ§ÃƒÂ£o no Zavorth, mas o hub jÃƒÂ¡ consegue guiar o onboarding.',
    supportLevel: 'experimental',
    category: 'remote',
    tags: ['copilot', 'experimental', 'browser'],
    modes: [
      mode('browser', 'Browser assistido', 'Fluxo experimental guiado por navegaÃƒÂ§ÃƒÂ£o.'),
      mode('mcp', 'Conector MCP', 'Para quando houver adaptador MCP confiÃƒÂ¡vel.'),
      mode('api', 'API oficial', 'Somente se existir endpoint estÃƒÂ¡vel e suportado.'),
    ],
    defaultMode: 'browser',
    capabilities: ['chat', 'code', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Ainda nÃƒÂ£o existe binding nativo de produÃƒÂ§ÃƒÂ£o.',
    },
    requirements: [
      req('official_access', 'Acesso oficial', 'O Zavorth sÃƒÂ³ trabalha com fluxos permitidos e legÃƒÂ­timos.', {
        type: 'account',
      }),
      req('supported_recipe', 'Receita suportada', 'Sem receita oficial a integraÃƒÂ§ÃƒÂ£o fica apenas exploratÃƒÂ³ria.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Qual caminho vocÃƒÂª quer tentar primeiro?', 'single_choice', 'Browser assistido costuma ser o caminho menos invasivo.', {
        required: false,
        choices: [
          choice('browser', 'Browser assistido', 'ÃƒÅ¡til quando hÃƒÂ¡ acesso, mas ainda nÃƒÂ£o existe API integrada.'),
          choice('mcp', 'Conector MCP', 'Melhor quando surgir um adaptador confiÃƒÂ¡vel.'),
          choice('api', 'API oficial', 'Escolha isso apenas se vocÃƒÂª jÃƒÂ¡ souber que ela existe.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar forma de acesso', 'Identificar se a integraÃƒÂ§ÃƒÂ£o serÃƒÂ¡ por browser, MCP ou API.', 'guided'),
      step('recipe', 'Aplicar receita suportada', 'Seguir somente fluxos realmente suportados.', 'manual'),
      step('doctor', 'Rodar doctor', 'Avaliar se a integraÃƒÂ§ÃƒÂ£o ficou pelo menos parcialmente operacional.', 'verification', 'npm run integrations:doctor -- --id copilot'),
    ],
    safetyNotes: [
      'O Zavorth nÃƒÂ£o tenta driblar CAPTCHA, 2FA ou bloqueios proprietÃƒÂ¡rios.',
      'IntegraÃƒÂ§ÃƒÂ£o experimental: nÃƒÂ£o presuma compatibilidade total.',
    ],
    goodFor: ['Benchmark', 'Planejamento de conectores futuros'],
  },
];
