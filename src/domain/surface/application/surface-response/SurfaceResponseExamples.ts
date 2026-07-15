import { createSurfaceResponse, type SurfaceResponse } from './SurfaceResponseContract.js';

export function buildStatusSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-status',
    intent: 'status',
    title: 'Zavorth overview',
    summary: 'Runtime online, channels under observation, and clear next steps.',
    tone: 'info',
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'Primary signals',
          columns: [
            { key: 'area', label: 'Area' },
            { key: 'status', label: 'Status' },
            { key: 'detail', label: 'Detail' },
          ],
          rows: [
            { area: 'Runtime', status: 'online', detail: 'host and worker active' },
            { area: 'Channels', status: 'degraded', detail: 'Slack on text fallback' },
            { area: 'Policy', status: 'ready', detail: 'safe default profile' },
          ],
        },
      },
      {
        kind: 'progress',
        progress: {
          label: 'Operational health',
          status: 'running',
          current: 3,
          total: 4,
          detail: 'No critical blockers.',
        },
      },
    ],
    receipts: [
      {
        id: 'receipt-status-read',
        title: 'Operational read',
        status: 'allowed',
        reason: 'Local lookup without raw sensitive data.',
        policyProfile: 'standard',
        redacted: false,
        riskBlocked: false,
        createdAt: '2026-05-09T12:00:00.000Z',
      },
    ],
    actions: [
      { id: 'open-hub', label: 'Open hub', kind: 'command', command: '/zavorth', style: 'primary' },
      { id: 'run-doctor', label: 'Run doctor', kind: 'command', command: '/doctor', style: 'secondary' },
    ],
  });
}

export function buildModelsSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-models',
    intent: 'models',
    title: 'Models and providers',
    summary: 'Operational selection shared across channels.',
    tone: 'neutral',
    blocks: [
      {
        kind: 'table',
        table: {
          title: 'Ready options',
          columns: [
            { key: 'provider', label: 'Provider' },
            { key: 'model', label: 'Model' },
            { key: 'posture', label: 'Posture' },
          ],
          rows: [
            { provider: 'gemini', model: 'gemini-2.5-flash', posture: 'default' },
            { provider: 'openai', model: 'gpt-4o', posture: 'manual' },
            { provider: 'gemma', model: 'gemma-2-27b-it', posture: 'fast local-like' },
          ],
        },
      },
      {
        kind: 'text',
        title: 'Note',
        text: 'Selection is applied by provider control-plane policy, not by channel visual state.',
      },
    ],
    actions: [
      { id: 'model-gemini', label: 'Gemini', kind: 'command', command: '/model gemini', style: 'primary' },
      { id: 'model-openai', label: 'OpenAI', kind: 'command', command: '/model openai', style: 'secondary' },
      { id: 'model-gemma', label: 'Gemma', kind: 'command', command: '/model gemma-2-27b-it', style: 'secondary' },
    ],
  });
}

export function buildApprovalSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-approval',
    intent: 'approval',
    title: 'Approval required',
    summary: 'A sensitive action needs an explicit decision before it can continue.',
    tone: 'warning',
    blocks: [
      {
        kind: 'list',
        title: 'Request',
        items: ['Action: write a file inside the workspace', 'Scope: once', 'Risk: reversible local modification'],
      },
      {
        kind: 'receipt',
        receipt: {
          id: 'approval-preview-engine-001',
          title: 'Policy broker',
          status: 'require_user_confirmation',
          reason: 'Local write requires owner confirmation.',
          policyProfile: 'standard',
          redacted: false,
          riskBlocked: false,
          createdAt: '2026-05-09T12:05:00.000Z',
        },
      },
    ],
    actions: [
      {
        id: 'approve-preview-engine-001',
        label: 'Approve once',
        kind: 'callback',
        callbackData: 'approval:approve:preview-engine-001:once',
        style: 'success',
        confirmationRequired: true,
      },
      {
        id: 'reject-preview-engine-001',
        label: 'Reject',
        kind: 'callback',
        callbackData: 'approval:reject:preview-engine-001',
        style: 'danger',
      },
    ],
  });
}

export function buildToolReceiptSurfaceResponseExample(): SurfaceResponse {
  return createSurfaceResponse({
    id: 'surface-example-receipt',
    intent: 'receipt',
    title: 'Tool receipt',
    summary: 'Execution recorded with redaction before leaving the runtime.',
    tone: 'success',
    blocks: [
      {
        kind: 'receipt',
        receipt: {
          id: 'tool-receipt-001',
          title: 'Safe fetch',
          status: 'allowed_with_redaction',
          reason: 'Public URL consulted; sensitive fields removed from the summary.',
          policyProfile: 'standard',
          redacted: true,
          riskBlocked: false,
          createdAt: '2026-05-09T12:10:00.000Z',
        },
      },
      {
        kind: 'table',
        table: {
          title: 'Details',
          columns: [
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
          ],
          rows: [
            { field: 'tool', value: 'web.fetch' },
            { field: 'egress', value: 'public internet' },
            { field: 'secrets', value: 'redacted' },
          ],
        },
      },
    ],
    actions: [{ id: 'show-logs', label: 'View logs', kind: 'command', command: '/logs', style: 'secondary' }],
  });
}

export function buildSurfaceResponseStage2Examples(): SurfaceResponse[] {
  return [
    buildStatusSurfaceResponseExample(),
    buildModelsSurfaceResponseExample(),
    buildApprovalSurfaceResponseExample(),
    buildToolReceiptSurfaceResponseExample(),
  ];
}
