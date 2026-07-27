export class PeerToolMirrorService {
  private mirrors: Map<string, any> = new Map();
  private projectRoot: string;

  constructor({ projectRoot }: { projectRoot: string }) {
    this.projectRoot = projectRoot;
  }

  writeMirror(record: any) {
    const tools = (record.surface?.tools || []).map((tool: any) => ({
      ...tool,
      executionBackend: `peer:${record.linkId}`,
    }));
    const result = { ...record, tools };
    this.mirrors.set(record.linkId, result);
    return result;
  }

  loadAllToolDefinitions() {
    const defs: any[] = [];
    for (const record of this.mirrors.values()) {
      for (const tool of record.tools || []) {
        defs.push(tool);
      }
    }
    return defs;
  }

  mergeIntoRegistry(reg: Map<string, any>) {
    const added: any[] = [];
    for (const record of this.mirrors.values()) {
      for (const tool of record.tools || []) {
        if (!reg.has(tool.name)) {
          reg.set(tool.name, tool);
          added.push(tool);
        }
      }
    }
    return { added };
  }
}
