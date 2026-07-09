
import fs from 'fs';
import path from 'path';
import type { ChildProcess } from 'child_process';
import { config } from '../config/index.js';
import { spawnCommand } from '../core/CommandSpawn.js';
import { LogRepository } from '../storage/LogRepository.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type ActionPriority = 'high' | 'normal';

type OperationActionDefinition = {
  id: string;
  label: string;
  command: string;
  args: string[];
  priority: ActionPriority;
};

type OperationActionRecord = {
  id: string;
  label: string;
  command: string;
  priority: ActionPriority;
  startedAt: string;
  pid: number | null;
  logFile: string;
  status: 'started' | 'failed_to_start';
  note: string | null;
};

const ACTION_DEFINITIONS: Record<string, OperationActionDefinition> = {
  'recover-sidecars': {
    id: 'recover-sidecars',
    label: 'Reconciliar runtime local',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'ops:maintain'],
    priority: 'high',
  },
  'security-preflight': {
    id: 'security-preflight',
    label: 'Rodar preflight de seguranca',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'security:preflight'],
    priority: 'high',
  },
  'remote-publish': {
    id: 'remote-publish',
    label: 'Publicar superficies remotas',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'remote:publish'],
    priority: 'normal',
  },
  maintenance: {
    id: 'maintenance',
    label: 'Rodar manutencao operacional',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'ops:maintain'],
    priority: 'normal',
  },
  'maintenance-keepalive': {
    id: 'maintenance-keepalive',
    label: 'Manter o host saudavel',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'ops:maintain'],
    priority: 'normal',
  },
  'validate-node-mesh-smoke': {
    id: 'validate-node-mesh-smoke',
    label: 'Validar Node Mesh',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'test:nodes:smoke'],
    priority: 'high',
  },
  'validate-channel-providers': {
    id: 'validate-channel-providers',
    label: 'Validar canais nativos',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'test:channels:smoke'],
    priority: 'high',
  },
  'validate-remote-transports': {
    id: 'validate-remote-transports',
    label: 'Validar transportes remotos',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'test:transports:smoke'],
    priority: 'high',
  },
  'validate-wasm-smoke': {
    id: 'validate-wasm-smoke',
    label: 'Validar tier Wasm',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'sandbox:wasm:smoke'],
    priority: 'high',
  },
  'scheduled-maintenance': {
    id: 'scheduled-maintenance',
    label: 'Rodar manutencao recorrente leve',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'ops:maintain:scheduled'],
    priority: 'normal',
  },
  'zavorth-bridge-remote-doctor': {
    id: 'zavorth-bridge-remote-doctor',
    label: 'Diagnosticar remoto do ZavorthBridge',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'zavorthBridge:remote:doctor'],
    priority: 'normal',
  },
  'zavorth-bridge-remote-history': {
    id: 'zavorth-bridge-remote-history',
    label: 'Ler historico do remoto do ZavorthBridge',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'zavorthBridge:remote:history'],
    priority: 'normal',
  },
};

export type OperationsActionExecution = OperationActionRecord;

type OperationsActionRuntime = {
  spawn?: typeof spawnCommand;
  now?: () => Date;
  mkdirSync?: typeof fs.mkdirSync;
  openSync?: typeof fs.openSync;
  closeSync?: typeof fs.closeSync;
  writeFileSync?: typeof fs.writeFileSync;
  appendFileSync?: typeof fs.appendFileSync;
};

export class OperationsActionService {
  private readonly spawnImpl: typeof spawnCommand;
  private readonly now: () => Date;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly openSyncImpl: typeof fs.openSync;
  private readonly closeSyncImpl: typeof fs.closeSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly appendFileSyncImpl: typeof fs.appendFileSync;
  private readonly actionLogDir: string;
  private readonly actionStatusFile: string;
  private readonly actionHistoryFile: string;

  constructor(
    private readonly logRepo: LogRepository,
    runtime: OperationsActionRuntime = {},
  ) {
    const runtimeRoot = path.join(config.dataDir, 'runtime');
    this.spawnImpl = runtime.spawn || spawnCommand;
    this.now = runtime.now || (() => new Date());
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.openSyncImpl = runtime.openSync || fs.openSync.bind(fs);
    this.closeSyncImpl = runtime.closeSync || fs.closeSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.appendFileSyncImpl = runtime.appendFileSync || fs.appendFileSync.bind(fs);
    this.actionLogDir = path.join(runtimeRoot, 'actions');
    this.actionStatusFile = path.join(runtimeRoot, 'operations-action-last.json');
    this.actionHistoryFile = path.join(runtimeRoot, 'operations-action-history.jsonl');
  }

  public listDefinitions(): OperationActionDefinition[] {
    return Object.values(ACTION_DEFINITIONS).map((definition) => ({ ...definition, args: [...definition.args] }));
  }

  public execute(actionId: string): OperationsActionExecution {
    const definition = ACTION_DEFINITIONS[actionId];
    if (!definition) {
      throw new Error(`Acao operacional desconhecida: ${actionId}`);
    }

    this.mkdirSyncImpl(this.actionLogDir, { recursive: true });
    const startedAt = this.now().toISOString();
    const timestamp = startedAt.replace(/[-:TZ.]/g, '').slice(0, 14);
    const logFile = path.join(this.actionLogDir, `${timestamp}-${definition.id}.log`);
    const lineBreak = process.platform === 'win32' ? '\r\n' : '\n';
    const logFd = this.openSyncImpl(logFile, 'a');
    this.writeFileSyncImpl(
      logFd,
      `[${startedAt}] Iniciando ${definition.label}: ${definition.command} ${definition.args.join(' ')}${lineBreak}`,
      'utf8',
    );

    let child: ChildProcess | null = null;
    try {
      child = this.spawnImpl(definition.command, definition.args, {
        cwd: config.defaultWorkspace,
        env: process.env,
        detached: true,
        shell: false,
        stdio: ['ignore', logFd, logFd],
      });
      child.unref();
      this.closeSyncImpl(logFd);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.writeFileSyncImpl(
        logFd,
        `[${this.now().toISOString()}] Falha ao iniciar acao: ${errorMessage(error)}${lineBreak}`,
        'utf8',
      );
      this.closeSyncImpl(logFd);
      const failedRecord: OperationActionRecord = {
        id: definition.id,
        label: definition.label,
        command: `${definition.command} ${definition.args.join(' ')}`,
        priority: definition.priority,
        startedAt,
        pid: null,
        logFile,
        status: 'failed_to_start',
        note: errorMessage(error),
      };
      this.persistRecord(failedRecord);
      this.logRepo.log('error', 'OperationsActionService', `Falha ao iniciar ${definition.id}: ${failedRecord.note}`);
      return failedRecord;
    }

    const record: OperationActionRecord = {
      id: definition.id,
      label: definition.label,
      command: `${definition.command} ${definition.args.join(' ')}`,
      priority: definition.priority,
      startedAt,
      pid: child.pid ?? null,
      logFile,
      status: 'started',
      note: 'Acao iniciada em background.',
    };
    this.persistRecord(record);
    this.logRepo.log(
      'info',
      'OperationsActionService',
      `Acao ${definition.id} iniciada em background.`,
      { pid: record.pid, logFile: record.logFile },
    );
    return record;
  }

  private persistRecord(record: OperationActionRecord): void {
    this.mkdirSyncImpl(path.dirname(this.actionStatusFile), { recursive: true });
    this.writeFileSyncImpl(this.actionStatusFile, JSON.stringify(record, null, 2), 'utf8');
    this.appendFileSyncImpl(this.actionHistoryFile, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
