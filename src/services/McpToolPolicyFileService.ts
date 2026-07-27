import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  McpToolPolicy,
  type McpSecurityProfile,
  type McpToolEntry,
  type McpToolPolicyDocument,
} from '../mcp/McpToolPolicy.js';

type McpToolPolicyFileRuntime = {
  now?: () => Date;
  projectRoot?: string;
  policyFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  env?: NodeJS.ProcessEnv;
};

export class McpToolPolicyFileService {
  private readonly now: () => Date;
  private readonly policyFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly envImpl: NodeJS.ProcessEnv;

  constructor(runtime: McpToolPolicyFileRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.envImpl = runtime.env || process.env;
    this.policyFile =
      runtime.policyFile ||
      this.envImpl.ZAVORTH_MCP_TOOL_POLICY_PATH ||
      path.join(projectRoot, 'config', 'mcp-tool-policy.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readPolicy(): McpToolPolicyDocument {
    return McpToolPolicy.readDocument(this.policyFile, {
      existsSync: this.existsSyncImpl,
      readFileSync: this.readFileSyncImpl,
    });
  }

  public savePolicy(input: Partial<McpToolPolicyDocument>): McpToolPolicyDocument {
    const normalized = new McpToolPolicy({
      profile: input.profile,
      allowlist: Array.isArray(input.allowlist) ? input.allowlist : [],
    });
    const document: McpToolPolicyDocument = {
      version: Number.isFinite(input.version) ? Number(input.version) : 1,
      updatedAt: this.now().toISOString(),
      profile: normalized.profile,
      allowlist: normalized.getAllowlist(),
      tools: input.tools || {},
    };
    this.mkdirSyncImpl(path.dirname(this.policyFile), { recursive: true });
    this.writeFileSyncImpl(this.policyFile, JSON.stringify(document, null, 2), 'utf8');
    return document;
  }

  public setProfile(profile: McpSecurityProfile): McpToolPolicyDocument {
    const current = this.readPolicy();
    return this.savePolicy({
      ...current,
      profile,
    });
  }

  public allowTool(toolName: string): McpToolPolicyDocument {
    const current = this.readPolicy();
    return this.savePolicy({
      ...current,
      allowlist: [...current.allowlist, toolName],
    });
  }

  public removeTool(toolName: string): McpToolPolicyDocument {
    const normalizedTool = new McpToolPolicy({ allowlist: [toolName] }).getAllowlist()[0] || '';
    const current = this.readPolicy();
    return this.savePolicy({
      ...current,
      allowlist: current.allowlist.filter((entry) => entry !== normalizedTool),
    });
  }

  /**
   * Returns a McpToolPolicy instance built from env + the persisted document.
   * Does NOT expose the file path.
   */
  public getMcpToolPolicy(env: NodeJS.ProcessEnv = this.envImpl): McpToolPolicy {
    return McpToolPolicy.fromEnv(env, {
      policyFile: this.policyFile,
      existsSync: this.existsSyncImpl,
      readFileSync: this.readFileSyncImpl,
    });
  }

  /**
   * In-memory mutation: marks a tool as pending_approval inside the document object.
   * Preserves the previously-approved description if the tool already existed.
   * The caller is responsible for calling savePolicy(doc) afterwards.
   */
  public markToolPending(
    doc: McpToolPolicyDocument,
    toolId: string,
    fingerprint: string,
    reason: 'new_tool' | 'schema_drift',
    lastSeenDescription?: string,
  ): void {
    doc.tools = doc.tools || {};
    const existing = doc.tools[toolId];
    doc.tools[toolId] = {
      status: 'pending_approval',
      fingerprint,
      // Keep the approved description so it isn't lost on drift
      description: existing?.description,
      lastSeenDescription: lastSeenDescription ?? existing?.lastSeenDescription,
      lastSeenAt: this.now().toISOString(),
      pendingReason: reason,
    };
  }

  /**
   * In-memory mutation: updates lastSeenDescription and lastSeenAt without changing
   * status, fingerprint, or the approved description.
   * The caller is responsible for calling savePolicy(doc) afterwards.
   */
  public updateToolLastSeen(
    doc: McpToolPolicyDocument,
    toolId: string,
    lastSeenDescription?: string,
  ): void {
    doc.tools = doc.tools || {};
    const existing = doc.tools[toolId];
    if (existing) {
      doc.tools[toolId] = {
        ...existing,
        lastSeenDescription: lastSeenDescription ?? existing.lastSeenDescription,
        lastSeenAt: this.now().toISOString(),
      };
    }
  }

  /**
   * In-memory mutation: auto-approves a tool coming from legacy allowlist migration
   * (single server, no collision). Preserves case of the namespaced toolId.
   * The caller is responsible for calling savePolicy(doc) afterwards.
   */
  public autoMigrateLegacyTool(
    doc: McpToolPolicyDocument,
    toolId: string,
    fingerprint: string,
    description?: string,
  ): void {
    doc.tools = doc.tools || {};
    doc.tools[toolId] = {
      status: 'approved',
      fingerprint,
      description,
      lastSeenAt: this.now().toISOString(),
    } satisfies McpToolEntry;
  }

  /**
   * In-memory mutation: approves a namespaced tool and adds it to the allowlist.
   * Requires namespaces toolId (contains ':').
   * If the tool has never been seen by runtime, requires fingerprint.
   * If the manual fingerprint differs from the existing one, throws unless forceFingerprint is true.
   * Validates fingerprint as a valid SHA-256 hash.
   */
  public approveTool(
    doc: McpToolPolicyDocument,
    toolId: string,
    fingerprint?: string,
    description?: string,
    forceFingerprint?: boolean,
  ): void {
    if (!toolId.includes(':')) {
      throw new Error(`The toolId "${toolId}" must be namespaced in serverId:toolName format.`);
    }

    doc.tools = doc.tools || {};
    const existing = doc.tools[toolId];

    let targetFingerprint = '';
    let targetDescription = description;

    if (existing) {
      targetFingerprint = existing.fingerprint;
      if (fingerprint && fingerprint !== existing.fingerprint) {
        if (!forceFingerprint) {
          throw new Error(
            `O fingerprint fornecido (${fingerprint}) e diferente do fingerprint registrado (${existing.fingerprint}). Use --force-fingerprint para forcar.`
          );
        }
        targetFingerprint = fingerprint;
      }
      targetDescription = description ?? existing.lastSeenDescription ?? existing.description;
    } else {
      if (!fingerprint) {
        throw new Error(`Tool "${toolId}" has never been seen by the runtime. Provide --fingerprint.`);
      }
      targetFingerprint = fingerprint;
    }

    // Validate fingerprint format SHA-256 (64 hex characters)
    if (!/^[a-fA-F0-9]{64}$/.test(targetFingerprint)) {
      throw new Error(`Invalid fingerprint "${targetFingerprint}". It must be a SHA-256 hash (64 hexadecimal characters).`);
    }

    doc.tools[toolId] = {
      status: 'approved',
      fingerprint: targetFingerprint,
      description: targetDescription,
      lastSeenDescription: existing?.lastSeenDescription,
      lastSeenAt: this.now().toISOString(),
    };

    doc.allowlist = doc.allowlist || [];
    if (!doc.allowlist.includes(toolId)) {
      doc.allowlist.push(toolId);
    }
  }

  /**
   * In-memory mutation: blocks a tool (status = 'blocked') and removes it from the allowlist.
   */
  public blockTool(doc: McpToolPolicyDocument, toolId: string): void {
    if (!toolId.includes(':')) {
      throw new Error(`The toolId "${toolId}" must be namespaced in serverId:toolName format.`);
    }

    doc.tools = doc.tools || {};
    const existing = doc.tools[toolId];
    if (existing) {
      doc.tools[toolId] = {
        ...existing,
        status: 'blocked',
        pendingReason: undefined,
        lastSeenAt: this.now().toISOString(),
      };
    } else {
      doc.tools[toolId] = {
        status: 'blocked',
        fingerprint: '0000000000000000000000000000000000000000000000000000000000000000',
        lastSeenAt: this.now().toISOString(),
      };
    }

    doc.allowlist = doc.allowlist || [];
    doc.allowlist = doc.allowlist.filter((item) => item !== toolId);
  }

  /**
   * In-memory mutation: forgets a tool (removes from doc.tools and doc.allowlist).
   */
  public forgetTool(doc: McpToolPolicyDocument, toolId: string): void {
    if (!toolId.includes(':')) {
      throw new Error(`The toolId "${toolId}" must be namespaced in serverId:toolName format.`);
    }

    doc.tools = doc.tools || {};
    delete doc.tools[toolId];

    doc.allowlist = doc.allowlist || [];
    doc.allowlist = doc.allowlist.filter((item) => item !== toolId);
  }
}

