import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelegramFileDeliveryController } from '../../../src/telegram/controllers/TelegramFileDeliveryController';

describe('TelegramFileDeliveryController', () => {
  it('responde com as opcoes quando a busca fica ambigua', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const fileDeliveryService = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'choices',
        prompt: '1. report.pdf\n2. contract.pdf',
        entries: [],
      }),
      shouldHandleText: jest.fn().mockReturnValue(true),
    } as any;
    const controller = new TelegramFileDeliveryController(fileDeliveryService);

    await controller.handleCommand(ctx, 'downloads report', '42');

    expect(fileDeliveryService.prepare).toHaveBeenCalledWith(
      '42',
      'downloads report',
      expect.objectContaining({ extraAllowedPaths: [] }),
    );
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Encontrei mais de uma opcao');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('1. report.pdf');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('2. contract.pdf');
  });

  it('sends the document and cleans the temporary file when needed', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-file-delivery-controller-'));
    const archivePath = path.join(tempDir, 'evidence.zip');
    await fs.promises.writeFile(archivePath, 'zip');

    const ctx = {
      chat: { id: 42, type: 'private' },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithDocument: jest.fn().mockResolvedValue(undefined),
    } as any;
    const fileDeliveryService = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'send',
        entry: {
          absolutePath: archivePath,
          baseName: 'evidence',
          extension: '',
          isDirectory: true,
          relativePath: 'evidence',
          rootKey: 'downloads',
          rootLabel: 'Downloads',
          score: 1000,
          sizeBytes: 3,
          modifiedAtMs: Date.now(),
        },
        sendPath: archivePath,
        fileName: 'evidence.zip',
        caption: 'File ready',
        previewText: 'Encontrei o pacote ready',
        cleanupPath: archivePath,
      }),
      shouldHandleText: jest.fn().mockReturnValue(true),
    } as any;
    const controller = new TelegramFileDeliveryController(fileDeliveryService);

    await controller.handleFreeForm(ctx, 'send me the evidence folder', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Envio ready');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Encontrei o pacote ready');
    expect(ctx.api.sendChatAction).toHaveBeenCalledWith(42, 'upload_document');
    expect(ctx.replyWithDocument).toHaveBeenCalledWith(expect.anything(), {
      caption: 'File ready',
    });
    expect(fs.existsSync(archivePath)).toBe(false);

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('bloqueia o fluxo fora do chat privado', async () => {
    const ctx = {
      chat: { id: -100, type: 'group' },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const fileDeliveryService = {
      prepare: jest.fn(),
      shouldHandleText: jest.fn().mockReturnValue(true),
    } as any;
    const controller = new TelegramFileDeliveryController(fileDeliveryService);

    await controller.handleCommand(ctx, 'downloads report.pdf', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('private chat');
    expect(fileDeliveryService.prepare).not.toHaveBeenCalled();
  });

  it('opens a permission request when the folder is outside already allowed areas', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 777 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const permissionService = {
      createRequest: jest.fn().mockResolvedValue({
        permission_id: 'perm-file-12345678',
        executor: 'file_delivery',
        kind: 'workspace_access',
        scope: 'once',
        requested_value: 'C:/fora',
        resolved_value: 'C:/fora',
        reason: 'fora das areas liberadas',
        metadata: {
          original_request: 'me envie "C:/fora/index.html"',
        },
      }),
      listApprovedRequests: jest.fn().mockResolvedValue([]),
    } as any;
    const fileDeliveryService = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'permission',
        requestedPath: 'C:/fora',
        previewPath: 'C:/fora',
        originalRequest: 'me envie "C:/fora/index.html"',
        reason: 'fora das areas liberadas',
      }),
      shouldHandleText: jest.fn().mockReturnValue(true),
    } as any;
    const controller = new TelegramFileDeliveryController(fileDeliveryService, {
      permissionService,
      buildPermissionKeyboard: jest.fn().mockReturnValue({ inline_keyboard: [[{ text: 'ok', callback_data: 'x' }]] } as any),
      formatPermissionCreatedMessage: jest.fn().mockReturnValue('I need your approval for this folder.'),
    });

    await controller.handleCommand(ctx, 'me envie "C:/fora/index.html"', '42');

    expect(permissionService.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        executor: 'file_delivery',
        kind: 'workspace_access',
        requested_value: 'C:/fora',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      'I need your approval for this folder.',
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });

  it('retoma o envio depois da permission approved', async () => {
    const ctx = {
      chat: { id: 42, type: 'private' },
      from: { id: 777 },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
      reply: jest.fn().mockResolvedValue(undefined),
      replyWithDocument: jest.fn().mockResolvedValue(undefined),
    } as any;
    const fileDeliveryService = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'send',
        entry: {
          absolutePath: 'C:/fora/index.html',
          baseName: 'index.html',
          extension: '.html',
          isDirectory: false,
          relativePath: 'index.html',
          rootKey: 'approved_root_0',
          rootLabel: 'fora',
          score: 1000,
          sizeBytes: 30,
          modifiedAtMs: Date.now(),
        },
        sendPath: 'C:/fora/index.html',
        fileName: 'index.html',
        caption: 'File sent: index.html',
        previewText: 'Encontrei este file:',
      }),
      shouldHandleText: jest.fn().mockReturnValue(true),
    } as any;
    const controller = new TelegramFileDeliveryController(fileDeliveryService, {
      permissionService: {
        listApprovedRequests: jest.fn().mockResolvedValue([]),
      } as any,
    });

    const resumed = await controller.handleApprovedPermission(ctx, {
      executor: 'file_delivery',
      kind: 'workspace_access',
      requested_value: 'C:/fora',
      resolved_value: 'C:/fora',
      metadata: {
        original_request: 'me envie "C:/fora/index.html"',
        requested_by: '777',
      },
    } as any);

    expect(resumed).toBe(true);
    expect(fileDeliveryService.prepare).toHaveBeenCalledWith(
      '777',
      'me envie "C:/fora/index.html"',
      expect.objectContaining({
        extraAllowedPaths: expect.arrayContaining(['C:/fora']),
      }),
    );
    expect(ctx.replyWithDocument).toHaveBeenCalled();
  });
});
