import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, commonCapabilityQuestion, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_RECIPE_MANIFESTS: IntegrationManifest[] = [
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
];
