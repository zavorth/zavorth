import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';

export type GatewayHealthRenewalItem = {
  id:
    | 'node-mesh-smoke'
    | 'system-overlord-smoke'
    | 'channel-provider-doctor'
    | 'remote-transport-doctor';
  label: string;
  command: string;
  summary: string;
};

export type GatewayHealthRenewalReport = {
  status: 'fresh' | 'renewal_recommended';
  summary: string;
  items: GatewayHealthRenewalItem[];
  commands: string[];
};

export class GatewayHealthRenewalService {
  public inspect(readiness: RuntimeAccessReadinessReport): GatewayHealthRenewalReport {
    const items: GatewayHealthRenewalItem[] = [];
    const nodeMeshSmoke = readiness.runtime?.nodeMeshSmoke;
    const systemOverlordSmoke = readiness.runtime?.systemOverlordSmoke;
    const channelProviderDoctor = readiness.runtime?.channelProviderDoctor;
    const remoteTransportDoctor = readiness.runtime?.remoteTransportDoctor;

    if (nodeMeshSmoke?.status === 'passed' && nodeMeshSmoke.stale) {
      items.push({
        id: 'node-mesh-smoke',
        label: 'Node Mesh smoke',
        command: 'npm run test:nodes:smoke',
        summary: 'O smoke real do Node Mesh ficou velho e merece renovaction leve.',
      });
    }

    if (systemOverlordSmoke?.status === 'passed' && systemOverlordSmoke.stale) {
      items.push({
        id: 'system-overlord-smoke',
        label: 'System Overlord smoke',
        command: 'npm run test:overlord:smoke',
        summary: 'O smoke do System Overlord ficou velho e merece renovaction leve.',
      });
    }

    if (channelProviderDoctor?.status === 'passed' && channelProviderDoctor.stale) {
      items.push({
        id: 'channel-provider-doctor',
        label: 'Doctor de canais nativos',
        command: 'npm run test:channels:smoke',
        summary: 'O doctor dos canais nativos ficou velho e merece renovaction leve.',
      });
    }

    if (remoteTransportDoctor?.status === 'passed' && remoteTransportDoctor.stale) {
      items.push({
        id: 'remote-transport-doctor',
        label: 'Doctor de transportes remotos',
        command: 'npm run test:transports:smoke',
        summary: 'O doctor dos transportes remotos ficou velho e merece renovaction leve.',
      });
    }

    if (items.length === 0) {
      return {
        status: 'fresh',
        summary: 'Checks de health estao frescos ou ainda nao exigem renovacao leve.',
        items: [],
        commands: [],
      };
    }

    return {
      status: 'renewal_recommended',
      summary: `Existem ${items.length} check(s) de health com renovacao leve recomendada.`,
      items,
      commands: Array.from(new Set(items.map((entry) => entry.command))),
    };
  }
}

