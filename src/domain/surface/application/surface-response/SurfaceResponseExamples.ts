import {
  createSurfaceResponse,
  type SurfaceResponse,
} from './SurfaceResponseContract.js';

export function buildStatusSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-status',
    intent: 'status',
    title: 'Panorama do Zavorth',
    summary: 'Runtime online, canais em observacao e proximos passos claros.',
    tone: 'info',
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'Sinais principais',
          columns: [
            { key: 'area', label: 'Area' },
            { key: 'status', label: 'Status' },
            { key: 'detail', label: 'Detalhe' },
          ],
          rows: [
            { area: 'Runtime', status: 'online', detail: 'host e worker ativos' },
            { area: 'Canais', status: 'degraded', detail: 'Slack em fallback textual' },
            { area: 'Policy', status: 'ready', detail: 'perfil padrao seguro' },
          ],
        },
      },
      {
        kind: 'progress',
        progress: {
          label: 'Saude operacional',
          status: 'running',
          current: 3,
          total: 4,
          detail: 'Sem bloqueio critico.',
        },
      },
    ],
    receipts: [
      {
        id: 'receipt-status-read',
        title: 'Leitura operacional',
        status: 'allowed',
        reason: 'Consulta local sem dados sensiveis brutos.',
        policyProfile: 'standard',
        redacted: false,
        riskBlocked: false,
        createdAt: '2026-05-09T12:00:00.000Z',
      },
    ],
    actions: [
      { id: 'open-hub', label: 'Abrir hub', kind: 'command', command: '/zavorth', style: 'primary' },
      { id: 'run-doctor', label: 'Rodar doctor', kind: 'command', command: '/doctor', style: 'secondary' },
    ],
  });
}

export function buildModelsSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-models',
    intent: 'models',
    title: 'Modelos e providers',
    summary: 'Escolha operacional compartilhada entre canais.',
    tone: 'neutral',
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'Opcoes prontas',
          columns: [
            { key: 'provider', label: 'Provider' },
            { key: 'model', label: 'Modelo' },
            { key: 'posture', label: 'Postura' },
          ],
          rows: [
            { provider: 'gemini', model: 'gemini-2.5-flash', posture: 'default' },
            { provider: 'openai', model: 'gpt-5.4', posture: 'manual' },
            { provider: 'gemma', model: 'gemma-4-31b-it', posture: 'fast local-like' },
          ],
        },
      },
      {
        kind: 'text',
        title: 'Nota',
        text: 'A selecao e aplicada por politica do provider control plane, nao por estado visual do canal.',
      },
    ],
    actions: [
      { id: 'model-gemini', label: 'Gemini', kind: 'command', command: '/model gemini', style: 'primary' },
      { id: 'model-openai', label: 'OpenAI', kind: 'command', command: '/model openai', style: 'secondary' },
      { id: 'model-gemma', label: 'Gemma', kind: 'command', command: '/model gemma-4-31b-it', style: 'secondary' },
    ],
  });
}

export function buildApprovalSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-approval',
    intent: 'approval',
    title: 'Aprovacao necessaria',
    summary: 'Uma acao sensivel precisa de decisao explicita antes de continuar.',
    tone: 'warning',
    blocks: [
      {
        kind: 'list',
        title: 'Pedido',
        items: [
          'Acao: escrever arquivo dentro do workspace',
          'Escopo: uma vez',
          'Risco: modificacao local reversivel',
        ],
      },
      {
        kind: 'receipt',
        receipt: {
          id: 'approval-phase2-001',
          title: 'Policy broker',
          status: 'require_user_confirmation',
          reason: 'A escrita local exige confirmacao do dono.',
          policyProfile: 'standard',
          redacted: false,
          riskBlocked: false,
          createdAt: '2026-05-09T12:05:00.000Z',
        },
      },
    ],
    actions: [
      {
        id: 'approve-phase2-001',
        label: 'Aprovar uma vez',
        kind: 'callback',
        callbackData: 'approval:approve:phase2-001:once',
        style: 'success',
        confirmationRequired: true,
      },
      {
        id: 'reject-phase2-001',
        label: 'Rejeitar',
        kind: 'callback',
        callbackData: 'approval:reject:phase2-001',
        style: 'danger',
      },
    ],
  });
}

export function buildToolReceiptSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-receipt',
    intent: 'receipt',
    title: 'Recibo de tool',
    summary: 'Execucao registrada com redacao antes de sair do runtime.',
    tone: 'success',
    blocks: [
      {
        kind: 'receipt',
        receipt: {
          id: 'tool-receipt-001',
          title: 'Safe fetch',
          status: 'allowed_with_redaction',
          reason: 'URL publica consultada; campos sensiveis removidos do resumo.',
          policyProfile: 'standard',
          redacted: true,
          riskBlocked: false,
          createdAt: '2026-05-09T12:10:00.000Z',
        },
      },
      {
        kind: 'table',
        table: {
          title: 'Detalhes',
          columns: [
            { key: 'field', label: 'Campo' },
            { key: 'value', label: 'Valor' },
          ],
          rows: [
            { field: 'tool', value: 'web.fetch' },
            { field: 'egress', value: 'public internet' },
            { field: 'secrets', value: 'redacted' },
          ],
        },
      },
    ],
    actions: [
      { id: 'show-logs', label: 'Ver logs', kind: 'command', command: '/logs', style: 'secondary' },
    ],
  });
}

export function buildSurfaceResponsePhase2Examples(): SurfaceResponse[] {
  return [
    buildStatusSurfaceResponseExample(),
    buildModelsSurfaceResponseExample(),
    buildApprovalSurfaceResponseExample(),
    buildToolReceiptSurfaceResponseExample(),
  ];
}
