import {
  SURFACE_RESPONSE_CONTRACT_VERSION,
  buildApprovalSurfaceResponseExample,
  buildModelsSurfaceResponseExample,
  buildRuntimeSurfaceResponse,
  buildStatusSurfaceResponseExample,
  buildSurfaceResponseStage2Examples,
  buildToolReceiptSurfaceResponseExample,
  buildWorkflowStageSurfaceResponse,
  renderCliSurfaceResponse,
  renderDiscordSurfaceResponse,
  renderFallbackMessagingSurfaceResponse,
  renderPlainSurfaceResponse,
  renderSurfaceResponseForTarget,
  renderTelegramSurfaceResponse,
} from '../../../src/domain/surface/application/surface-response';
import { formatCliSurfaceResponse } from '../../../src/cli/ZavorthCliSurfaceResponseRenderer';

describe('Surface Response Contract', () => {
  it('defines canonical examples for status, models, approvals and tool receipts', () => {
    const examples = buildSurfaceResponseStage2Examples();

    expect(examples.map((example) => example.version)).toEqual([
      SURFACE_RESPONSE_CONTRACT_VERSION,
      SURFACE_RESPONSE_CONTRACT_VERSION,
      SURFACE_RESPONSE_CONTRACT_VERSION,
      SURFACE_RESPONSE_CONTRACT_VERSION,
    ]);
    expect(examples.map((example) => example.intent)).toEqual(['status', 'models', 'approval', 'receipt']);
    expect(examples.every((example) => example.blocks.length > 0)).toBe(true);
  });

  it('renders every example in every non-dashboard surface target', () => {
    for (const response of buildSurfaceResponseStage2Examples()) {
      for (const target of [
        'plain',
        'cli',
        'telegram',
        'discord',
        'whatsapp',
        'instagram',
        'teams',
        'email',
        'signal',
        'imessage',
        'slack',
        'web',
      ] as const) {
        const rendered = renderSurfaceResponseForTarget(target, response);

        expect(rendered.target).toBe(target);
        expect(rendered.text).toContain(response.title);
        expect(rendered.text.length).toBeGreaterThan(40);
      }
    }
  });

  it('keeps Telegram rich via inline keyboard without making Telegram own the response', () => {
    const rendered = renderTelegramSurfaceResponse(buildModelsSurfaceResponseExample());

    expect(rendered.format).toBe('telegram-text');
    expect(rendered.text).toContain('Models and providers');
    expect(rendered.text).toContain('Provider');
    expect(rendered.native.parseMode).toBeNull();
    expect(rendered.native.replyMarkup?.inline_keyboard.flat()).toEqual([
      expect.objectContaining({ text: 'Gemini', callback_data: '/model gemini' }),
      expect.objectContaining({ text: 'OpenAI', callback_data: '/model openai' }),
      expect.objectContaining({ text: 'Gemma', callback_data: '/model gemma-2-27b-it' }),
    ]);
    for (const button of rendered.native.replyMarkup?.inline_keyboard.flat() || []) {
      expect((button.callback_data || button.url || '').length).toBeLessThanOrEqual(64);
    }
  });

  it('renders Discord components and keeps mentions inert', () => {
    const response = buildApprovalSurfaceResponseExample();
    response.blocks.push({
      kind: 'text',
      text: 'Nao notifique @everyone nem <@123> ao renderizar.',
    });

    const rendered = renderDiscordSurfaceResponse(response);

    expect(rendered.text).toContain('Approval required');
    expect(rendered.text).toContain('@\u200beveryone');
    expect(rendered.text).toContain('<@\u200b123>');
    expect(rendered.native.allowedMentions).toEqual({ parse: [] });
    expect(rendered.native.components).toHaveLength(1);
    expect(rendered.native.components[0].components).toEqual([
      expect.objectContaining({ label: 'Approve once', style: 3 }),
      expect.objectContaining({ label: 'Reject', style: 4 }),
    ]);
    for (const component of rendered.native.components[0].components) {
      expect((component.custom_id || component.url || '').length).toBeLessThanOrEqual(100);
    }
  });

  it('renders CLI and plain text with the same operational facts', () => {
    const response = buildStatusSurfaceResponseExample();
    const plain = renderPlainSurfaceResponse(response);
    const cli = renderCliSurfaceResponse(response);
    const cliBridge = formatCliSurfaceResponse(response);

    for (const expected of ['Runtime', 'Channels', 'Policy', 'Operational read', '/doctor']) {
      expect(plain.text).toContain(expected);
      expect(cli.text).toContain(expected);
      expect(cliBridge).toContain(expected);
    }
    expect(cli.text).toContain('[status] Zavorth overview');
    expect(cliBridge).toContain('[status] Zavorth overview');
    expect(plain.text).not.toContain('[status]');
  });

  it('renders non-button channels as dense textual fallbacks from the same response', () => {
    const response = buildModelsSurfaceResponseExample();

    for (const target of ['whatsapp', 'instagram', 'teams', 'email', 'signal', 'imessage', 'slack', 'web'] as const) {
      const rendered = renderFallbackMessagingSurfaceResponse(target, response);

      expect(rendered.target).toBe(target);
      expect(rendered.native).toBeNull();
      expect(rendered.text).toContain('Models and providers');
      expect(rendered.text).toContain('/model gemini');
      expect(rendered.actions.length).toBeGreaterThan(0);
    }
  });

  it('keeps receipts explicit about redaction and policy', () => {
    const rendered = renderPlainSurfaceResponse(buildToolReceiptSurfaceResponseExample());

    expect(rendered.text).toContain('Tool receipt');
    expect(rendered.text).toContain('allowed_with_redaction');
    expect(rendered.text).toContain('redacted: yes');
    expect(rendered.text).toContain('policy: standard');
    expect(rendered.text).toContain('/logs');
  });

  it('builds operational runtime and workflow receipts without channel-specific code', () => {
    const runtime = buildRuntimeSurfaceResponse({
      id: 'runtime-reload-1',
      title: 'Reload supervisionado aceito',
      summary: 'Reload preparado.',
      text: 'Reload preparado.',
      status: 'done',
      metadata: { requestId: 'reload-1' },
    });
    const workflow = buildWorkflowStageSurfaceResponse({
      workflowRunId: 'wf-1',
      workflowName: 'ship',
      stageId: 'review',
      stageLabel: 'Review',
      taskId: 'task-1',
      title: 'Etapa aguardando aprovacao',
      summary: 'Comando sensivel.',
      text: 'A etapa Review ficou aguardando aprovacao.',
      status: 'require_user_confirmation',
      reason: 'Comando sensivel.',
    });

    expect(renderPlainSurfaceResponse(runtime).text).toContain('runtime-reload-1');
    expect(renderPlainSurfaceResponse(workflow).text).toContain('require_user_confirmation');
    expect(renderTelegramSurfaceResponse(workflow).native.replyMarkup).toBeNull();
  });
});
