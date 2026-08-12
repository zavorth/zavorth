import { SystemVisionAnalysisTool } from '../../src/echo/tools/os/SystemVisionAnalysisTool.js';

describe('SystemVisionAnalysisTool', () => {
  it('captures the screen and returns canonical multimodal analysis metadata', async () => {
    const tool = new SystemVisionAnalysisTool(
      {
        execute: jest.fn(async () => ({
          success: true,
          message: 'captured',
          data: {
            filePath: 'C:\\temp\\vision.png',
            base64: 'ZmFrZS1pbWFnZQ==',
            mimeType: 'image/png',
          },
        })),
      } as any,
      {
        analyzeScreenshot: jest.fn(async () => ({
          ok: true,
          providerName: 'gemini',
          summary: 'Uma janela do Zavorth esta visivel.',
          responseText: 'Estou vendo a janela do Zavorth aberta.',
          observedTexts: ['Zavorth'],
          suggestedNextAction: 'seguir com o fluxo',
          confidence: 0.88,
          rawResponse: '{"summary":"ok"}',
          error: null,
        })),
      } as any,
    );

    const result = await tool.execute({
      question: 'O que esta na tela?',
      mode: 'active_window',
      returnBase64: true,
    }, {
      traceId: 'trace-vision',
      runId: 'run-vision',
      sessionId: 'session-vision',
      approvalId: 'approval-vision',
      artifactId: 'artifact-vision',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Estou vendo a janela do Zavorth aberta.');
    expect(result.data).toEqual(expect.objectContaining({
      mode: 'active_window',
      base64: 'ZmFrZS1pbWFnZQ==',
      artifact: expect.objectContaining({
        id: 'artifact-vision',
        kind: 'screenshot',
        source: 'os_screen_vision',
      }),
      lifecycle: expect.objectContaining({
        mode: 'snapshot-analysis',
        status: 'analyzed',
        providerName: 'gemini',
      }),
      policy: expect.objectContaining({
        scope: 'desktop-local',
      }),
      analysis: expect.objectContaining({
        summary: 'Uma janela do Zavorth esta visivel.',
        providerName: 'gemini',
      }),
      correlation: expect.objectContaining({
        traceId: 'trace-vision',
        runId: 'run-vision',
        sessionId: 'session-vision',
        approvalId: 'approval-vision',
        artifactId: 'artifact-vision',
      }),
    }));
  });
});
