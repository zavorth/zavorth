import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './builders.js';

export const CHANNEL_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    aliases: ['telegram-bot', 'botfather'],
    summary: 'Canal nativo leve para conversar, retomar fluxos e aprovar operacoes pelo Bot API.',
    description: 'Usa o gateway nativo do Telegram do Zavorth com bot token e allowlist de operadores.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'telegram', 'bot', 'operator'],
    modes: [mode('api', 'Bot API', 'Usa token do @BotFather e operadores allowlisted.')],
    defaultMode: 'api',
    capabilities: ['chat', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'telegram',
      status: 'ready',
      summary: 'Gateway nativo pronto quando TELEGRAM_BOT_TOKEN e operadores existem.',
    },
    requirements: [
      req('telegram_bot_token', 'Telegram bot token', 'Token criado via @BotFather.', {
        type: 'env',
        secret: true,
        envKey: 'TELEGRAM_BOT_TOKEN',
      }),
      req('telegram_allowed_user_ids', 'Operadores permitidos', 'User ids autorizados a operar o Zavorth no Telegram.', {
        type: 'env',
        envKey: 'TELEGRAM_ALLOWED_USER_IDS',
      }),
      req('telegram_user_roles', 'Roles por operador', 'Mapa opcional de roles por user id.', {
        type: 'env',
        envKey: 'TELEGRAM_USER_ROLES',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('telegram_bot_token', 'Qual e o token do bot do Telegram?', 'secret', 'Crie o bot via @BotFather e cole o token aqui.'),
      question(
        'telegram_allowed_user_ids',
        'Quais user ids vao operar esse bot?',
        'text',
        'Separe por virgula. Exemplo: 123456789,987654321.',
        {
          placeholder: '123456789,987654321',
        },
      ),
      question(
        'telegram_user_roles',
        'Quer registrar roles por operador?',
        'text',
        'Opcional. Exemplo: 123:admin|operator;456:viewer',
        {
          required: false,
          placeholder: '123:admin|operator;456:viewer',
        },
      ),
    ],
    installSteps: [
      step('botfather', 'Criar ou revisar o bot', 'Confirmar o bot no @BotFather e copiar o token correto.', 'manual'),
      step('operators', 'Definir operadores', 'Escolher quem pode operar o Zavorth pelo Telegram.', 'guided'),
      step('doctor', 'Rodar doctor do canal', 'Validar o canal nativo do Telegram.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Restrinja sempre TELEGRAM_ALLOWED_USER_IDS antes de expor o bot.',
      'Nao compartilhe o token do bot fora do .env local ou do secret manager.',
    ],
    goodFor: ['Retomadas rapidas', 'Approvals', 'Operacao leve no celular'],
  },
  {
    id: 'discord',
    label: 'Discord',
    aliases: ['discord-bot', 'discord-gateway'],
    summary: 'Canal nativo para operar o Zavorth em guilds privadas ou rollout publico controlado.',
    description: 'Usa o gateway nativo do Discord do Zavorth com policy conservadora, owners e exposicao controlada.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'discord', 'guild', 'operator'],
    modes: [mode('api', 'Discord API', 'Usa bot token e policy explicita por guild/owner.')],
    defaultMode: 'api',
    capabilities: ['chat', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'discord',
      status: 'ready',
      summary: 'Gateway nativo pronto quando o bot token e a policy basica estao definidas.',
    },
    requirements: [
      req('discord_bot_token', 'Discord bot token', 'Token do bot para o gateway nativo.', {
        type: 'env',
        secret: true,
        envKey: 'DISCORD_BOT_TOKEN',
      }),
      req('discord_allowed_guild_ids', 'Guilds permitidas', 'Guilds autorizadas para rollout privado.', {
        type: 'env',
        envKey: 'DISCORD_ALLOWED_GUILD_IDS',
        required: false,
      }),
      req('discord_owner_user_ids', 'Owners permitidos', 'Owners do canal oficial do Discord.', {
        type: 'env',
        envKey: 'DISCORD_OWNER_USER_IDS',
        required: false,
      }),
      req('discord_public_server_mode', 'Modo publico', 'Ativa rollout publico controlado no Discord.', {
        type: 'env',
        envKey: 'DISCORD_PUBLIC_SERVER_MODE',
        required: false,
      }),
      req('discord_command_exposure', 'Exposicao de comandos', 'Define o nivel de comandos expostos no Discord.', {
        type: 'env',
        envKey: 'DISCORD_COMMAND_EXPOSURE',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('discord_bot_token', 'Qual e o token do bot do Discord?', 'secret', 'Cole o bot token do canal oficial do Discord.'),
      question(
        'discord_allowed_guild_ids',
        'Quais guild ids vao entrar primeiro?',
        'text',
        'Opcional, mas recomendado para rollout privado. Separe por virgula.',
        {
          required: false,
          placeholder: '123456789012345678,987654321098765432',
        },
      ),
      question(
        'discord_owner_user_ids',
        'Quais owners podem operar comandos sensiveis?',
        'text',
        'Opcional, mas recomendado fora do modo publico. Separe por virgula.',
        {
          required: false,
          placeholder: '123456789012345678',
        },
      ),
      question(
        'discord_public_server_mode',
        'Esse bot vai entrar primeiro em servidor publico?',
        'boolean',
        'Se true, o Zavorth aplica guardrails mais conservadores por padrao.',
        {
          required: false,
        },
      ),
      question(
        'discord_command_exposure',
        'Qual exposicao de comandos voce quer usar no Discord?',
        'single_choice',
        'Minimal e a escolha mais segura para rollout inicial.',
        {
          required: false,
          choices: [
            choice('none', 'Nenhuma', 'Nao expor slash commands por enquanto.'),
            choice('minimal', 'Minimal', 'Expor so comandos basicos e seguros.'),
            choice('operator', 'Operator', 'Expande comandos operacionais para operadores.'),
          ],
        },
      ),
    ],
    installSteps: [
      step('bot', 'Preparar o bot no Discord', 'Criar o bot, revisar intents e copiar o token.', 'manual'),
      step('policy', 'Definir a policy inicial', 'Escolher guilds, owners e exposicao de comandos.', 'guided'),
      step('doctor', 'Rodar doctor do canal', 'Validar o canal nativo do Discord.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Evite rollout sem allowlist ou com exposicao operator cedo demais.',
      'Use minimal como exposicao inicial em servidores compartilhados.',
    ],
    goodFor: ['Equipe interna', 'Servidor privado', 'Rollout publico controlado'],
  },
  {
    id: 'slack',
    label: 'Slack',
    aliases: ['slack-native', 'slack-channel'],
    summary: 'Canal para rollout em modo stub local ou em modo native com Web API e webhook oficial.',
    description: 'O Zavorth suporta Slack em modo stub para testes locais e em modo native para outbound/webhook reais.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'slack', 'workspace', 'stub'],
    modes: [mode('api', 'Slack Web API', 'Usa Slack native ou stub local conforme o transporte escolhido.')],
    defaultMode: 'api',
    capabilities: ['chat', 'automation'],
    binding: {
      kind: 'service',
      key: 'slack',
      status: 'ready',
      summary: 'Slack entra no runtime por transport stub ou native, com doctor honesto nos dois caminhos.',
    },
    requirements: [
      req('slack_enabled', 'Slack habilitado', 'Ativa o canal Slack no runtime.', {
        type: 'env',
        envKey: 'SLACK_ENABLED',
      }),
      req('slack_transport', 'Transporte do Slack', 'Define se o canal usa stub local ou native.', {
        type: 'env',
        envKey: 'SLACK_TRANSPORT',
      }),
      req('slack_bot_token', 'Slack bot token', 'Obrigatorio quando o transporte for native.', {
        type: 'env',
        secret: true,
        envKey: 'SLACK_BOT_TOKEN',
        required: false,
      }),
      req('slack_signing_secret', 'Slack signing secret', 'Obrigatorio quando o transporte for native.', {
        type: 'env',
        secret: true,
        envKey: 'SLACK_SIGNING_SECRET',
        required: false,
      }),
      req('slack_workspace_id', 'Workspace alvo', 'Workspace usado pelo stub local ou pelo rollout native.', {
        type: 'env',
        envKey: 'SLACK_WORKSPACE_ID',
        required: false,
      }),
      req('slack_allowed_channel_ids', 'Canais permitidos', 'Canal ou canais permitidos para o rollout do Slack.', {
        type: 'env',
        envKey: 'SLACK_ALLOWED_CHANNEL_IDS',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('slack_enabled', 'Quer habilitar o canal Slack neste host?', 'boolean', 'O wizard marca true automaticamente quando voce escolhe configurar o Slack.', {
        required: false,
      }),
      question(
        'slack_transport',
        'Qual transporte do Slack voce quer usar primeiro?',
        'single_choice',
        'Stub e ideal para preparar o host sem depender da Slack Web API logo de cara.',
        {
          choices: [
            choice('stub', 'Stub local', 'Prepara outbox local e doctor honesto sem webhook real.'),
            choice('native', 'Native', 'Usa Slack Web API e webhook real quando tokens existirem.'),
          ],
        },
      ),
      question('slack_workspace_id', 'Qual workspace do Slack sera o alvo?', 'text', 'Opcional no stub; util para identificar o alvo do rollout.', {
        required: false,
        placeholder: 'T12345678',
      }),
      question('slack_allowed_channel_ids', 'Quais canais vao entrar primeiro?', 'text', 'Opcional no stub; recomendado no native. Separe por virgula.', {
        required: false,
        placeholder: 'C12345678,C98765432',
      }),
      question('slack_bot_token', 'Qual e o bot token do Slack?', 'secret', 'Preencha quando quiser usar o transporte native.', {
        required: false,
      }),
      question('slack_signing_secret', 'Qual e o signing secret do Slack?', 'secret', 'Preencha quando quiser validar webhook nativo.', {
        required: false,
      }),
    ],
    installSteps: [
      step('transport', 'Escolher o transporte', 'Decidir entre stub local e rollout native.', 'guided'),
      step('credentials', 'Adicionar credenciais do Slack', 'Preencher bot token e signing secret quando o transporte for native.', 'manual'),
      step('doctor', 'Rodar doctor do canal', 'Validar Slack stub/native no host atual.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Use stub para preparar o host antes de abrir webhook real.',
      'No modo native, mantenha allowlist de canais desde o primeiro rollout.',
    ],
    goodFor: ['Equipe interna', 'Smoke local', 'Rollout progressivo de canal'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    aliases: ['whatsapp-cloud-api', 'whatsapp-baileys'],
    summary: 'Canal com rollout por stub local, Cloud API oficial ou provider Baileys.',
    description: 'O Zavorth consegue preparar o WhatsApp em modo stub, Cloud API ou Baileys, com doctor honesto para cada provider.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'whatsapp', 'cloud-api', 'baileys', 'stub'],
    modes: [mode('api', 'Provider do WhatsApp', 'Usa stub, Cloud API ou Baileys conforme o provider escolhido.')],
    defaultMode: 'api',
    capabilities: ['chat', 'automation'],
    binding: {
      kind: 'service',
      key: 'whatsapp',
      status: 'ready',
      summary: 'WhatsApp entra no runtime por stub, Cloud API ou Baileys, com doctor honesto em cada caminho.',
    },
    requirements: [
      req('whatsapp_enabled', 'WhatsApp habilitado', 'Ativa o canal WhatsApp no runtime.', {
        type: 'env',
        envKey: 'WHATSAPP_ENABLED',
      }),
      req('whatsapp_provider', 'Provider do WhatsApp', 'Define o provider ativo: stub, cloud-api ou baileys.', {
        type: 'env',
        envKey: 'WHATSAPP_PROVIDER',
      }),
      req('whatsapp_allowed_chat_ids', 'Chats permitidos', 'Chats ou grupos permitidos para rollout operacional.', {
        type: 'env',
        envKey: 'WHATSAPP_ALLOWED_CHAT_IDS',
        required: false,
      }),
      req('whatsapp_phone_number_id', 'Phone number id', 'Obrigatorio quando o provider for Cloud API.', {
        type: 'env',
        envKey: 'WHATSAPP_PHONE_NUMBER_ID',
        required: false,
      }),
      req('whatsapp_access_token', 'Access token', 'Obrigatorio quando o provider for Cloud API.', {
        type: 'env',
        secret: true,
        envKey: 'WHATSAPP_ACCESS_TOKEN',
        required: false,
      }),
      req('whatsapp_webhook_verify_token', 'Webhook verify token', 'Obrigatorio quando o provider for Cloud API.', {
        type: 'env',
        secret: true,
        envKey: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        required: false,
      }),
      req('whatsapp_session_dir', 'Sessao persistente', 'Obrigatorio quando o provider for Baileys.', {
        type: 'env',
        envKey: 'WHATSAPP_SESSION_DIR',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('whatsapp_enabled', 'Quer habilitar o canal WhatsApp neste host?', 'boolean', 'O wizard marca true automaticamente quando voce escolhe configurar o WhatsApp.', {
        required: false,
      }),
      question(
        'whatsapp_provider',
        'Qual provider do WhatsApp voce quer usar primeiro?',
        'single_choice',
        'Stub e o caminho mais rapido para preparar o host; Cloud API e o caminho oficial; Baileys continua local.',
        {
          choices: [
            choice('stub', 'Stub local', 'Prepara o host sem depender de credencial externa logo de cara.'),
            choice('cloud-api', 'Cloud API', 'Usa webhook e outbound reais da Meta/WhatsApp Cloud API.'),
            choice('baileys', 'Baileys', 'Usa provider local com sessao persistente.'),
          ],
        },
      ),
      question('whatsapp_allowed_chat_ids', 'Quais chats vao entrar primeiro?', 'text', 'Opcional no stub; recomendado quando houver rollout real. Separe por virgula.', {
        required: false,
        placeholder: '5511999999999,grupo-operacoes',
      }),
      question('whatsapp_phone_number_id', 'Qual e o phone number id da Cloud API?', 'text', 'Preencha quando o provider escolhido for cloud-api.', {
        required: false,
      }),
      question('whatsapp_access_token', 'Qual e o access token da Cloud API?', 'secret', 'Preencha quando o provider escolhido for cloud-api.', {
        required: false,
      }),
      question('whatsapp_webhook_verify_token', 'Qual e o webhook verify token?', 'secret', 'Preencha quando o provider escolhido for cloud-api.', {
        required: false,
      }),
      question('whatsapp_session_dir', 'Qual diretorio de sessao o Baileys deve usar?', 'text', 'Preencha quando o provider escolhido for Baileys.', {
        required: false,
        placeholder: 'data/whatsapp-baileys/session',
      }),
    ],
    installSteps: [
      step('provider', 'Escolher o provider', 'Decidir entre stub, Cloud API ou Baileys.', 'guided'),
      step('credentials', 'Adicionar credenciais do provider', 'Preencher credenciais ou sessao persistente quando necessario.', 'manual'),
      step('doctor', 'Rodar doctor do canal', 'Validar o provider escolhido no host atual.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Use stub para preparar o host antes de abrir webhook real da Cloud API.',
      'Para Baileys, mantenha a sessao persistente fora de diretorios efemeros.',
    ],
    goodFor: ['Rollout progressivo', 'Chat operacional', 'Validacao local antes do provider oficial'],
  },
];
