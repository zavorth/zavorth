import fs from 'fs';
import path from 'path';
import type {
  NodeHostCapabilityRuntime,
  NodeHostCommandInvocation,
  NodeHostCommandRunner,
  NodeHostExecutionResult,
} from './NodeHostCapabilityTypes.js';
import {
  buildNodeHostBrowserOpenCommand,
  buildNodeHostClipboardCommands,
  buildNodeHostClipboardWriteCommands,
  buildNodeHostIdentitySnapshot,
  buildNodeHostNotificationCommands,
  buildNodeHostScreenCaptureCommands,
  normalizeNodeHostBrowserTargetUrl,
  normalizeNodeHostBrowserUrl,
  normalizeNodeHostLocationPayload,
  resolveNodeHostCapturePath,
} from './NodeHostCapabilityHelpers.js';
import {
  buildScopeViolationResult,
  resolveAllowedPath as resolveNodeHostAllowedPath,
} from './NodeHostCapabilityPathPolicy.js';
import { inferImageMimeType, normalizeTimeout } from './NodeHostCapabilityExecutionHelpers.js';
import { ShellNodeHostCommandRunner } from './NodeHostCapabilityShellCommandRunner.js';

export class NodeHostCapabilityHostSurfaceService {
  private readonly now: () => Date;
  private readonly platform: NodeJS.Platform;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly allowedRoots: string[];
  private readonly env: NodeJS.ProcessEnv;
  private readonly commandRunner: NodeHostCommandRunner;

  constructor(runtime: NodeHostCapabilityRuntime) {
    this.now = runtime.now || (() => new Date());
    this.platform = runtime.platform || process.platform;
    this.workspaceRoot = path.resolve(runtime.workspaceRoot || process.cwd());
    this.tempRoot = runtime.tempRoot
      ? path.resolve(runtime.tempRoot)
      : path.resolve(this.workspaceRoot, 'data', 'runtime', 'node-host');
    this.env = runtime.env || process.env;
    this.allowedRoots = Array.isArray(runtime.allowedRoots) ? runtime.allowedRoots.map((entry) => path.resolve(entry)) : [this.workspaceRoot, this.tempRoot];
    this.commandRunner = runtime.commandRunner || new ShellNodeHostCommandRunner();
  }

  public async proxyBrowser(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const requestedTargetUrl = payload?.targetUrl || payload?.url || payload?.pageUrl || payload?.browserUrl || null;
    const targetUrl = normalizeNodeHostBrowserTargetUrl(
      requestedTargetUrl,
      {
        allowedRoots: this.allowedRoots,
        env: this.env,
      },
    );
    const proxyUrl = normalizeNodeHostBrowserUrl(
      payload?.proxyUrl || payload?.endpoint || payload?.wsEndpoint || payload?.debugUrl || null,
    );

    if (proxyUrl) {
      return {
        ok: true,
        resultSummary: 'Endpoint de browser/proxy confirmado no node host.',
        stdout: proxyUrl,
        stderr: null,
        exitCode: 0,
        data: {
          endpoint: proxyUrl,
          targetUrl,
          mode: 'endpoint',
        },
      };
    }

    if (!targetUrl) {
      const hadTargetUrl = Boolean(String(requestedTargetUrl || '').trim());
      return {
        ok: false,
        resultSummary: hadTargetUrl
          ? 'browser.proxy bloqueou uma URL fora da politica do node host.'
          : 'browser.proxy precisa de payload.url ou payload.proxyUrl.',
        stdout: null,
        stderr: hadTargetUrl
          ? 'payload.url deve usar http/https; file: exige opt-in e caminho dentro das raizes permitidas'
          : 'payload.url ausente',
        exitCode: null,
        data: null,
      };
    }

    const result = await this.commandRunner.run(this.toCommandInvocation(buildNodeHostBrowserOpenCommand(this.platform, targetUrl)), {
      cwd: this.workspaceRoot,
      timeoutMs: normalizeTimeout(payload?.timeoutMs, 15000),
    });

    return {
      ok: result.ok,
      resultSummary: result.ok
        ? `Navegador aberto no node host para ${targetUrl}.`
        : `Nao consegui abrir o navegador para ${targetUrl}.`,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      data: {
        targetUrl,
        mode: 'open-default-browser',
        platform: this.platform,
      },
    };
  }

  public async describeDevice(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const hostIdentity = buildNodeHostIdentitySnapshot({
      platform: this.platform,
      workspaceRoot: this.workspaceRoot,
      tempRoot: this.tempRoot,
      allowedRoots: this.allowedRoots,
      env: this.env,
    }) as Record<string, unknown> & { hostname: string };
    const info = {
      ...hostIdentity,
      deviceModel: String(payload?.deviceModel || this.env.ZAVORTH_NODE_HOST_DEVICE_MODEL || '').trim() || null,
      appVersion: String(payload?.appVersion || this.env.ZAVORTH_NODE_HOST_APP_VERSION || '').trim() || null,
      networkType: String(payload?.networkType || this.env.ZAVORTH_NODE_HOST_NETWORK_TYPE || '').trim() || null,
      locationLabel: String(payload?.locationLabel || this.env.ZAVORTH_NODE_HOST_LOCATION_LABEL || '').trim() || null,
      capturedAt: this.now().toISOString(),
    };

    return {
      ok: true,
      resultSummary: `Identidade do node host coletada para ${hostIdentity.hostname}.`,
      stdout: JSON.stringify(info, null, 2),
      stderr: null,
      exitCode: 0,
      data: info,
    };
  }

  public async captureScreen(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const requestedOutputPath = String(payload?.outputPath || payload?.path || payload?.filePath || '').trim();
    let outputPath: string;
    try {
      outputPath = resolveNodeHostCapturePath({
        payload,
        tempRoot: this.tempRoot,
        now: this.now,
        resolveAllowedPath: (targetPath, capabilityId) => this.resolveAllowedPath(targetPath, capabilityId),
      });
    } catch (error: any) {
      return buildScopeViolationResult({
        capabilityId: 'screen.capture',
        targetPath: requestedOutputPath || path.resolve(this.tempRoot, 'captures'),
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const attempts = buildNodeHostScreenCaptureCommands(this.platform, outputPath);
    const timeoutMs = normalizeTimeout(payload?.timeoutMs, 20000);
    const errors: string[] = [];

    for (const attempt of attempts) {
      const result = await this.commandRunner.run(this.toCommandInvocation(attempt), {
        timeoutMs,
      });
      if (result.ok && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        return {
          ok: true,
          resultSummary: `Captura de tela salva em ${outputPath}.`,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 0,
          data: {
            method: attempt.label,
            path: outputPath,
            mimeType: 'image/png',
            bytes: stats.size,
            capturedAt: this.now().toISOString(),
          },
        };
      }
      errors.push(`${attempt.label}: ${result.stderr || `exit ${result.exitCode ?? 'unknown'}`}`);
    }

    return {
      ok: false,
      resultSummary: 'Nao consegui capturar a tela neste node host.',
      stdout: null,
      stderr: errors.join(' | ') || 'screen capture unsupported',
      exitCode: null,
      data: {
        path: outputPath,
        platform: this.platform,
      },
    };
  }

  public async captureCamera(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const requestedOutputPath = String(payload?.outputPath || payload?.path || payload?.filePath || '').trim();
    let outputPath: string;
    try {
      outputPath = resolveNodeHostCapturePath({
        payload,
        tempRoot: this.tempRoot,
        now: this.now,
        resolveAllowedPath: (targetPath, capabilityId) => this.resolveAllowedPath(targetPath, capabilityId),
        capabilityId: 'camera.capture',
        prefix: 'camera',
      });
    } catch (error: any) {
      return buildScopeViolationResult({
        capabilityId: 'camera.capture',
        targetPath: requestedOutputPath || path.resolve(this.tempRoot, 'captures'),
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const inlineBase64 = String(payload?.contentBase64 || '').trim();
    if (inlineBase64) {
      const buffer = Buffer.from(inlineBase64, 'base64');
      fs.writeFileSync(outputPath, buffer);
      return {
        ok: true,
        resultSummary: `Captura de camera salva em ${outputPath}.`,
        stdout: outputPath,
        stderr: null,
        exitCode: 0,
        data: {
          method: 'base64-payload',
          path: outputPath,
          mimeType: inferImageMimeType(outputPath),
          bytes: buffer.length,
          capturedAt: this.now().toISOString(),
        },
      };
    }

    const rawSourcePath = String(
      payload?.sourcePath
      || payload?.inputPath
      || payload?.fixturePath
      || this.env.ZAVORTH_NODE_HOST_CAMERA_SOURCE
      || '',
    ).trim();
    if (!rawSourcePath) {
      return {
        ok: false,
        resultSummary: 'camera.capture precisa de payload.sourcePath, payload.contentBase64 ou ZAVORTH_NODE_HOST_CAMERA_SOURCE.',
        stdout: null,
        stderr: 'camera source ausente',
        exitCode: null,
        data: {
          path: outputPath,
        },
      };
    }

    let sourcePath: string;
    try {
      sourcePath = this.resolveAllowedPath(rawSourcePath, 'camera.capture');
    } catch (error: any) {
      return buildScopeViolationResult({
        capabilityId: 'camera.capture',
        targetPath: rawSourcePath,
        error,
        workspaceRoot: this.workspaceRoot,
        allowedRoots: this.allowedRoots,
      });
    }

    if (!fs.existsSync(sourcePath)) {
      return {
        ok: false,
        resultSummary: 'camera.capture nao encontrou o artefato de camera solicitado.',
        stdout: null,
        stderr: `ENOENT: ${sourcePath}`,
        exitCode: null,
        data: {
          path: outputPath,
          sourcePath,
        },
      };
    }

    fs.copyFileSync(sourcePath, outputPath);
    const stats = fs.statSync(outputPath);
    return {
      ok: true,
      resultSummary: `Captura de camera salva em ${outputPath}.`,
      stdout: outputPath,
      stderr: null,
      exitCode: 0,
      data: {
        method: 'file-copy',
        path: outputPath,
        sourcePath,
        mimeType: inferImageMimeType(outputPath),
        bytes: stats.size,
        capturedAt: this.now().toISOString(),
      },
    };
  }

  public async readLocation(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const direct = normalizeNodeHostLocationPayload(payload);
    if (direct) {
      return {
        ok: true,
        resultSummary: `Localizacao do node host lida${direct.label ? ` para ${direct.label}` : ''}.`,
        stdout: JSON.stringify(direct, null, 2),
        stderr: null,
        exitCode: 0,
        data: {
          method: 'payload',
          ...direct,
        },
      };
    }

    const rawSourcePath = String(payload?.sourcePath || payload?.path || this.env.ZAVORTH_NODE_HOST_LOCATION_FILE || '').trim();
    if (rawSourcePath) {
      let sourcePath: string;
      try {
        sourcePath = this.resolveAllowedPath(rawSourcePath, 'location.read');
      } catch (error: any) {
        return buildScopeViolationResult({
          capabilityId: 'location.read',
          targetPath: rawSourcePath,
          error,
          workspaceRoot: this.workspaceRoot,
          allowedRoots: this.allowedRoots,
        });
      }

      if (!fs.existsSync(sourcePath)) {
        return {
          ok: false,
          resultSummary: 'location.read nao encontrou o arquivo de localizacao solicitado.',
          stdout: null,
          stderr: `ENOENT: ${sourcePath}`,
          exitCode: null,
          data: {
            sourcePath,
          },
        };
      }

      let parsedFile: Record<string, unknown> | null = null;
      try {
        parsedFile = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      } catch (error: any) {
        return {
          ok: false,
          resultSummary: 'location.read nao conseguiu ler o arquivo de localizacao informado.',
          stdout: null,
          stderr: error instanceof Error ? error.message : String(error || 'invalid location file'),
          exitCode: null,
          data: {
            sourcePath,
          },
        };
      }

      const parsed = normalizeNodeHostLocationPayload(parsedFile);
      if (!parsed) {
        return {
          ok: false,
          resultSummary: 'location.read nao conseguiu interpretar o arquivo de localizacao informado.',
          stdout: null,
          stderr: `location payload invalido: ${sourcePath}`,
          exitCode: null,
          data: {
            sourcePath,
          },
        };
      }

      return {
        ok: true,
        resultSummary: `Localizacao do node host lida${parsed.label ? ` para ${parsed.label}` : ''}.`,
        stdout: JSON.stringify(parsed, null, 2),
        stderr: null,
        exitCode: 0,
        data: {
          method: 'file',
          sourcePath,
          ...parsed,
        },
      };
    }

    const envLocation = normalizeNodeHostLocationPayload({
      latitude: this.env.ZAVORTH_NODE_HOST_LOCATION_LAT,
      longitude: this.env.ZAVORTH_NODE_HOST_LOCATION_LNG,
      accuracyMeters: this.env.ZAVORTH_NODE_HOST_LOCATION_ACCURACY_METERS,
      label: this.env.ZAVORTH_NODE_HOST_LOCATION_LABEL,
    });
    if (envLocation) {
      return {
        ok: true,
        resultSummary: `Localizacao do node host lida${envLocation.label ? ` para ${envLocation.label}` : ''}.`,
        stdout: JSON.stringify(envLocation, null, 2),
        stderr: null,
        exitCode: 0,
        data: {
          method: 'env',
          ...envLocation,
        },
      };
    }

    return {
      ok: false,
      resultSummary: 'location.read ainda precisa de payload de localizacao, arquivo ou variaveis de ambiente configuradas.',
      stdout: null,
      stderr: 'location source ausente',
      exitCode: null,
      data: {
        expected: ['payload.latitude/longitude', 'payload.sourcePath', 'ZAVORTH_NODE_HOST_LOCATION_FILE'],
      },
    };
  }

  public async readClipboard(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const attempts = buildNodeHostClipboardCommands(this.platform);
    const timeoutMs = normalizeTimeout(payload?.timeoutMs, 10000);
    const errors: string[] = [];

    for (const attempt of attempts) {
      const result = await this.commandRunner.run(this.toCommandInvocation(attempt), {
        timeoutMs,
      });
      if (result.ok) {
        const text = result.stdout ?? '';
        return {
          ok: true,
          resultSummary: 'Clipboard lido do node host.',
          stdout: text,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 0,
          data: {
            method: attempt.label,
            length: text.length,
          },
        };
      }
      errors.push(`${attempt.label}: ${result.stderr || `exit ${result.exitCode ?? 'unknown'}`}`);
    }

    return {
      ok: false,
      resultSummary: 'Nao consegui ler o clipboard neste node host.',
      stdout: null,
      stderr: errors.join(' | ') || 'clipboard unsupported',
      exitCode: null,
      data: {
        platform: this.platform,
      },
    };
  }

  public async writeClipboard(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const text = typeof payload?.text === 'string'
      ? String(payload.text)
      : typeof payload?.content === 'string'
        ? String(payload.content)
        : typeof payload?.value === 'string'
          ? String(payload.value)
          : '';
    if (!text) {
      return {
        ok: false,
        resultSummary: 'clipboard.write precisa de payload.text, payload.content ou payload.value.',
        stdout: null,
        stderr: 'clipboard text ausente',
        exitCode: null,
        data: null,
      };
    }

    const maxChars = Math.max(1, Math.min(65536, Number(payload?.maxChars || 8192) || 8192));
    if (text.length > maxChars) {
      return {
        ok: false,
        resultSummary: `clipboard.write bloqueou texto acima de ${maxChars} caractere(s).`,
        stdout: null,
        stderr: `clipboard payload excede limite seguro de ${maxChars} caractere(s)`,
        exitCode: null,
        data: {
          length: text.length,
          maxChars,
        },
      };
    }

    const attempts = buildNodeHostClipboardWriteCommands(this.platform, text);
    const timeoutMs = normalizeTimeout(payload?.timeoutMs, 10000);
    const errors: string[] = [];

    for (const attempt of attempts) {
      const result = await this.commandRunner.run(this.toCommandInvocation(attempt), {
        timeoutMs,
      });
      if (result.ok) {
        return {
          ok: true,
          resultSummary: 'Clipboard escrito no node host.',
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 0,
          data: {
            method: attempt.label,
            length: text.length,
          },
        };
      }
      errors.push(`${attempt.label}: ${result.stderr || `exit ${result.exitCode ?? 'unknown'}`}`);
    }

    return {
      ok: false,
      resultSummary: 'Nao consegui escrever no clipboard neste node host.',
      stdout: null,
      stderr: errors.join(' | ') || 'clipboard write unsupported',
      exitCode: null,
      data: {
        platform: this.platform,
      },
    };
  }

  public async sendNotification(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const title = String(payload?.title || 'Zavorth').trim() || 'Zavorth';
    const body = String(payload?.message || payload?.body || 'Notificacao do Node Mesh.').trim()
      || 'Notificacao do Node Mesh.';
    const attempts = buildNodeHostNotificationCommands(this.platform, title, body);
    const timeoutMs = normalizeTimeout(payload?.timeoutMs, 15000);
    const errors: string[] = [];

    for (const attempt of attempts) {
      const result = await this.commandRunner.run(this.toCommandInvocation(attempt), {
        timeoutMs,
      });
      if (result.ok) {
        return {
          ok: true,
          resultSummary: 'Notificacao enviada pelo node host.',
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode ?? 0,
          data: {
            method: attempt.label,
            title,
            body,
          },
        };
      }
      errors.push(`${attempt.label}: ${result.stderr || `exit ${result.exitCode ?? 'unknown'}`}`);
    }

    return {
      ok: false,
      resultSummary: 'Nao consegui exibir a notificacao neste node host.',
      stdout: null,
      stderr: errors.join(' | ') || 'notification unsupported',
      exitCode: null,
      data: {
        title,
        body,
        platform: this.platform,
      },
    };
  }

  public async confirmDeviceAction(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const userPresent = payload?.userPresent === true || payload?.confirmed === true;
    const challenge = String(payload?.challenge || '').trim();
    const credentialId = String(payload?.credentialId || payload?.credential || '').trim();
    const action = String(payload?.action || payload?.command || 'device action').trim();

    if (!userPresent) {
      return {
        ok: false,
        resultSummary: 'device.confirm exige presenca explicita do usuario no dispositivo pareado.',
        stdout: null,
        stderr: 'user presence missing',
        exitCode: null,
        data: {
          action,
          method: challenge || credentialId ? 'webauthn-compatible' : 'manual-presence',
          userPresent: false,
        },
      };
    }

    return {
      ok: true,
      resultSummary: `Confirmacao sensivel aprovada no dispositivo para ${action}.`,
      stdout: JSON.stringify({
        action,
        confirmedAt: this.now().toISOString(),
        method: challenge || credentialId ? 'webauthn-compatible' : 'manual-presence',
      }, null, 2),
      stderr: null,
      exitCode: 0,
      data: {
        action,
        method: challenge || credentialId ? 'webauthn-compatible' : 'manual-presence',
        challengePresent: Boolean(challenge),
        credentialPresent: Boolean(credentialId),
        userPresent: true,
        confirmedAt: this.now().toISOString(),
        secretValuesSerialized: false,
      },
    };
  }

  public async vibrateHaptic(payload: Record<string, unknown> | null): Promise<Omit<NodeHostExecutionResult, 'invocationId'>> {
    const supported = payload?.supported !== false;
    const pattern = Array.isArray(payload?.pattern)
      ? payload.pattern
          .map((entry) => Math.max(0, Math.min(1000, Number(entry) || 0)))
          .filter((entry) => Number.isFinite(entry))
      : [40];

    if (!supported) {
      return {
        ok: false,
        resultSummary: 'haptics.vibrate nao esta disponivel neste companion; a limitacao foi registrada explicitamente.',
        stdout: null,
        stderr: 'navigator.vibrate unsupported',
        exitCode: null,
        data: {
          supported: false,
          unsupportedNativeApiExplicit: true,
        },
      };
    }

    return {
      ok: true,
      resultSummary: 'Pulso haptico aceito pelo companion quando navigator.vibrate esta disponivel.',
      stdout: JSON.stringify({ pattern }, null, 2),
      stderr: null,
      exitCode: 0,
      data: {
        method: 'navigator.vibrate-compatible',
        supported: true,
        pattern,
        triggeredAt: this.now().toISOString(),
      },
    };
  }

  private resolveAllowedPath(targetPath: string, capabilityId: string): string {
    return resolveNodeHostAllowedPath({
      targetPath,
      capabilityId,
      workspaceRoot: this.workspaceRoot,
      allowedRoots: this.allowedRoots,
    });
  }

  private toCommandInvocation(input: { command: string; file?: string; args?: string[]; label?: string }): NodeHostCommandInvocation {
    return input.file
      ? {
          label: input.label,
          command: input.command,
          file: input.file,
          args: input.args || [],
        }
      : input.command;
  }
}
