import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_TEMPLATE_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'custom-api',
    label: 'Conector customizado por API',
    aliases: ['api-template'],
    summary: 'Template para serviÃƒÂ§os com API oficial que ainda nÃƒÂ£o tÃƒÂªm conector nativo.',
    description: 'Ãƒâ€° o caminho mais limpo para novos serviÃƒÂ§os remotos que tÃƒÂªm documentaÃƒÂ§ÃƒÂ£o prÃƒÂ³pria.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'api', 'custom'],
    modes: [mode('api', 'API remota', 'Template genÃƒÂ©rico para novos conectores baseados em HTTP.')],
    defaultMode: 'api',
    capabilities: ['chat', 'code', 'vision', 'browser', 'agents'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando implementaÃƒÂ§ÃƒÂ£o especÃƒÂ­fica.',
    },
    requirements: [
      req('api_docs', 'DocumentaÃƒÂ§ÃƒÂ£o oficial', 'Sem docs confiÃƒÂ¡veis o conector nÃƒÂ£o deve ser automatizado.', {
        type: 'manual',
      }),
      req('credential', 'Credencial oficial', 'Chave, token ou OAuth legÃƒÂ­timo do serviÃƒÂ§o.', {
        type: 'account',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual ÃƒÂ© o nome do serviÃƒÂ§o?', 'text', 'Exemplo: ZeroCloud, NanoCloud, MeuHubAI.', {
        placeholder: 'Nome do serviÃƒÂ§o',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Capturar detalhes da API', 'Listar autenticaÃƒÂ§ÃƒÂ£o, base URL e capacidades desejadas.', 'guided'),
      step('scaffold', 'Criar receita especÃƒÂ­fica', 'Preparar o esqueleto do conector a partir deste template.', 'manual'),
    ],
    safetyNotes: ['Este template nÃƒÂ£o cria integraÃƒÂ§ÃƒÂ£o mÃƒÂ¡gica: ele abre um caminho limpo para um adapter real.'],
    goodFor: ['Novos serviÃƒÂ§os com API oficial', 'Conectores prÃƒÂ³prios'],
  },
  {
    id: 'custom-cli',
    label: 'Conector customizado por CLI',
    aliases: ['cli-template'],
    summary: 'Template para CLIs locais ou wrappers que o Zavorth ainda nÃƒÂ£o conhece.',
    description: 'Bom para agentes locais, ferramentas de terminal e runtimes que expÃƒÂµem uma CLI estÃƒÂ¡vel.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'cli', 'local'],
    modes: [mode('cli', 'CLI local', 'Template para integraÃƒÂ§ÃƒÂ£o por binÃƒÂ¡rio e terminal.')],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando adaptaÃƒÂ§ÃƒÂ£o especÃƒÂ­fica do executor.',
    },
    requirements: [
      req('binary', 'CLI instalada ou instalÃƒÂ¡vel', 'VocÃƒÂª precisa saber como instalar ou localizar o binÃƒÂ¡rio.', {
        type: 'binary',
      }),
      req('invocation_contract', 'Contrato de uso conhecido', 'Sem saber entrada e saÃƒÂ­da da CLI, o adapter fica incompleto.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual CLI vocÃƒÂª quer conectar?', 'text', 'Exemplo: ZeroCloud CLI, MeuAssistenteLocal.', {
        placeholder: 'Nome da CLI',
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Mapear a CLI', 'Capturar comando, argumentos, saÃƒÂ­da e autenticaÃƒÂ§ÃƒÂ£o.', 'guided'),
      step('scaffold', 'Preparar adapter', 'Criar o esqueleto de execuÃƒÂ§ÃƒÂ£o e healthcheck.', 'manual'),
    ],
    safetyNotes: ['Valide a CLI em sandbox ou workspace de teste antes de liberar em produÃƒÂ§ÃƒÂ£o.'],
    goodFor: ['Agentes locais', 'Ferramentas de terminal'],
  },
  {
    id: 'custom-docker-agent',
    label: 'Conector customizado em Docker',
    aliases: ['docker-template', 'nanocloud', 'zerocloud', 'opencloud'],
    summary: 'Template para agentes e serviÃƒÂ§os que vocÃƒÂª quer instalar em Docker antes de ligar ao Zavorth.',
    description: 'Ãƒâ€° o melhor ponto de entrada para ideias como NanoCloud, ZeroCloud e sidecars prÃƒÂ³prios.',
    supportLevel: 'template',
    category: 'template',
    tags: ['template', 'docker', 'agent'],
    modes: [mode('docker', 'Docker local', 'Template para serviÃƒÂ§os instalados em container.')],
    defaultMode: 'docker',
    capabilities: ['chat', 'code', 'browser', 'agents', 'automation'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'Template aguardando manifesto especÃƒÂ­fico do serviÃƒÂ§o.',
    },
    requirements: [
      req('docker', 'Docker funcional', 'O host precisa rodar Docker sem erro.', { type: 'docker' }),
      req('image_recipe', 'Imagem ou compose conhecido', 'VocÃƒÂª precisa saber imagem, porta e variÃƒÂ¡veis do serviÃƒÂ§o.', {
        type: 'manual',
      }),
    ],
    onboardingQuestions: [
      question('service_name', 'Qual ÃƒÂ© o nome do agente/serviÃƒÂ§o?', 'text', 'Exemplo: ZeroCloud, NanoCloud, MeuAgenteDocker.', {
        placeholder: 'Nome do serviÃƒÂ§o',
      }),
      question('expose_port', 'Esse serviÃƒÂ§o precisa expor porta local?', 'boolean', 'Se ele expÃƒÂµe uma API local, o Zavorth pode monitorar depois.', {
        required: false,
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Confirmar modelo Docker', 'Identificar se ÃƒÂ© container ÃƒÂºnico, compose ou sidecar complexo.', 'guided'),
      step('scaffold', 'Gerar receita Docker', 'Preparar compose, env e doctor para esse agente.', 'manual'),
    ],
    safetyNotes: ['Nunca exponha containers sensÃƒÂ­veis sem autenticaÃƒÂ§ÃƒÂ£o e escopo claro.'],
    goodFor: ['Agentes em container', 'Novos sidecars', 'Provas de conceito locais'],
  },
];
