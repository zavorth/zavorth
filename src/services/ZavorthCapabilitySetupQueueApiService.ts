import type {
  CapabilitySetupQueueCreateInput,
  CapabilitySetupQueueSnapshot,
  CapabilitySetupQueueTicket,
  CapabilitySetupQueueTicketStatus,
  CapabilitySetupQueueUpdateInput,
} from '../contracts/CapabilitySetupQueueContract.js';
import {
  ZavorthCapabilitySetupQueueService,
  type ZavorthCapabilitySetupQueueRuntime,
} from './ZavorthCapabilitySetupQueueService.js';

export class ZavorthCapabilitySetupQueueApiService {
  private readonly service: ZavorthCapabilitySetupQueueService;

  constructor(runtime: ZavorthCapabilitySetupQueueRuntime = {}) {
    this.service = new ZavorthCapabilitySetupQueueService(runtime);
  }

  public createTicket(input: CapabilitySetupQueueCreateInput = {}): CapabilitySetupQueueTicket {
    return this.service.createTicket(input);
  }

  public updateTicket(input: CapabilitySetupQueueUpdateInput): CapabilitySetupQueueTicket {
    return this.service.updateTicket(input);
  }

  public listTickets(filter: { status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed' } = {}): CapabilitySetupQueueSnapshot {
    return this.service.listTickets(filter);
  }

  public getTicket(ticketId: string): CapabilitySetupQueueTicket | null {
    return this.service.getTicket(ticketId);
  }

  public renderReport(filter: { status?: CapabilitySetupQueueTicketStatus | 'open' | 'closed' } = {}): string {
    return this.service.renderReport(filter);
  }
}

