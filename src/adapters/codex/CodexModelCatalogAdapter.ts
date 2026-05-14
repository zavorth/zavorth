import type {
  CodexRuntimeModelEntry,
} from '../../contracts/CodexRuntimeContract.js';
import { CodexAppServerRpcAdapter } from './CodexAppServerRpcAdapter.js';

type CodexModelCatalogAdapterRuntime = {
  rpcAdapter?: Pick<CodexAppServerRpcAdapter, 'hasRequester' | 'listModels'>;
};

export class CodexModelCatalogAdapter {
  private readonly rpc: Pick<CodexAppServerRpcAdapter, 'hasRequester' | 'listModels'>;

  constructor(runtime: CodexModelCatalogAdapterRuntime = {}) {
    this.rpc = runtime.rpcAdapter || new CodexAppServerRpcAdapter();
  }

  public fallbackCatalog(): CodexRuntimeModelEntry[] {
    return [
      model('codex-default', 'Codex Default', ['medium', 'high']),
      model('codex-fast', 'Codex Fast', ['low', 'medium']),
      model('codex-deep', 'Codex Deep', ['high', 'xhigh']),
      model('codex-reviewer', 'Codex Reviewer', ['medium', 'high', 'xhigh']),
    ];
  }

  public async listModels(input: {
    preferLiveDiscovery?: boolean;
  } = {}): Promise<CodexRuntimeModelEntry[]> {
    if (input.preferLiveDiscovery && this.rpc.hasRequester()) {
      try {
        const liveModels = await this.rpc.listModels();
        if (liveModels.length > 0) {
          return liveModels;
        }
      } catch {
        return this.fallbackCatalog();
      }
    }
    return this.fallbackCatalog();
  }
}

function model(
  id: string,
  label: string,
  reasoningEfforts: CodexRuntimeModelEntry['reasoningEfforts'],
): CodexRuntimeModelEntry {
  return {
    id,
    label,
    provider: 'codex',
    source: 'fallback',
    reasoningEfforts,
    supportsImages: true,
    supportsTools: true,
  };
}
