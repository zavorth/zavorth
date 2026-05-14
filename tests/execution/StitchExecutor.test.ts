import fs from 'fs';
import os from 'os';
import path from 'path';
import { StitchExecutor } from '../../src/execution/StitchExecutor';

describe('StitchExecutor', () => {
  function buildRequest() {
    return {
      execution_id: 'exec-stitch-1',
      task_id: 'task-stitch-1',
      executor: 'stitch',
      workspace: 'C:/workspace/zavorth',
      objective: 'Gerar app de tarefas',
      instructions: ['Crie um app mobile de tarefas com lista e botao de adicionar.'],
      allowed_paths: ['C:/workspace/zavorth'],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 120,
      dry_run: false,
      requires_backup: false,
      metadata: {},
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a friendly auth-missing error when Stitch is not configured', async () => {
    const executor = new StitchExecutor();
    jest.spyOn(executor as any, 'resolveAuthConfig').mockReturnValue(null);

    const result = await executor.execute(buildRequest() as any);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('STITCH_AUTH_MISSING');
    expect(result.error_message).toContain('falta autenticacao');
  });

  it('generates artifacts and a structured summary on success', async () => {
    const executor = new StitchExecutor();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-stitch-executor-'));
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const callToolMock = jest
      .fn()
      .mockResolvedValueOnce({
        outputComponents: [
          { designSystem: { designSystem: { displayName: 'Everest Slate' } } },
          {
            design: {
              screens: [
                {
                  id: 'screen-456',
                  name: 'projects/project-123/screens/screen-456',
                  screenshot: { downloadUrl: 'https://example.com/image' },
                  htmlCode: { downloadUrl: 'https://example.com/html' },
                },
              ],
            },
          },
        ],
      });

    jest.spyOn(executor as any, 'resolveAuthConfig').mockReturnValue({ apiKey: 'test-key' });
    jest.spyOn(executor as any, 'resolveDeviceType').mockReturnValue('MOBILE');
    jest.spyOn(executor as any, 'resolveModelId').mockReturnValue('GEMINI_3_FLASH');
    jest.spyOn(executor as any, 'downloadArtifact').mockImplementation(async (url: string) => {
      const isImage = url.includes('image');
      const filePath = path.join(tempDir, isImage ? 'preview.png' : 'screen.html');
      fs.writeFileSync(filePath, isImage ? 'png' : '<html></html>', 'utf8');
      return {
        path: filePath,
        mimeType: isImage ? 'image/png' : 'text/html',
      };
    });
    jest.spyOn(executor as any, 'loadSdk').mockResolvedValue({
      Stitch: jest.fn().mockImplementation(() => ({
        createProject: jest.fn().mockResolvedValue({
          id: 'project-123',
        }),
      })),
      StitchToolClient: jest.fn().mockImplementation(() => ({
        callTool: callToolMock,
        close: closeMock,
      })),
    });

    try {
      const result = await executor.execute(buildRequest() as any);

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Stitch concluiu a geracao do app com sucesso.');
      expect(result.metadata).toEqual(
        expect.objectContaining({
          stitch_project_id: 'project-123',
          stitch_screen_id: 'screen-456',
          stitch_device_type: 'MOBILE',
          stitch_model_id: 'GEMINI_3_FLASH',
        }),
      );
      expect(result.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'stitch_screenshot',
            path: expect.stringContaining('preview.png'),
          }),
          expect.objectContaining({
            kind: 'stitch_html',
            path: expect.stringContaining('screen.html'),
          }),
          expect.objectContaining({
            kind: 'stitch_manifest',
          }),
        ]),
      );
      expect(callToolMock).toHaveBeenCalledWith(
        'generate_screen_from_text',
        expect.objectContaining({
          projectId: 'project-123',
          prompt: 'Crie um app mobile de tarefas com lista e botao de adicionar.',
          deviceType: 'MOBILE',
          modelId: 'GEMINI_3_FLASH',
        }),
      );
      expect(closeMock).toHaveBeenCalled();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('retries long generations with a condensed prompt after a transport timeout', async () => {
    const executor = new StitchExecutor();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-stitch-retry-'));
    const closeMock = jest.fn().mockResolvedValue(undefined);
    const callToolMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('MCP error -32001: Request timed out'))
      .mockResolvedValueOnce({
        outputComponents: [
          {
            design: {
              screens: [
                {
                  id: 'screen-timeout-retry',
                  name: 'projects/project-123/screens/screen-timeout-retry',
                  screenshot: { downloadUrl: 'https://example.com/retry-image' },
                  htmlCode: { downloadUrl: 'https://example.com/retry-html' },
                },
              ],
            },
          },
        ],
      });

    jest.spyOn(executor as any, 'resolveAuthConfig').mockReturnValue({ apiKey: 'test-key' });
    jest.spyOn(executor as any, 'resolveDeviceType').mockReturnValue('AGNOSTIC');
    jest.spyOn(executor as any, 'resolveModelId').mockReturnValue('GEMINI_3_FLASH');
    jest.spyOn(executor as any, 'downloadArtifact').mockImplementation(async (url: string) => {
      const isImage = url.includes('image');
      const filePath = path.join(tempDir, isImage ? 'retry.png' : 'retry.html');
      fs.writeFileSync(filePath, isImage ? 'png' : '<html></html>', 'utf8');
      return {
        path: filePath,
        mimeType: isImage ? 'image/png' : 'text/html',
      };
    });
    jest.spyOn(executor as any, 'loadSdk').mockResolvedValue({
      Stitch: jest.fn().mockImplementation(() => ({
        createProject: jest.fn().mockResolvedValue({
          id: 'project-123',
        }),
      })),
      StitchToolClient: jest.fn().mockImplementation(() => ({
        callTool: callToolMock,
        close: closeMock,
      })),
    });

    const longPrompt = `Crie um app inspirado no Zavorth.\n\n${'Detalhe muito longo. '.repeat(400)}`;

    try {
      const result = await executor.execute({
        ...buildRequest(),
        task_id: 'task-stitch-timeout-retry',
        instructions: [longPrompt],
      } as any);

      expect(result.success).toBe(true);
      expect(callToolMock).toHaveBeenCalledTimes(2);
      expect(callToolMock.mock.calls[1][1].prompt.length).toBeLessThan(callToolMock.mock.calls[0][1].prompt.length);
      expect(result.actions_executed).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Timeout detectado'),
        ]),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
