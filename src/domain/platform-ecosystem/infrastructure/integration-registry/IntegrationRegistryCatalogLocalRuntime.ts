import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { capabilityChoices, commonCapabilityQuestion, choice, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_LOCAL_RUNTIME_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'AIGateway',
    label: 'AIGateway',
    aliases: ['omni-route'],
    summary: 'Gateway local-first jÃƒÆ’Ã‚Â¡ integrado ao Zavorth.',
    description: 'Funciona como sidecar local e conversa diretamente com o runtime do Zavorth.',
    supportLevel: 'native',
    category: 'local',
    tags: ['provider', 'sidecar', 'local-first'],
    modes: [
      mode('cli', 'Worktree local', 'Usa o sidecar jÃƒÆ’Ã‚Â¡ vendorado no Zavorth.', true),
      mode('docker', 'Container local', 'Alternativa futura para mais isolamento.', false),
    ],
    defaultMode: 'cli',
    capabilities: ['chat', 'code', 'agents', 'automation'],
    binding: {
      kind: 'provider',
      key: 'AIGateway',
      status: 'ready',
      summary: 'Provider e sidecar jÃƒÆ’Ã‚Â¡ suportados.',
    },
    requirements: [
      req('vendor', 'Vendor AIGateway presente', 'O worktree local do sidecar precisa existir.', {
        type: 'binary',
      }),
      req('upstream_key', 'Credencial upstream', 'Dependendo da sua configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, o gateway pode precisar de uma chave por trÃƒÆ’Ã‚Â¡s.', {
        type: 'env',
        secret: true,
        envKey: 'AIGateway_API_KEY',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÆ’Ã‚Âª quer rodar o AIGateway?', 'single_choice', 'O worktree local ÃƒÆ’Ã‚Â© o fluxo jÃƒÆ’Ã‚Â¡ dominado pelo Zavorth.', {
        required: false,
        choices: [
          choice('cli', 'Worktree local', 'Recomendado: usa o sidecar atual.'),
          choice('docker', 'Container local', 'Planejado para mais isolamento.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Verificar sidecar', 'Confirmar se o sidecar jÃƒÆ’Ã‚Â¡ existe e se precisa ficar quente.', 'guided'),
      step('bootstrap', 'Checar sidecar', 'Validar dependÃƒÆ’Ã‚Âªncias e estado do sidecar.', 'verification', 'npm run sidecars:status'),
      step('doctor', 'Rodar doctor', 'Confirmar se o gateway estÃƒÆ’Ã‚Â¡ roteÃƒÆ’Ã‚Â¡vel.', 'verification', 'npm run integrations:doctor -- --id AIGateway'),
    ],
    safetyNotes: ['Como ÃƒÆ’Ã‚Â© local-first, preserva melhor soberania e latÃƒÆ’Ã‚Âªncia.'],
    goodFor: ['Gateway principal', 'Baixa latÃƒÆ’Ã‚Âªncia', 'Soberania local'],
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
    aliases: ['external-runner', 'local-agent-bridge', 'agent-bridge'],
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
  },  {
    id: 'ollama',
    label: 'Ollama',
    aliases: ['local-llm'],
    summary: 'Receita local para rodar modelos no prÃƒÆ’Ã‚Â³prio host com foco em soberania.',
    description: 'O Zavorth ainda nÃƒÆ’Ã‚Â£o tem provider Ollama nativo, mas jÃƒÆ’Ã‚Â¡ consegue orientar instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e healthcheck.',
    supportLevel: 'recipe',
    category: 'local',
    tags: ['local', 'privacy', 'recipe'],
    modes: [
      mode('docker', 'Docker local', 'Recomendado para comeÃƒÆ’Ã‚Â§ar com mais isolamento.'),
      mode('cli', 'InstalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nativa', 'Bom quando vocÃƒÆ’Ã‚Âª quer controle total do host.'),
    ],
    defaultMode: 'docker',
    capabilities: ['chat', 'code'],
    binding: {
      kind: 'planned',
      key: null,
      status: 'planned',
      summary: 'A receita ÃƒÆ’Ã‚Â© suportada, mas o binding automÃƒÆ’Ã‚Â¡tico ainda ÃƒÆ’Ã‚Â© planejado.',
    },
    requirements: [
      req('host_resources', 'Recursos do host', 'Modelos locais podem consumir muita RAM, CPU e disco.', {
        type: 'manual',
      }),
      req('docker_optional', 'Docker funcional', 'NecessÃƒÆ’Ã‚Â¡rio apenas se vocÃƒÆ’Ã‚Âª escolher o modo container.', {
        type: 'docker',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('install_mode', 'Como vocÃƒÆ’Ã‚Âª quer instalar o Ollama?', 'single_choice', 'Docker tende a ser mais previsÃƒÆ’Ã‚Â­vel para comeÃƒÆ’Ã‚Â§ar.', {
        required: false,
        choices: [
          choice('docker', 'Docker local', 'Recomendado para mais isolamento.'),
          choice('cli', 'InstalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nativa', 'Quando vocÃƒÆ’Ã‚Âª quer controle total do host.'),
        ],
      }),
      question('model_family', 'Que perfil de modelo local vocÃƒÆ’Ã‚Âª quer primeiro?', 'single_choice', 'Isso ajuda a estimar requisito de mÃƒÆ’Ã‚Â¡quina.', {
        required: false,
        choices: [
          choice('small', 'Leve', 'Mais simples para hosts modestos.'),
          choice('coding', 'CÃƒÆ’Ã‚Â³digo', 'Melhor para revisÃƒÆ’Ã‚Â£o e implementaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o locais.'),
          choice('general', 'Uso geral', 'EquilÃƒÆ’Ã‚Â­brio entre chat e raciocÃƒÆ’Ã‚Â­nio.'),
        ],
      }),
      commonCapabilityQuestion,
    ],
    installSteps: [
      step('review', 'Revisar capacidade do host', 'Confirmar se o host aguenta um LLM local sem atrapalhar o restante.', 'guided'),
      step('install', 'Instalar Ollama', 'Executar a receita escolhida, nativa ou Docker.', 'manual'),
      step('doctor', 'Rodar doctor', 'Validar se a instalaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o realmente subiu.', 'verification', 'npm run integrations:doctor -- --id ollama'),
    ],
    safetyNotes: ['Modelos locais podem disputar recursos com o Zavorth.'],
    goodFor: ['Privacidade mÃƒÆ’Ã‚Â¡xima', 'Soberania local', 'Uso offline'],
  },
];
