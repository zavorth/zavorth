import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import {
  McpToolPolicy,
  type McpSecurityProfile,
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
};

export class McpToolPolicyFileService {
  private readonly now: () => Date;
  private readonly policyFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: McpToolPolicyFileRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.policyFile = runtime.policyFile || path.join(projectRoot, 'config', 'mcp-tool-policy.json');
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
}
