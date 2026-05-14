import { BaseTool } from './BaseTool.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { DockerSandboxRuntime } from '../services/sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime } from '../services/sandbox/FirecrackerSandboxRuntime.js';
import type { SandboxLanguage } from '../services/sandbox/ISandboxRuntime.js';
import { LocalJailSandboxRuntime } from '../services/sandbox/LocalJailSandboxRuntime.js';
import { SandboxPolicyService } from '../services/sandbox/SandboxPolicyService.js';
import { WasmSandboxRuntime } from '../services/sandbox/WasmSandboxRuntime.js';
import { WasmSandboxCapabilityService } from '../services/WasmSandboxCapabilityService.js';

type SandboxToolLanguage = SandboxLanguage | 'wasm';

/**
 * SandboxExecutionTool - executa experimentos com 4 caminhos de isolamento:
 *
 *   1. wasm         -> modulo Wasm precompilado em runtime host restrito
 *   2. local-jail   -> Processo efemero local (rapido, para codigo confiavel)
 *   3. container    -> Docker + gVisor (codigo sensivel, shell, rede)
 *   4. microvm      -> Firecracker MicroVM (codigo de alto risco, usuarios nao-confiaveis)
 */
export class SandboxExecutionTool extends BaseTool {
  public readonly name = 'run_sandbox_code';
  public readonly description =
    'Executa um script Javascript, Python, Shell ou um modulo Wasm precompilado em um runtime isolado. ' +
    'Usa Wasm para modulos binarios pequenos e controlados, local-jail para experimentos leves, ' +
    'container Docker+gVisor para scripts sensiveis e Firecracker MicroVM para codigo de alto risco.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Linguagem do script a ser testado, ou wasm para modulo WebAssembly precompilado em base64.',
        enum: ['javascript', 'python', 'shell', 'wasm'],
      },
      code: {
        type: 'string',
        description: 'Codigo literal a executar na sandbox, ou o modulo Wasm em base64 quando language=wasm.',
      },
      security_level: {
        type: 'string',
        description:
          'Nivel desejado: auto escolhe pela politica, wasm roda modulo precompilado restrito, ' +
          'local-jail prioriza runtime leve, container exige Docker+gVisor, microvm exige Firecracker MicroVM.',
        enum: ['auto', 'wasm', 'local-jail', 'container', 'microvm'],
      },
      export_name: {
        type: 'string',
        description: 'Nome do export do modulo Wasm a ser chamado quando language=wasm.',
      },
      args_json: {
        type: 'string',
        description: 'JSON array com argumentos numericos para o export Wasm, por exemplo [2,3].',
      },
      timeout_ms: {
        type: 'string',
        description: 'Timeout opcional em milissegundos para a execucao.',
      },
    },
    required: ['language', 'code'],
  };

  private readonly localJail = new LocalJailSandboxRuntime();
  private readonly wasmSandbox = new WasmSandboxRuntime();
  private readonly dockerSandbox = new DockerSandboxRuntime();
  private readonly firecrackerSandbox = new FirecrackerSandboxRuntime();
  private readonly sandboxPolicy = new SandboxPolicyService();
  private readonly wasmCapability = new WasmSandboxCapabilityService();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const language = String(args.language || '').trim().toLowerCase() as SandboxToolLanguage;
    const code = String(args.code || '');
    const preferredLevel = String(args.security_level || 'auto') as
      | 'auto'
      | 'wasm'
      | 'local-jail'
      | 'container'
      | 'microvm';
    const timeoutMs = Number(args.timeout_ms || 15_000);

    if (language === 'wasm') {
      return this.executeWasmModule(code, args, preferredLevel, timeoutMs);
    }

    const policy = this.sandboxPolicy.resolveCodeExecutionPolicy(language as SandboxLanguage, code, preferredLevel);

    try {
      const securityLevel = policy.securityLevel;
      if (securityLevel === 'wasm') {
        throw new Error(
          'Politica invalida: securityLevel=wasm so pode ser usado quando language=wasm.',
        );
      }

      const runtime = this.resolveRuntime(
        securityLevel as 'local-jail' | 'container' | 'microvm',
        language as SandboxLanguage,
      );
      const result = await runtime.execute({
        code,
        language: language as SandboxLanguage,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
      });

      let out = `Sandbox ${result.securityLevel} (${result.runtime}) - exit code ${result.exitCode} - ${result.executionTimeMs}ms\n`;
      out += `Motivo da politica: ${policy.reason}\n`;
      if (result.stdout) {
        out += `--- STDOUT ---\n${result.stdout}\n`;
      }
      if (result.stderr) {
        out += `--- STDERR ---\n${result.stderr}\n`;
      }

      return out;
    } catch (error: any) {
      return `Sandbox failure (${policy.securityLevel}): ${error.message}`;
    }
  }

  private async executeWasmModule(
    moduleBase64: string,
    rawArgs: Record<string, unknown>,
    preferredLevel: 'auto' | 'wasm' | 'local-jail' | 'container' | 'microvm',
    timeoutMs: number,
  ): Promise<string> {
    if (preferredLevel === 'container' || preferredLevel === 'microvm' || preferredLevel === 'local-jail') {
      return 'Sandbox failure (wasm): modulos Wasm precompilados so suportam os niveis auto/wasm neste caminho inicial.';
    }

    const wasmStatus = this.wasmCapability.getStatus('wasm');
    if (!wasmStatus.canRun) {
      return `Sandbox failure (wasm): ${wasmStatus.detail}`;
    }

    const parsedArgs = this.parseWasmArgs(rawArgs.args_json);
    if (!parsedArgs.ok) {
      return `Sandbox failure (wasm): ${parsedArgs.error}`;
    }

    const result = await this.wasmSandbox.execute({
      moduleBase64,
      exportName: String(rawArgs.export_name || '').trim() || null,
      args: parsedArgs.value,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    });

    let out = `Sandbox ${result.securityLevel} (${result.runtime}) - exit code ${result.exitCode} - ${result.executionTimeMs}ms\n`;
    out += 'Motivo da politica: modulo Wasm precompilado em runtime restrito.\n';
    out += `Export selecionado: ${result.selectedExport || 'auto'}\n`;
    if (result.returnValue) {
      out += `Return value: ${result.returnValue}\n`;
    }
    if (result.stdout) {
      out += `--- STDOUT ---\n${result.stdout}\n`;
    }
    if (result.stderr) {
      out += `--- STDERR ---\n${result.stderr}\n`;
    }
    return out;
  }

  /**
   * Resolve qual runtime usar com base no nivel de seguranca exigido.
   * Implementa fallback automatico:
   *   microvm indisponivel -> tenta container
   *   container indisponivel -> bloqueia execucao (nao rebaixa para local-jail)
   */
  private resolveRuntime(
    securityLevel: 'local-jail' | 'container' | 'microvm' | 'wasm',
    language: SandboxLanguage,
  ) {
    if (securityLevel === 'wasm') {
      throw new Error(
        'Execucao bloqueada: nivel wasm so e valido para modulos WebAssembly precompilados com language=wasm.',
      );
    }

    if (securityLevel === 'microvm') {
      if (this.firecrackerSandbox.isAvailable()) {
        return this.firecrackerSandbox;
      }

      const dockerStatus = this.dockerSandbox.getStatus(language);
      if (dockerStatus.canRun) {
        return this.dockerSandbox;
      }

      throw new Error(
        'Execucao bloqueada: codigo de alto risco requer MicroVM (Firecracker) ou container (Docker+gVisor), ' +
        'mas nenhum dos dois esta disponivel neste host. ' +
        'Instale o Firecracker ou configure o Docker com gVisor.',
      );
    }

    if (securityLevel === 'container') {
      const dockerStatus = this.dockerSandbox.getStatus(language);
      if (!dockerStatus.daemonReachable && !dockerStatus.canRun) {
        throw new Error(
          `Sandbox bloqueada: a politica exigiu container Docker (gVisor), ` +
          `mas o runtime forte nao esta pronto neste host. Detalhe: ${dockerStatus.detail}`,
        );
      }
      return this.dockerSandbox;
    }

    return this.localJail;
  }

  private parseWasmArgs(rawValue: unknown): { ok: true; value: number[] } | { ok: false; error: string } {
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      return { ok: true, value: [] };
    }

    try {
      const parsed = JSON.parse(normalized);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'args_json precisa ser um array JSON.' };
      }
      const numericArgs = parsed.map((entry) => Number(entry));
      if (numericArgs.some((entry) => !Number.isFinite(entry))) {
        return { ok: false, error: 'args_json aceita apenas numeros finitos.' };
      }
      return { ok: true, value: numericArgs };
    } catch (error: any) {
      return { ok: false, error: `args_json invalido: ${error.message}` };
    }
  }
}
