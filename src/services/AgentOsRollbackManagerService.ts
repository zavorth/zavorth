import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { agentOsHash, looksLikeAgentOsSecret, safeAgentOsId } from './AgentOsTextSafety.js';

export type AgentOsRollbackRecord = {
  relativePath: string;
  existedBefore: boolean;
  previousContent: string | null;
  previousHash: string | null;
};

export type AgentOsRollbackArtifact = {
  status: 'prepared' | 'blocked' | 'restored';
  artifactPath: string | null;
  records: AgentOsRollbackRecord[];
  rawSecretsSerialized: false;
  summary: string;
};

type RollbackManagerRuntime = {
  rootDir?: string | null;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
  rmSync?: typeof fs.rmSync;
};

export class AgentOsRollbackManagerService {
  private readonly rootDir: string;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly rmSync: typeof fs.rmSync;

  constructor(runtime: RollbackManagerRuntime = {}) {
    this.rootDir = runtime.rootDir || path.resolve(config.projectRoot, 'data', 'runtime', 'agent-os-rollbacks');
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.rmSync = runtime.rmSync || fs.rmSync.bind(fs);
  }

  public prepare(input: {
    transactionId: string;
    workspaceRoot: string;
    files: Array<{ path: string; previousContent: string | null; existedBefore?: boolean }>;
  }): AgentOsRollbackArtifact {
    const records: AgentOsRollbackRecord[] = [];
    for (const file of input.files) {
      if (looksLikeAgentOsSecret(file.path) || looksLikeAgentOsSecret(file.previousContent || '')) {
        return {
          status: 'blocked',
          artifactPath: null,
          records: [],
          rawSecretsSerialized: false,
          summary: 'Rollback bloqueado para evitar serializar conteudo sensivel.',
        };
      }
      const target = WorkspaceResolver.ensurePathInsideWorkspace(input.workspaceRoot, file.path);
      records.push({
        relativePath: path.relative(path.resolve(input.workspaceRoot), target).replace(/\\/g, '/'),
        existedBefore: file.existedBefore ?? file.previousContent !== null,
        previousContent: file.previousContent,
        previousHash: file.previousContent === null ? null : agentOsHash(file.previousContent),
      });
    }
    const dir = path.join(this.rootDir, safeAgentOsId(input.transactionId, 'transaction'));
    this.mkdirSync(dir, { recursive: true });
    const artifactPath = path.join(dir, 'rollback.json');
    this.writeFileSync(artifactPath, `${JSON.stringify({ rawSecretsSerialized: false, records }, null, 2)}\n`, 'utf8');
    return {
      status: 'prepared',
      artifactPath,
      records,
      rawSecretsSerialized: false,
      summary: `${records.length} rollback record(s) prepared.`,
    };
  }

  public restore(input: { workspaceRoot: string; artifactPath: string }): AgentOsRollbackArtifact {
    const artifact = path.resolve(input.artifactPath);
    if (!artifact.startsWith(path.resolve(this.rootDir)) || !this.existsSync(artifact)) {
      return { status: 'blocked', artifactPath: null, records: [], rawSecretsSerialized: false, summary: 'Invalid rollback artifact.' };
    }
    const parsed = JSON.parse(this.readFileSync(artifact, 'utf8')) as { records?: AgentOsRollbackRecord[] };
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    for (const record of records) {
      const target = WorkspaceResolver.ensurePathInsideWorkspace(input.workspaceRoot, record.relativePath);
      if (record.existedBefore) {
        this.mkdirSync(path.dirname(target), { recursive: true });
        this.writeFileSync(target, record.previousContent || '', 'utf8');
      } else if (this.existsSync(target)) {
        this.rmSync(target, { force: true });
      }
    }
    return { status: 'restored', artifactPath: artifact, records, rawSecretsSerialized: false, summary: `${records.length} rollback record(s) restored.` };
  }
}
