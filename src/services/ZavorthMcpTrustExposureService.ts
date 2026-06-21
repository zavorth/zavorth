import type { ZavorthRuntimeMcpTrustServer } from '../contracts/ZavorthRuntimeStateBusContract.js';

export type ZavorthMcpTrustToolInput = {
  name: string;
  serverId?: string | null;
  description?: string | null;
};

export type ZavorthMcpTrustExposureResult<T extends ZavorthMcpTrustToolInput> = {
  allowed: T[];
  blocked: Array<T & {
    reason: 'mcp_server_not_trusted' | 'mcp_tool_not_declared' | 'mcp_server_missing';
  }>;
  safety: {
    externalServersRequireTrust: true;
    quarantinedToolsHidden: true;
    rawSecretsSerialized: false;
  };
};

export class ZavorthMcpTrustExposureService {
  public filterTools<T extends ZavorthMcpTrustToolInput>(input: {
    servers: ZavorthRuntimeMcpTrustServer[];
    tools: T[];
  }): ZavorthMcpTrustExposureResult<T> {
    const serversById = new Map(input.servers.map((server) => [server.id, server]));
    const allowed: T[] = [];
    const blocked: ZavorthMcpTrustExposureResult<T>['blocked'] = [];

    for (const tool of input.tools) {
      const serverId = clean(tool.serverId);
      const server = serverId ? serversById.get(serverId) || null : null;
      if (!server) {
        blocked.push({ ...tool, reason: 'mcp_server_missing' });
        continue;
      }
      if (server.trustState !== 'trusted' || server.exposedToModel !== true) {
        blocked.push({ ...tool, reason: 'mcp_server_not_trusted' });
        continue;
      }
      if (!server.toolNames.map((name) => name.toLowerCase()).includes(tool.name.toLowerCase())) {
        blocked.push({ ...tool, reason: 'mcp_tool_not_declared' });
        continue;
      }
      allowed.push(tool);
    }

    return {
      allowed,
      blocked,
      safety: {
        externalServersRequireTrust: true,
        quarantinedToolsHidden: true,
        rawSecretsSerialized: false,
      },
    };
  }
}

function clean(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
