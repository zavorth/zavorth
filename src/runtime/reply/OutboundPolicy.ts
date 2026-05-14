import type {
  UniversalAgentRun,
  UniversalReplyPort,
} from '../agent/UniversalAgentRuntimeTypes.js';

export type OutboundPolicyInput = {
  run: UniversalAgentRun;
  ports?: UniversalReplyPort[];
};

export class OutboundPolicy {
  public selectPorts(input: OutboundPolicyInput): UniversalReplyPort[] {
    const candidatePorts = input.ports && input.ports.length > 0
      ? input.ports
      : input.run.replyPorts;
    const deliverablePorts = candidatePorts.filter((port) => (
      port.status === 'available'
      || port.primary
    ));

    return deliverablePorts.length > 0
      ? deliverablePorts
      : input.run.replyPorts.slice(0, 1);
  }
}
