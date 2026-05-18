import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeHostCapabilityService } from '../../src/services/NodeHostCapabilityService.js';

describe('NodeHostCapabilityService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('executes system.run through the injected command runner', async () => {
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: 'NODE_MESH_OK',
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-1',
      capabilityId: 'system.run',
      action: 'run',
      payload: {
        command: 'echo NODE_MESH_OK',
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'system.run',
        command: 'echo NODE_MESH_OK',
        file: 'echo',
        args: ['NODE_MESH_OK'],
      }),
      expect.objectContaining({
        cwd: expect.any(String),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-1',
        ok: true,
        resultSummary: 'Comando executado no node host.',
        stdout: 'NODE_MESH_OK',
      }),
    );
  });

  it('blocks system.run shell metacharacters before reaching the command runner', async () => {
    const commandRunner = {
      run: jest.fn(),
    };
    const service = new NodeHostCapabilityService({
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-shell-meta',
      capabilityId: 'system.run',
      action: 'run',
      payload: {
        command: 'echo ok && powershell -NoProfile',
      },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.resultSummary).toContain('politica zero-trust');
    expect(result.stderr).toContain('metacaracteres de shell');
  });

  it('blocks system.run cwd values outside the node host allowed roots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-system-run-'));
    tempDirs.push(root);
    const commandRunner = {
      run: jest.fn(),
    };
    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-cwd-scope',
      capabilityId: 'system.run',
      action: 'run',
      payload: {
        command: 'echo ok',
        cwd: os.tmpdir(),
      },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.resultSummary).toContain('caminho fora do escopo permitido');
  });

  it('blocks system.run code-capable binaries unless explicitly enabled', async () => {
    const commandRunner = {
      run: jest.fn(),
    };
    const service = new NodeHostCapabilityService({
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-code-binary',
      capabilityId: 'system.run',
      action: 'run',
      payload: {
        command: 'node script.js',
      },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('pode executar codigo');
  });

  it('reads text files locally through files.read', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-files-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'briefing.txt');
    fs.writeFileSync(targetFile, 'briefing Zavorth', 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });
    const result = await service.executeAssignment({
      id: 'invoke-2',
      capabilityId: 'files.read',
      action: 'read',
      payload: {
        path: targetFile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-2',
        ok: true,
        resultSummary: 'Arquivo lido do node host.',
        stdout: 'briefing Zavorth',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        path: targetFile,
        truncated: false,
      }),
    );
  });

  it('writes text files locally through files.write', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-write-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'artifacts', 'node-mesh.txt');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });
    const result = await service.executeAssignment({
      id: 'invoke-2b',
      capabilityId: 'files.write',
      action: 'write',
      payload: {
        path: targetFile,
        content: 'node mesh write ok',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-2b',
        ok: true,
      }),
    );
    expect(result.resultSummary).toContain(targetFile);
    expect(fs.readFileSync(targetFile, 'utf8')).toBe('node mesh write ok');
    expect(result.data).toEqual(
      expect.objectContaining({
        path: targetFile,
        mode: 'create',
        bytesWritten: Buffer.byteLength('node mesh write ok'),
      }),
    );
  });

  it('rejects invalid files.write modes to avoid silent overwrites', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-write-mode-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'artifacts', 'guardrail.txt');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });
    const result = await service.executeAssignment({
      id: 'invoke-2c',
      capabilityId: 'files.write',
      action: 'write',
      payload: {
        path: targetFile,
        content: 'guardrail',
        mode: 'truncate-and-pray',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-2c',
        ok: false,
        stderr: 'mode invalido: truncate-and-pray',
      }),
    );
    expect(fs.existsSync(targetFile)).toBe(false);
  });

  it('blocks files.write outside the allowed roots', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-scope-root-'));
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-scope-outside-'));
    tempDirs.push(root, outsideRoot);
    const targetFile = path.join(outsideRoot, 'blocked.txt');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });
    const result = await service.executeAssignment({
      id: 'invoke-2d',
      capabilityId: 'files.write',
      action: 'write',
      payload: {
        path: targetFile,
        content: 'should not pass',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-2d',
        ok: false,
        resultSummary: 'files.write bloqueou um caminho fora do escopo permitido.',
      }),
    );
    expect(String(result.stderr || '')).toContain('[SECURITY]');
    expect(fs.existsSync(targetFile)).toBe(false);
  });

  it('captures the screen through the platform runner and reports the saved path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-screen-'));
    tempDirs.push(root);
    const outputPath = path.join(root, 'capture.png');
    fs.writeFileSync(outputPath, 'fake-png', 'utf8');
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: outputPath,
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      platform: 'win32',
      commandRunner,
      tempRoot: root,
    });

    const result = await service.executeAssignment({
      id: 'invoke-3',
      capabilityId: 'screen.capture',
      action: 'capture',
      payload: {
        outputPath,
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith(
      expect.stringContaining('System.Windows.Forms'),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-3',
        ok: true,
      }),
    );
    expect(result.resultSummary).toContain(outputPath);
    expect(result.data).toEqual(
      expect.objectContaining({
        path: outputPath,
        mimeType: 'image/png',
      }),
    );
  });

  it('reads the clipboard through the platform runner', async () => {
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: 'secret-from-clipboard',
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      platform: 'darwin',
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-4',
      capabilityId: 'clipboard.read',
      action: 'read',
      payload: null,
    });

    expect(commandRunner.run).toHaveBeenCalledWith('pbpaste', expect.any(Object));
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-4',
        ok: true,
        resultSummary: 'Clipboard lido do node host.',
        stdout: 'secret-from-clipboard',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        method: 'pbpaste',
      }),
    );
  });

  it('writes the clipboard through the platform runner', async () => {
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: 'clipboard-written',
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      platform: 'darwin',
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-4b',
      capabilityId: 'clipboard.write',
      action: 'write',
      payload: {
        text: 'handoff pronto',
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining('pbcopy'),
        file: 'sh',
        args: expect.arrayContaining([
          '-c',
          expect.stringContaining('pbcopy'),
          'zavorth-clipboard',
          'handoff pronto',
        ]),
      }),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-4b',
        ok: true,
        resultSummary: 'Clipboard escrito no node host.',
        stdout: 'clipboard-written',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        method: 'pbcopy',
        length: 'handoff pronto'.length,
      }),
    );
  });

  it('sends local notifications through the platform runner', async () => {
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: 'notification-sent',
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      platform: 'linux',
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-5',
      capabilityId: 'notifications.send',
      action: 'notify',
      payload: {
        title: 'Zavorth',
        body: 'Node Mesh online',
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining('notify-send'),
        file: 'notify-send',
        args: ['Zavorth', 'Node Mesh online'],
      }),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-5',
        ok: true,
        resultSummary: 'Notificacao enviada pelo node host.',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        method: 'notify-send',
        title: 'Zavorth',
      }),
    );
  });

  it('reports browser proxy endpoints without spawning a local browser', async () => {
    const commandRunner = {
      run: jest.fn(),
    };
    const service = new NodeHostCapabilityService({
      commandRunner: commandRunner as any,
    });

    const result = await service.executeAssignment({
      id: 'invoke-6',
      capabilityId: 'browser.proxy',
      action: 'proxy',
      payload: {
        proxyUrl: 'http://127.0.0.1:9222',
      },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-6',
        ok: true,
        stdout: 'http://127.0.0.1:9222/',
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        endpoint: 'http://127.0.0.1:9222/',
        mode: 'endpoint',
      }),
    );
  });

  it('opens a browser target through the platform runner when browser.proxy receives a url', async () => {
    const commandRunner = {
      run: jest.fn(async () => ({
        ok: true,
        stdout: null,
        stderr: null,
        exitCode: 0,
      })),
    };
    const service = new NodeHostCapabilityService({
      platform: 'linux',
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-6b',
      capabilityId: 'browser.proxy',
      action: 'open',
      payload: {
        url: 'https://example.com/app',
      },
    });

    expect(commandRunner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining('xdg-open'),
        file: 'xdg-open',
        args: ['https://example.com/app'],
      }),
      expect.any(Object),
    );
    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-6b',
        ok: true,
      }),
    );
    expect(result.resultSummary).toContain('https://example.com/app');
  });

  it('blocks browser.proxy file URLs by default', async () => {
    const commandRunner = {
      run: jest.fn(),
    };
    const service = new NodeHostCapabilityService({
      commandRunner,
    });

    const result = await service.executeAssignment({
      id: 'invoke-browser-file',
      capabilityId: 'browser.proxy',
      action: 'open',
      payload: {
        url: 'file:///C:/Users/example/secrets.txt',
      },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('payload.url deve usar http/https');
  });

  it('watches files inside the allowed roots and reports the first change', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-watch-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'watch-me.txt');
    fs.writeFileSync(targetFile, 'before', 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });

    const pending = service.executeAssignment({
      id: 'invoke-6c',
      capabilityId: 'files.watch',
      action: 'watch',
      payload: {
        path: targetFile,
        timeoutMs: 4000,
      },
    });

    setTimeout(() => {
      fs.writeFileSync(targetFile, 'after', 'utf8');
    }, 100);

    const result = await pending;

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-6c',
        ok: true,
        resultSummary: expect.stringContaining('Mudanca observada'),
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        path: targetFile,
        idle: false,
        changes: expect.any(Array),
      }),
    );
    expect(Array.isArray(result.data?.changes)).toBe(true);
    expect((result.data?.changes as any[]).length).toBeGreaterThan(0);
  });

  it('keeps unsupported capabilities blocked', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-device-'));
    tempDirs.push(root);
    const sourcePath = path.join(root, 'camera-source.png');
    fs.writeFileSync(sourcePath, 'fake-png', 'utf8');
    const locationPath = path.join(root, 'location.json');
    fs.writeFileSync(locationPath, JSON.stringify({
      latitude: -23.55052,
      longitude: -46.633308,
      label: 'Sao Paulo',
    }), 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
      env: {
        ZAVORTH_NODE_HOST_DEVICE_MODEL: 'Pixel 9',
        ZAVORTH_NODE_HOST_APP_VERSION: '1.0.0',
        ZAVORTH_NODE_HOST_LOCATION_FILE: locationPath,
      },
    });

    const infoResult = await service.executeAssignment({
      id: 'invoke-7',
      capabilityId: 'device.info',
      action: 'describe',
      payload: null,
    });
    const locationResult = await service.executeAssignment({
      id: 'invoke-8',
      capabilityId: 'location.read',
      action: 'locate',
      payload: null,
    });
    const cameraResult = await service.executeAssignment({
      id: 'invoke-9',
      capabilityId: 'camera.capture',
      action: 'capture',
      payload: {
        sourcePath,
        outputPath: path.join(root, 'camera-output.png'),
      },
    });

    expect(infoResult).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-7',
        ok: true,
        data: expect.objectContaining({
          deviceModel: 'Pixel 9',
          appVersion: '1.0.0',
          arch: process.arch,
        }),
      }),
    );
    expect(locationResult).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-8',
        ok: true,
        data: expect.objectContaining({
          method: 'file',
          latitude: -23.55052,
          longitude: -46.633308,
          label: 'Sao Paulo',
        }),
      }),
    );
    expect(cameraResult).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-9',
        ok: true,
        data: expect.objectContaining({
          method: 'file-copy',
          sourcePath,
          mimeType: 'image/png',
        }),
      }),
    );
    expect(fs.readFileSync(path.join(root, 'camera-output.png'), 'utf8')).toBe('fake-png');
  });

  it('resolves relative camera paths against the workspace root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-camera-relative-'));
    tempDirs.push(root);
    const sourceRelativePath = path.join('artifacts', 'camera-source.png');
    const outputRelativePath = path.join('artifacts', 'camera-output.png');
    fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(root, sourceRelativePath), 'fake-relative-camera', 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      allowedRoots: [root],
    });

    const result = await service.executeAssignment({
      id: 'invoke-9b',
      capabilityId: 'camera.capture',
      action: 'capture',
      payload: {
        sourcePath: sourceRelativePath,
        outputPath: outputRelativePath,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-9b',
        ok: true,
        data: expect.objectContaining({
          method: 'file-copy',
          sourcePath: path.join(root, sourceRelativePath),
          path: path.join(root, outputRelativePath),
        }),
      }),
    );
    expect(fs.readFileSync(path.join(root, outputRelativePath), 'utf8')).toBe('fake-relative-camera');
  });

  it('runs node maintenance doctor with local state awareness', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-maint-doctor-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'node-host-state.json');
    fs.writeFileSync(stateFile, JSON.stringify({
      pendingResults: [
        {
          invocationId: 'invoke-valid',
          ok: true,
          resultSummary: 'ok',
        },
        {
          invocationId: '',
          ok: true,
        },
      ],
    }), 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      tempRoot: root,
      stateFile,
      allowedRoots: [root],
    });

    const result = await service.executeAssignment({
      id: 'invoke-maint-1',
      capabilityId: 'node.maintenance',
      action: 'doctor',
      payload: {
        requestedCapabilities: ['system.run', 'custom.unsupported'],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-maint-1',
        ok: true,
      }),
    );
    expect(result.resultSummary).toContain('pendencias locais');
    expect(result.data).toEqual(
      expect.objectContaining({
        status: 'attention',
        pendingResults: expect.objectContaining({
          total: 1,
          invalid: 1,
        }),
        issues: expect.arrayContaining([
          expect.objectContaining({
            kind: 'invalid-state',
          }),
          expect.objectContaining({
            kind: 'unsupported-capability',
          }),
        ]),
      }),
    );
  });

  it('repairs the local node host state through node maintenance', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-host-maint-repair-'));
    tempDirs.push(root);
    const stateFile = path.join(root, 'node-host-state.json');
    fs.writeFileSync(stateFile, JSON.stringify({
      pendingResults: [
        {
          invocationId: 'invoke-valid',
          ok: true,
          resultSummary: 'ok',
        },
        {
          invocationId: '',
          ok: true,
        },
      ],
    }), 'utf8');

    const service = new NodeHostCapabilityService({
      workspaceRoot: root,
      tempRoot: root,
      stateFile,
      allowedRoots: [root],
    });

    const result = await service.executeAssignment({
      id: 'invoke-maint-2',
      capabilityId: 'node.maintenance',
      action: 'repair',
      payload: null,
    });
    const repairedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    expect(result).toEqual(
      expect.objectContaining({
        invocationId: 'invoke-maint-2',
        ok: true,
      }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        keptResults: 1,
        removedResults: 1,
      }),
    );
    expect(repairedState.pendingResults).toEqual([
      expect.objectContaining({
        invocationId: 'invoke-valid',
      }),
    ]);
  });
});
