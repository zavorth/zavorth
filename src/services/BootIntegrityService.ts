import fs from 'fs';
import path from 'path';

import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type BootIntegrityCheckKind =
  | 'directory'
  | 'database'
  | 'runtime-file'
  | 'telemetry'
  | 'config-file';

export type BootIntegrityCheckStatus = 'pass' | 'warn' | 'fail';

export type BootIntegrityOverallStatus = 'ready' | 'degraded' | 'blocked';

export type BootIntegrityCheck = {
  id: string;
  label: string;
  kind: BootIntegrityCheckKind;
  required: boolean;
  status: BootIntegrityCheckStatus;
  path: string;
  message: string;
  repaired: boolean;
  metadata: Record<string, unknown>;
};

export type BootIntegritySnapshot = {
  phase: '35';
  surface: 'boot-integrity';
  generatedAt: string;
  status: BootIntegrityOverallStatus;
  projectRoot: string;
  checks: BootIntegrityCheck[];
  summary: {
    passed: number;
    warnings: number;
    failures: number;
    repaired: number;
    total: number;
  };
  contracts: {
    noExternalNetwork: true;
    startsBackgroundProcesses: false;
    canRepairDirectories: boolean;
  };
};

export type BootIntegrityInspectOptions = {
  repair?: boolean;
};

type BootIntegrityRuntimeConfig = {
  projectRoot?: string;
  dataDir?: string;
  tmpDir?: string;
  dbPath?: string;
  telemetryEventsFile?: string;
  zavorthControlRuntimeStateFile?: string;
  workflowRunDir?: string;
  gatewaySessionLedgerDir?: string;
  hostIdentityFile?: string;
  platformRegistryCatalogFile?: string;
  mcpServersManifestPath?: string;
};

type BootIntegrityRuntime = {
  config?: BootIntegrityRuntimeConfig;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
  mkdirSync?: typeof fs.mkdirSync;
  accessSync?: typeof fs.accessSync;
  readFileSync?: typeof fs.readFileSync;
};

type BootIntegritySpec = {
  id: string;
  label: string;
  kind: BootIntegrityCheckKind;
  path: string;
  required: boolean;
  repairable?: boolean;
  parseJson?: boolean;
  noteWhenMissing?: string;
};

export class BootIntegrityService {
  private readonly runtimeConfig: BootIntegrityRuntimeConfig;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly statSync: typeof fs.statSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly accessSync: typeof fs.accessSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: BootIntegrityRuntime = {}) {
    this.runtimeConfig = runtime.config || config;
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.accessSync = runtime.accessSync || fs.accessSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public inspect(options: BootIntegrityInspectOptions = {}): BootIntegritySnapshot {
    const repair = Boolean(options.repair);
    const checks = this.buildSpecs().map((spec) => this.runCheck(spec, repair));
    const failures = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const repaired = checks.filter((check) => check.repaired).length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '35',
      surface: 'boot-integrity',
      generatedAt: this.now().toISOString(),
      status: failures > 0 ? 'blocked' : warnings > 0 ? 'degraded' : 'ready',
      projectRoot: this.resolvePath(this.runtimeConfig.projectRoot || process.cwd()),
      checks,
      summary: {
        passed,
        warnings,
        failures,
        repaired,
        total: checks.length,
      },
      contracts: {
        noExternalNetwork: true,
        startsBackgroundProcesses: false,
        canRepairDirectories: repair,
      },
    };
  }

  private buildSpecs(): BootIntegritySpec[] {
    const runtimeDir = this.dirname(
      this.runtimeConfig.telemetryEventsFile
      || this.runtimeConfig.zavorthControlRuntimeStateFile
      || path.join(this.runtimeConfig.dataDir || 'data', 'runtime', 'placeholder'),
    );

    return [
      {
        id: 'project-root',
        label: 'raiz do projeto',
        kind: 'directory',
        path: this.runtimeConfig.projectRoot || process.cwd(),
        required: true,
        repairable: false,
      },
      {
        id: 'data-dir',
        label: 'diretorio de dados',
        kind: 'directory',
        path: this.runtimeConfig.dataDir || path.resolve(process.cwd(), 'data'),
        required: true,
      },
      {
        id: 'tmp-dir',
        label: 'diretorio temporario',
        kind: 'directory',
        path: this.runtimeConfig.tmpDir || path.resolve(process.cwd(), 'tmp'),
        required: true,
      },
      {
        id: 'runtime-dir',
        label: 'diretorio de runtime',
        kind: 'directory',
        path: runtimeDir,
        required: true,
      },
      {
        id: 'workflow-run-dir',
        label: 'diretorio de execucoes de workflow',
        kind: 'directory',
        path: this.runtimeConfig.workflowRunDir || path.join(runtimeDir, 'workflow-runs'),
        required: true,
      },
      {
        id: 'gateway-session-ledger-dir',
        label: 'ledger de sessoes do gateway',
        kind: 'directory',
        path: this.runtimeConfig.gatewaySessionLedgerDir || path.join(runtimeDir, 'gateway-session-ledger'),
        required: true,
      },
      {
        id: 'sqlite-db',
        label: 'banco SQLite principal',
        kind: 'database',
        path: this.runtimeConfig.dbPath || path.resolve(process.cwd(), 'data', 'zavorth.db'),
        required: false,
        noteWhenMissing: 'o SQLite pode criar o banco sob demanda, mas a ausencia fica visivel no boot',
      },
      {
        id: 'telemetry-jsonl',
        label: 'ledger local de telemetria',
        kind: 'telemetry',
        path: this.runtimeConfig.telemetryEventsFile || path.join(runtimeDir, 'telemetry-events.jsonl'),
        required: false,
        noteWhenMissing: 'nenhum evento local foi registrado ainda',
      },
      {
        id: 'zavorthControl-runtime-state',
        label: 'estado runtime do zavorthControl',
        kind: 'runtime-file',
        path: this.runtimeConfig.zavorthControlRuntimeStateFile || path.join(runtimeDir, 'zavorthControl-runtime.json'),
        required: false,
        parseJson: true,
        noteWhenMissing: 'zavorthControl ainda nao publicou estado runtime neste host',
      },
      {
        id: 'host-identity',
        label: 'identidade confiavel do host',
        kind: 'runtime-file',
        path: this.runtimeConfig.hostIdentityFile || path.join(runtimeDir, 'authorized-host.json'),
        required: false,
        parseJson: true,
        noteWhenMissing: 'host ainda nao foi confiado neste ambiente',
      },
      {
        id: 'platform-registry',
        label: 'catalogo de plataformas',
        kind: 'config-file',
        path: this.runtimeConfig.platformRegistryCatalogFile || path.resolve(process.cwd(), 'config', 'platform-registry.json'),
        required: true,
        parseJson: true,
      },
      {
        id: 'mcp-manifest',
        label: 'manifesto MCP',
        kind: 'config-file',
        path: this.runtimeConfig.mcpServersManifestPath || path.resolve(process.cwd(), 'config', 'mcp-servers.json'),
        required: true,
        parseJson: true,
      },
    ];
  }

  private runCheck(spec: BootIntegritySpec, repair: boolean): BootIntegrityCheck {
    const targetPath = this.resolvePath(spec.path);
    const metadata: Record<string, unknown> = {};

    if (!targetPath) {
      return this.buildCheck(spec, targetPath, 'fail', 'caminho nao configurado', false, metadata);
    }

    const exists = this.existsSync(targetPath);
    if (!exists && spec.kind === 'directory' && repair && spec.repairable !== false) {
      try {
        this.mkdirSync(targetPath, { recursive: true });
        metadata.created = true;
        return this.buildCheck(spec, targetPath, 'pass', 'diretorio criado durante o smoke de boot', true, metadata);
      } catch (error: unknown) {logger.warn('[Boot Integrity] filesystem operation failed', error);
    return this.buildCheck(
          spec,
          targetPath,
          'fail',
          `nao foi possivel criar diretorio: ${this.errorMessage(error)}`,
          false,
          metadata,
        );
  }
    }

    if (!exists) {
      const status: BootIntegrityCheckStatus = spec.required ? 'fail' : 'warn';
      return this.buildCheck(
        spec,
        targetPath,
        status,
        spec.noteWhenMissing || (spec.required ? 'recurso obrigatorio ausente' : 'recurso opcional ausente'),
        false,
        metadata,
      );
    }

    return spec.kind === 'directory'
      ? this.checkDirectory(spec, targetPath, metadata)
      : this.checkFile(spec, targetPath, metadata);
  }

  private checkDirectory(
    spec: BootIntegritySpec,
    targetPath: string,
    metadata: Record<string, unknown>,
  ): BootIntegrityCheck {
    try {
      const stat = this.statSync(targetPath);
      metadata.size = stat.size;
      if (!stat.isDirectory()) {
        return this.buildCheck(spec, targetPath, 'fail', 'caminho existe, mas nao e diretorio', false, metadata);
      }
      this.accessSync(targetPath, fs.constants.R_OK | fs.constants.W_OK);
      return this.buildCheck(spec, targetPath, 'pass', 'diretorio acessivel para leitura e escrita', false, metadata);
    } catch (error: unknown) {logger.warn('[Boot Integrity] creation failed', error);
    return this.buildCheck(
        spec,
        targetPath,
        spec.required ? 'fail' : 'warn',
        `diretorio inacessivel: ${this.errorMessage(error)}`,
        false,
        metadata,
      );
  }
  }

  private checkFile(
    spec: BootIntegritySpec,
    targetPath: string,
    metadata: Record<string, unknown>,
  ): BootIntegrityCheck {
    try {
      const stat = this.statSync(targetPath);
      metadata.size = stat.size;
      if (!stat.isFile()) {
        return this.buildCheck(spec, targetPath, 'fail', 'caminho existe, mas nao e arquivo', false, metadata);
      }

      this.accessSync(targetPath, fs.constants.R_OK);
      if (spec.parseJson) {
        this.assertValidJsonFile(targetPath);
        metadata.validJson = true;
      }

      return this.buildCheck(spec, targetPath, 'pass', 'arquivo presente e legivel', false, metadata);
    } catch (error: unknown) {logger.warn('[Boot Integrity] parsing failed', error);
    return this.buildCheck(
        spec,
        targetPath,
        spec.required ? 'fail' : 'warn',
        `arquivo invalido ou inacessivel: ${this.errorMessage(error)}`,
        false,
        metadata,
      );
  }
  }

  private assertValidJsonFile(filePath: string): void {
    const raw = String(this.readFileSync(filePath, 'utf8') || '').trim();
    if (!raw) {
      throw new Error('JSON vazio');
    }
    JSON.parse(raw);
  }

  private buildCheck(
    spec: BootIntegritySpec,
    targetPath: string,
    status: BootIntegrityCheckStatus,
    message: string,
    repaired: boolean,
    metadata: Record<string, unknown>,
  ): BootIntegrityCheck {
    return {
      id: spec.id,
      label: spec.label,
      kind: spec.kind,
      required: spec.required,
      status,
      path: targetPath,
      message,
      repaired,
      metadata,
    };
  }

  private dirname(filePath: string): string {
    return path.dirname(this.resolvePath(filePath));
  }

  private resolvePath(value: string): string {
    const normalized = String(value || '').trim();
    return normalized ? path.resolve(normalized) : '';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'erro desconhecido');
  }
}
