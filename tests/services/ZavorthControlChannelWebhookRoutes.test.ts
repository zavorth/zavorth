import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchJson,
  fetchNoKeepAlive,
} from '../helpers/controlWebTestUtils.js';

describe('ZavorthControl channel webhook routes', () => {
  const logRepo = createTestLogRepo();

  it('routes Slack, WhatsApp, Instagram and Teams webhooks publicly through the zavorthControl core surface', async () => {
    const slackIngressGateway = {
      handleWebhookEvent: jest.fn(async () => ({
        statusCode: 200,
        body: { ok: true, accepted: true },
      })),
    };
    const teamsIngressGateway = {
      handleWebhookEvent: jest.fn(async () => ({
        statusCode: 200,
        body: { ok: true, accepted: true, platform: 'teams' },
      })),
    };
    const whatsAppIngressGateway = {
      handleWebhookVerification: jest.fn((url: URL) => ({
        statusCode: 200,
        textBody: String(url.searchParams.get('hub.challenge') || ''),
      })),
      handleWebhookEvent: jest.fn(async () => ({
        statusCode: 200,
        body: { ok: true, processed: 1 },
      })),
    };
    const instagramIngressGateway = {
      handleWebhookVerification: jest.fn((url: URL) => ({
        statusCode: 200,
        textBody: String(url.searchParams.get('hub.challenge') || ''),
      })),
      handleWebhookEvent: jest.fn(async () => ({
        statusCode: 200,
        body: { ok: true, processed: 1, platform: 'instagram' },
      })),
    };
    const service = new ZavorthControlService(logRepo);
    service.attachChannelIngressGateways({
      slack: slackIngressGateway as any,
      teams: teamsIngressGateway as any,
      whatsapp: whatsAppIngressGateway as any,
      instagram: instagramIngressGateway as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const slackRawBody = JSON.stringify({
      type: 'url_verification',
      challenge: 'slack-challenge',
    });
    const slackResult = await fetchJson(`${baseUrl}/api/webhooks/slack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Slack-Request-Timestamp': '123',
        'X-Slack-Signature': 'v0=test',
      },
      body: slackRawBody,
    });
    const whatsAppVerifyResponse = await fetchNoKeepAlive(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=wa-challenge`,
    );
    const whatsAppVerifyBody = await whatsAppVerifyResponse.text();
    const whatsAppEventResult = await fetchJson(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ from: '5511', id: 'wamid-1', type: 'text', text: { body: 'oi' } }],
                },
              },
            ],
          },
        ],
      }),
    });
    const instagramVerifyResponse = await fetchNoKeepAlive(
      `${baseUrl}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=ig-challenge`,
    );
    const instagramVerifyBody = await instagramVerifyResponse.text();
    const instagramEventResult = await fetchJson(`${baseUrl}/api/webhooks/instagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entry: [
          {
            messaging: [
              {
                sender: { id: 'ig-user-1' },
                message: { mid: 'ig-mid-1', text: 'oi instagram' },
              },
            ],
          },
        ],
      }),
    });
    const teamsRawBody = JSON.stringify({
      type: 'message',
      id: 'teams-1',
      text: 'oi teams',
      from: { id: 'aad-user-1' },
      conversation: { id: 'conversation-1' },
    });
    const teamsResult = await fetchJson(`${baseUrl}/api/webhooks/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: teamsRawBody,
    });

    await service.stopAsync();

    expect(slackResult.status).toBe(200);
    expect(slackResult.payload).toEqual({ ok: true, accepted: true });
    expect(slackIngressGateway.handleWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: slackRawBody,
        body: {
          type: 'url_verification',
          challenge: 'slack-challenge',
        },
        headers: expect.objectContaining({
          'x-slack-request-timestamp': '123',
        }),
      }),
    );

    expect(whatsAppVerifyResponse.status).toBe(200);
    expect(whatsAppVerifyBody).toBe('wa-challenge');
    expect(whatsAppIngressGateway.handleWebhookVerification).toHaveBeenCalledTimes(1);
    expect(whatsAppEventResult.status).toBe(200);
    expect(whatsAppEventResult.payload).toEqual({ ok: true, processed: 1 });
    expect(whatsAppIngressGateway.handleWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          entry: expect.any(Array),
        }),
      }),
    );
    expect(instagramVerifyResponse.status).toBe(200);
    expect(instagramVerifyBody).toBe('ig-challenge');
    expect(instagramIngressGateway.handleWebhookVerification).toHaveBeenCalledTimes(1);
    expect(instagramEventResult.status).toBe(200);
    expect(instagramEventResult.payload).toEqual({ ok: true, processed: 1, platform: 'instagram' });
    expect(instagramIngressGateway.handleWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          entry: expect.any(Array),
        }),
      }),
    );
    expect(teamsResult.status).toBe(200);
    expect(teamsResult.payload).toEqual({ ok: true, accepted: true, platform: 'teams' });
    expect(teamsIngressGateway.handleWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: teamsRawBody,
        body: expect.objectContaining({
          type: 'message',
          conversation: expect.any(Object),
        }),
      }),
    );
  });
});
