import type {
  SystemOverlordRuntimeAdapter,
} from '../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../contracts/SystemOverlordContract.js';
import { SupervisedBrowserControlAdapter } from '../adapters/overlord/SupervisedBrowserControlAdapter.js';

import { SupervisedComputerUseAdapter } from '../adapters/overlord/SupervisedComputerUseAdapter.js';
import { SupervisedDesktopAutomationAdapter } from '../adapters/overlord/SupervisedDesktopAutomationAdapter.js';
import { SupervisedDockerExecAdapter } from '../adapters/overlord/SupervisedDockerExecAdapter.js';
import { SupervisedNetworkTunnelAdapter } from '../adapters/overlord/SupervisedNetworkTunnelAdapter.js';
import { SupervisedNodeInvokeAdapter } from '../adapters/overlord/SupervisedNodeInvokeAdapter.js';
import { SupervisedSecretsReadAdapter } from '../adapters/overlord/SupervisedSecretsReadAdapter.js';
import { SupervisedWslExecAdapter } from '../adapters/overlord/SupervisedWslExecAdapter.js';
import { ZavorthPublicTunnelService } from './ZavorthPublicTunnelService.js';
import { NodeInvokeService } from './NodeInvokeService.js';

export class SupervisedRuntimeAdapterRegistryService {
  private readonly adapters: SystemOverlordRuntimeAdapter[];

  constructor(options: {
    adapters?: SystemOverlordRuntimeAdapter[];
    computerUseAgent?: ConstructorParameters<typeof SupervisedComputerUseAdapter>[0];
    nodeInvokeService?: Pick<NodeInvokeService, 'invoke' | 'preview'>;
    publicTunnelService?: Pick<ZavorthPublicTunnelService, 'readStatus' | 'ensureStarted' | 'stop'>;
  } = {}) {
    this.adapters = options.adapters || [
      new SupervisedDockerExecAdapter(),
      new SupervisedWslExecAdapter(),
      new SupervisedNetworkTunnelAdapter({
        tunnelService: options.publicTunnelService,
      }),
      new SupervisedNodeInvokeAdapter({
        nodeInvokeService: options.nodeInvokeService,
      }),
      new SupervisedSecretsReadAdapter(),
      new SupervisedBrowserControlAdapter(),
      new SupervisedDesktopAutomationAdapter(),
      new SupervisedComputerUseAdapter(options.computerUseAgent || null),
    ];
  }

  public findAdapter(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): SystemOverlordRuntimeAdapter | null {
    return this.adapters.find((adapter) => adapter.canHandle(request, decision)) || null;
  }

  public listAdapters(): Array<{ id: string; label: string }> {
    return this.adapters.map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
    }));
  }
}
