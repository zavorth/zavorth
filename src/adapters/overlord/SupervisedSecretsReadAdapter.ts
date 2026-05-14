import { NodeRegistryService } from '../../services/NodeRegistryService.js';
import type {
  SystemOverlordAdapterResult,
  SystemOverlordRuntimeAdapter,
} from '../../contracts/SystemOverlordAdapterContract.js';
import type {
  SystemOverlordActionRequest,
  SystemOverlordCapabilityDecision,
} from '../../contracts/SystemOverlordContract.js';
import {
  readStructuredInput,
  stringField,
} from './SupervisedAdapterInput.js';

type NodeRegistryLike = Pick<NodeRegistryService, 'getSecretValue'>;

export class SupervisedSecretsReadAdapter implements SystemOverlordRuntimeAdapter {
  public readonly id = 'secrets-read-supervised';
  public readonly label = 'Secrets Read Supervision Adapter';
  private readonly env: NodeJS.ProcessEnv;
  private readonly nodeRegistry: NodeRegistryLike;

  constructor(options: {
    env?: NodeJS.ProcessEnv;
    nodeRegistryService?: NodeRegistryLike;
  } = {}) {
    this.env = options.env || process.env;
    this.nodeRegistry = options.nodeRegistryService || new NodeRegistryService();
  }

  public canHandle(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): boolean {
    return request.capability === 'secrets.read' && decision.runtimeTarget === 'host';
  }

  public async execute(
    request: SystemOverlordActionRequest,
    decision: SystemOverlordCapabilityDecision,
  ): Promise<SystemOverlordAdapterResult> {
    const input = readStructuredInput(request.command, request.metadata || null);
    const secretName = stringField(input, 'secretName', 'key', 'name');
    const source = stringField(input, 'source') || 'env';
    const nodeId = stringField(input, 'nodeId');

    if (!secretName) {
      return {
        ok: false,
        errorCode: 'secret_name_required',
        errorMessage: 'secrets.read exige secretName em payload estruturado.',
      };
    }

    const rawValue = source === 'node'
      ? this.nodeRegistry.getSecretValue(nodeId, secretName)
      : String(this.env[secretName] || '').trim() || null;
    const present = Boolean(rawValue);
    const maskedPreview = present ? this.maskValue(rawValue || '') : null;
    const payload = {
      secretName,
      source,
      nodeId: nodeId || null,
      present,
      maskedPreview,
      length: present ? String(rawValue || '').length : 0,
      summary: present
        ? 'Secret presente e mascarado por policy supervisionada.'
        : 'Secret nao encontrado na origem supervisionada.',
    };

    return {
      ok: true,
      stdout: JSON.stringify(payload, null, 2),
      rollbackAvailable: false,
      metadata: {
        adapterId: this.id,
        runtimeTarget: decision.runtimeTarget,
        ...payload,
      },
    };
  }

  private maskValue(value: string): string {
    const normalized = String(value || '');
    if (normalized.length <= 4) {
      return '*'.repeat(normalized.length || 1);
    }
    return normalized.slice(0, 2) + '*'.repeat(Math.max(4, normalized.length - 4)) + normalized.slice(-2);
  }
}
