import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthExternalAgentGatewayContract.js';
import { ZavorthExternalAgentGatewayService } from '../../src/services/ZavorthExternalAgentGatewayService.js';

describe('ZavorthExternalAgentGatewayService', () => {
  it('lists profiles without invoking external agents', () => {
    const service = createService();
    const snapshot = service.buildRegistrySnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: ZAVORTH_EXTERNAL_AGENT_GATEWAY_CONTRACT_VERSION,
      surface: 'external-agent-gateway',
      status: 'empty',
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noAgentUsedDuringRegistryRead: true,
      liveUseRequiresApproval: true,
      noCredentialSerialization: true,
    }));
  });

  it('previews profile registration until explicit approval is present', () => {
    const service = createService();
    const receipt = service.registerProfile({
      id: 'claude-local',
      adapter: 'cli',
      command: 'claude',
      enableLive: true,
      approvalGranted: false,
    });

    expect(receipt.status).toBe('approval-required');
    expect(receipt.execution.adapterInvoked).toBe(false);
    expect(receipt.profile?.liveExecutionEnabled).toBe(false);
    expect(service.buildRegistrySnapshot().profiles).toHaveLength(0);
  });

  it('registers approved profiles but still requires per-run approval', async () => {
    const service = createService();
    const registration = service.registerProfile({
      id: 'fixture-agent',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', 'console.log("should-not-run-without-approval")'],
      enableLive: true,
      approvalGranted: true,
    });
    const preview = await service.invoke({
      profileId: 'fixture-agent',
      prompt: 'ping',
      approvalGranted: false,
    });

    expect(registration.status).toBe('registered');
    expect(service.buildRegistrySnapshot().summary.liveEnabled).toBe(1);
    expect(preview.status).toBe('approval-required');
    expect(preview.execution.adapterInvoked).toBe(false);
    expect(preview.execution.liveExecutionPerformed).toBe(false);
  });

  it('invokes an approved CLI profile through a governed receipt', async () => {
    const service = createService();
    const script = 'process.stdin.resume();let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log("agent:"+d.trim()))';
    service.registerProfile({
      id: 'cli-live',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', script],
      enableLive: true,
      approvalGranted: true,
    });

    const receipt = await service.invoke({
      profileId: 'cli-live',
      prompt: 'review module',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('completed');
    expect(receipt.execution.adapterInvoked).toBe(true);
    expect(receipt.execution.liveExecutionPerformed).toBe(true);
    expect(receipt.execution.liveNetworkPerformed).toBe(false);
    expect(receipt.execution.isolationKind).toBe('local-supervised');
    expect(receipt.safety.localCliIsNotOsSandbox).toBe(true);
    expect(receipt.output.text).toContain('agent:review module');
    expect(receipt.safety.noShellInterpolation).toBe(true);
  });

  it('redacts secret-looking prompt and output values before writing receipts', async () => {
    const service = createService();
    const script = 'console.log("OPENAI_API_KEY=sk-secret-value-1234567890")';
    service.registerProfile({
      id: 'secret-printer',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', script],
      enableLive: true,
      approvalGranted: true,
    });

    const receipt = await service.invoke({
      profileId: 'secret-printer',
      prompt: 'use API_KEY=super-secret-value',
      approvalGranted: true,
    });

    expect(JSON.stringify(receipt)).not.toContain('sk-secret-value');
    expect(JSON.stringify(receipt)).not.toContain('super-secret-value');
    expect(receipt.request.promptPreview).toContain('[redacted]');
    expect(receipt.output.text).toContain('[redacted]');
  });

  it('keeps custom receipt paths inside the runtime data directory', async () => {
    const service = createService();
    service.registerProfile({
      id: 'receipt-path',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', 'console.log("ok")'],
      enableLive: true,
      approvalGranted: true,
    });
    const outsidePath = path.join(path.dirname(service.registryFile), '..', 'outside.json');

    await service.invoke({
      profileId: 'receipt-path',
      prompt: 'ok',
      approvalGranted: true,
      receiptPath: outsidePath,
    });

    expect(fs.existsSync(outsidePath)).toBe(false);
    expect(fs.existsSync(path.join(path.dirname(service.registryFile), 'data', 'runtime', 'external-agent-last-receipt.json'))).toBe(true);
  });

  it('blocks local CLI profiles when strong isolation is required', async () => {
    const service = createService();
    service.registerProfile({
      id: 'unsafe-local-cli',
      adapter: 'cli',
      command: process.execPath,
      args: ['-e', 'console.log("must-not-run")'],
      enableLive: true,
      approvalGranted: true,
      requireStrongIsolation: true,
    });

    const receipt = await service.invoke({
      profileId: 'unsafe-local-cli',
      prompt: 'run',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('blocked');
    expect(receipt.execution.adapterInvoked).toBe(false);
    expect(receipt.output.text).toContain('Strong isolation is required');
    expect(receipt.safety.strongIsolationRequiredForUntrustedCli).toBe(true);
  });

  it('runs approved CLI profiles inside a Docker boundary when configured', async () => {
    const spawn = jest.fn().mockReturnValue({
      status: 0,
      stdout: 'sandbox-ok',
      stderr: '',
      signal: null,
    });
    const service = createService({ spawnSync: spawn as any });
    const root = path.dirname(service.registryFile);
    service.registerProfile({
      id: 'docker-cli',
      adapter: 'cli',
      root,
      command: 'agent-fixture',
      args: ['--mode', 'review'],
      enableLive: true,
      approvalGranted: true,
      isolation: 'docker',
      dockerImage: 'zavorth-agent-fixture:latest',
      readOnlyRoot: true,
      requireStrongIsolation: true,
    });

    const receipt = await service.invoke({
      profileId: 'docker-cli',
      prompt: 'review in sandbox',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('completed');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][0]).toBe('docker');
    expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining([
      'run',
      '--rm',
      '-i',
      '--network',
      'none',
      '--read-only',
      'zavorth-agent-fixture:latest',
      'agent-fixture',
      '--mode',
      'review',
    ]));
    expect(receipt.execution.isolationKind).toBe('docker');
    expect(receipt.execution.isolationStrongBoundary).toBe(true);
    expect(receipt.execution.sandboxCommand).toBe('docker run');
    expect(receipt.safety.filesystemSandboxClaimed).toBe(true);
    expect(receipt.output.text).toBe('sandbox-ok');
  });

  it('runs approved CLI profiles through WSL when configured', async () => {
    const spawn = jest.fn().mockReturnValue({
      status: 0,
      stdout: 'wsl-ok',
      stderr: '',
      signal: null,
    });
    const service = createService({ spawnSync: spawn as any });
    service.registerProfile({
      id: 'wsl-cli',
      adapter: 'cli',
      root: 'C:\\Users\\ermys\\agent-work',
      command: 'agent-fixture',
      enableLive: true,
      approvalGranted: true,
      isolation: 'wsl',
      wslDistro: 'Ubuntu-24.04',
      requireStrongIsolation: true,
    });

    const receipt = await service.invoke({
      profileId: 'wsl-cli',
      prompt: 'review through wsl',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('completed');
    expect(spawn.mock.calls[0][0]).toBe('wsl.exe');
    expect(spawn.mock.calls[0][1]).toEqual(expect.arrayContaining([
      '-d',
      'Ubuntu-24.04',
      '--cd',
      '/mnt/c/Users/ermys/agent-work',
      '--',
      'agent-fixture',
    ]));
    expect(receipt.execution.isolationKind).toBe('wsl');
    expect(receipt.execution.isolationStrongBoundary).toBe(true);
  });

  it('blocks remote HTTP endpoints unless explicitly allowed on the profile', async () => {
    const service = createService();
    service.registerProfile({
      id: 'remote-http',
      adapter: 'http',
      endpoint: 'https://example.com/agent',
      enableLive: true,
      approvalGranted: true,
    });

    const receipt = await service.invoke({
      profileId: 'remote-http',
      prompt: 'ping',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('blocked');
    expect(receipt.execution.liveNetworkPerformed).toBe(false);
    expect(receipt.output.text).toContain('Remote network endpoint is blocked');
  });

  it('invokes approved local HTTP profiles with sanitized receipt metadata', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('local-agent-ok'),
    });
    const service = createService({ fetch: fetch as any });
    service.registerProfile({
      id: 'local-http',
      adapter: 'http',
      endpoint: 'http://127.0.0.1:8765/agent',
      enableLive: true,
      approvalGranted: true,
    });

    const receipt = await service.invoke({
      profileId: 'local-http',
      prompt: 'ping',
      approvalGranted: true,
    });

    expect(receipt.status).toBe('completed');
    expect(fetch).toHaveBeenCalled();
    expect(receipt.execution.liveNetworkPerformed).toBe(true);
    expect(receipt.output.text).toBe('local-agent-ok');
    expect(receipt.safety.rawSecretsSerialized).toBe(false);
  });

  it('can delegate approved ACP profiles through the ACP session service', async () => {
    const acpSessionService = {
      run: jest.fn().mockResolvedValue({
        status: 'completed',
        session: {
          liveExecutionPerformed: true,
        },
        output: { text: 'acp-agent-ok' },
      }),
      renderText: jest.fn().mockReturnValue('acp-agent-ok'),
    };
    const service = createService({ acpSessionService: acpSessionService as any });
    service.registerProfile({
      id: 'acp-local',
      adapter: 'acp',
      acpServerId: 'local-acp',
      enableLive: true,
      approvalGranted: true,
    });

    const receipt = await service.invoke({
      profileId: 'acp-local',
      prompt: 'hello',
      approvalGranted: true,
    });

    expect(acpSessionService.run).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'hello',
      serverId: 'local-acp',
      transport: 'mock-jsonrpc',
    }));
    expect(receipt.status).toBe('completed');
    expect(receipt.output.text).toContain('acp-agent-ok');
  });
});

function createService(options: Record<string, any> = {}): ZavorthExternalAgentGatewayService {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-external-agent-gateway-'));
  return new ZavorthExternalAgentGatewayService({
    now: () => new Date('2026-05-17T02:00:00.000Z'),
    projectRoot: root,
    registryFile: path.join(root, 'profiles.json'),
    spawnSync,
    ...options,
  });
}
