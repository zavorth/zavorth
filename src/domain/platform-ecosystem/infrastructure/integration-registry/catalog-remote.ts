import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './builders.js';

export const REMOTE_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'oracle-cloudflare-gemma',
    label: 'Oracle + Cloudflare + Gemma',
    aliases: ['oracle-cloudflare', 'cloudflare-gemma', 'oracle-gemma'],
    summary: 'Arquitetura remota enxuta: Zavorth na Oracle, Cloudflare na borda e Gemma via Gemini API.',
    description:
      'Receita operacional para hospedar o runtime do Zavorth em Oracle Always Free, publicar com Cloudflare Tunnel e colocar Gemini/Gemma atras do Cloudflare AI Gateway.',
    supportLevel: 'recipe',
    category: 'remote',
    tags: ['oracle', 'cloudflare', 'gemma', 'gemini', 'deployment'],
    modes: [mode('api', 'Stack remota', 'Oracle para runtime; Cloudflare para borda; Gemini/Gemma para inferencia.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'oracle-cloudflare-gemma',
      status: 'partial',
      summary: 'Receita operacional suportada pelo Zavorth com templates e doctor proprio.',
    },
    requirements: [
      req('oracle_vm', 'VM Oracle Always Free', 'Necessaria para manter o Zavorth online 24/7.', {
        type: 'account',
      }),
      req('cloudflare_tunnel', 'Cloudflare Tunnel', 'Publica o /app sem abrir o IP da Oracle.', {
        type: 'account',
      }),
      req('cloudflare_tunnel_hostname', 'Hostname do Tunnel', 'Usado para derivar a URL publica do Zavorth.', {
        type: 'env',
        envKey: 'CLOUDFLARE_TUNNEL_PUBLIC_HOSTNAME',
      }),
      req('cloudflare_ai_gateway_account', 'Cloudflare AI Gateway account id', 'Necessario para a borda do Gemini/Gemma.', {
        type: 'env',
        envKey: 'CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID',
      }),
      req('cloudflare_ai_gateway_id', 'Cloudflare AI Gateway id', 'Identificador do gateway de inferencia.', {
        type: 'env',
        envKey: 'CLOUDFLARE_AI_GATEWAY_ID',
      }),
      req('gemini_api_key', 'Chave Gemini', 'Necessaria para o Gemma hospedado via Gemini API.', {
        type: 'env',
        secret: true,
        envKey: 'GEMINI_API_KEY',
      }),
    ],
    onboardingQuestions: [
      question('stack_goal', 'Qual e o objetivo principal do stack?', 'single_choice', 'Isso ajuda a guiar o rollout inicial.', {
        required: false,
        choices: [
          choice('public-bot', 'Bot publico', 'Foco em Discord/Telegram/web para varias pessoas.'),
          choice('private-ops', 'Operacao privada', 'Foco em manter o Zavorth 24/7 para uso proprio.'),
        ],
      }),
      question('public_hostname', 'Qual hostname publico voce quer usar?', 'text', 'Exemplo: zavorth.seu-dominio.com', {
        required: false,
        placeholder: 'zavorth.seu-dominio.com',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('oracle', 'Preparar VM Oracle', 'Subir a VM e instalar Node/npm para o runtime do Zavorth.', 'manual'),
      step('systemd', 'Aplicar service do Zavorth', 'Usar o template config/deploy/zavorth-oracle.service.example.', 'manual'),
      step('tunnel', 'Configurar cloudflared', 'Usar o template config/deploy/cloudflared.oracle.example.yml.', 'manual'),
      step('gateway', 'Configurar AI Gateway', 'Criar o gateway e preencher as variaveis no .env.', 'manual'),
      step('doctor', 'Rodar doctor do rollout', 'Validar se a stack Oracle + Cloudflare + Gemma esta coerente.', 'verification', 'npm run ops:oracle-cloudflare'),
    ],
    safetyNotes: [
      'Mantenha GEMINI_API_KEY e qualquer token da Cloudflare fora de chats e fora do Git.',
      'Use Cloudflare Tunnel em vez de abrir a porta web da Oracle diretamente na internet.',
      'Nao trate Oracle Always Free como host de Gemma 4 self-hosted; a inferencia deve continuar remota.',
    ],
    goodFor: ['Zavorth 24/7 barato', 'Borda protegida', 'Gemma hospedado sem notebook forte'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini / AI Studio',
    aliases: ['google', 'aistudio', 'google-ai-studio'],
    summary: 'Conector nativo para chat, visao e pesquisa com modelos Gemini.',
    description: 'Provider ja existente no Zavorth. E um dos caminhos mais simples para comecar.',
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
      summary: 'Provider nativo ja presente no runtime.',
    },
    requirements: [
      req('gemini_api_key', 'Chave Gemini', 'Necessaria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'GEMINI_API_KEY',
      }),
      req('google_account', 'Conta Google', 'Necessaria para gerar e gerenciar a chave.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer usar o Gemini?', 'single_choice', 'API remota e o caminho padrao.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado: nao instala nada localmente.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Revisar escopo', 'Definir se voce quer chat, codigo, visao ou pesquisa.', 'guided'),
      step('configure-key', 'Adicionar a chave', 'Configurar GEMINI_API_KEY em local seguro.', 'manual', 'GEMINI_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Validar se a integracao ficou pronta.', 'verification', 'npm run integrations:doctor -- --id gemini'),
    ],
    safetyNotes: [
      'Esta integracao envia prompts e arquivos para um servico remoto.',
      'Ative visao apenas quando voce realmente precisar.',
    ],
    goodFor: ['Pesquisa', 'Analise multimodal', 'Uso geral'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    aliases: ['chatgpt'],
    summary: 'Conector nativo para modelos GPT com foco em chat, codigo e visao.',
    description: 'Usa o provider OpenAI ja embutido no Zavorth.',
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
      summary: 'Provider nativo ja presente no runtime.',
    },
    requirements: [
      req('openai_api_key', 'Chave OpenAI', 'Necessaria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENAI_API_KEY',
      }),
      req('billing', 'Billing ativo', 'Sem billing a integracao costuma falhar.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer usar a OpenAI?', 'single_choice', 'API remota e o caminho padrao.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e ja suportado.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar objetivo', 'Definir se o foco sera chat, codigo ou visao.', 'guided'),
      step('configure-key', 'Adicionar OPENAI_API_KEY', 'Sem a chave o provider nao sobe.', 'manual', 'OPENAI_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Validar se o provider ficou pronto.', 'verification', 'npm run integrations:doctor -- --id openai'),
    ],
    safetyNotes: ['Custos variam por modelo.', 'Evite enviar segredos em prompts livres sem necessidade.'],
    goodFor: ['Chat', 'Codigo', 'Visao'],
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
    summary: 'Gateway nativo para varios modelos remotos com um ponto unico de entrada.',
    description: 'Ja existe no Zavorth e e excelente para testar varios modelos com menos atrito.',
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
      summary: 'Provider nativo ja embutido.',
    },
    requirements: [
      req('openrouter_api_key', 'Chave OpenRouter', 'Necessaria para autenticacao.', {
        type: 'env',
        secret: true,
        envKey: 'OPENROUTER_API_KEY',
      }),
      req('model_strategy', 'Estrategia de modelo', 'Voce vai querer escolher um perfil padrao.', {
        type: 'manual',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer usar o OpenRouter?', 'single_choice', 'API remota e o caminho padrao.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e ja suportado.')],
      }),
      commonCapabilityQuestion,
      question('routing_goal', 'Qual sera o uso principal?', 'single_choice', 'Isso ajuda o Zavorth a sugerir um perfil.', {
        required: false,
        choices: [
          choice('balanced', 'Uso geral', 'Equilibrio entre chat, codigo e pesquisa.'),
          choice('research', 'Pesquisa', 'Mais profundidade e evidencia.'),
          choice('code', 'Codigo', 'Enetapa em revisao e implementacao.'),
        ],
      }),
    ],
    installSteps: [
      step('review', 'Escolher papel do gateway', 'Definir se ele sera principal ou complementar.', 'guided'),
      step('configure-key', 'Adicionar OPENROUTER_API_KEY', 'Sem a chave o provider nao ativa.', 'manual', 'OPENROUTER_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Confirmar se a chave e o binding estao prontos.', 'verification', 'npm run integrations:doctor -- --id openrouter'),
    ],
    safetyNotes: ['Comece com poucos modelos liberados para manter previsibilidade.'],
    goodFor: ['Comparacao de modelos', 'Roteamento flexivel', 'Pesquisa'],
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    aliases: ['open-code'],
    summary: 'Conector nativo para o provider OpenCode ja suportado pelo Zavorth.',
    description: 'Util para ampliar opcoes de provider focadas em codigo sem depender de um sidecar novo.',
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
      summary: 'Provider nativo ja disponivel.',
    },
    requirements: [
      req('opencode_api_key', 'Chave OpenCode', 'Necessaria para autenticar o provider.', {
        type: 'env',
        secret: true,
        envKey: 'OPENCODE_API_KEY',
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como voce quer usar o OpenCode?', 'single_choice', 'API remota e o caminho padrao.', {
        required: false,
        choices: [choice('api', 'API remota', 'Recomendado e ja suportado.')],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('configure-key', 'Adicionar OPENCODE_API_KEY', 'Sem a chave o provider nao ativa.', 'manual', 'OPENCODE_API_KEY=...'),
      step('doctor', 'Rodar doctor', 'Confirmar se o provider ficou pronto.', 'verification', 'npm run integrations:doctor -- --id opencode'),
    ],
    safetyNotes: ['Como toda API remota, avalie bem o tipo de dado que voce envia.'],
    goodFor: ['Codigo', 'Fallback de provider'],
  },
];
