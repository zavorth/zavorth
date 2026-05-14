import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';
import { WebAppService } from '../../src/services/WebAppService.js';

function createRuntime() {
  return {
    taskManager: {
      getRecentTasksByChat: jest.fn(() => []),
      getRecentTasksByUsers: jest.fn(() => []),
      getRecentTasks: jest.fn(() => []),
      getTask: jest.fn(() => null),
    },
    permissionService: {
      listRequests: jest.fn(async () => []),
    },
    parser: {
      parse: jest.fn((text: string) => ({
        normalized_message: text,
        command_type: '/task',
      })),
    },
    taskOrchestrationController: {
      handleTaskMessage: jest.fn(async () => null),
    },
    permissionController: {
      formatPermissionCreatedMessage: jest.fn(() => 'permission'),
      resolvePermissionReference: jest.fn(),
      handlePermissionCallback: jest.fn(),
      shortPermissionId: jest.fn(() => 'perm-short'),
      handleApproval: jest.fn(),
      handleRejection: jest.fn(),
    },
    webUserId: 'telegram-admin',
  };
}

describe('WebAppService runtime channel registry sync', () => {
  it('syncs runtime channel adapters from dashboard operations into the web runtime registry', () => {
    const service = new WebAppService(new DashboardAuthService());

    service.attachRuntime(createRuntime() as any);
    service.attachOperationsServices({
      runtimeChannelAdapters: [
        {
          id: 'slack',
          describe: () => ({
            id: 'slack',
            label: 'Slack',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'native',
            notes: ['Slack nativo sincronizado no runtime web.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: true,
              groupPolicy: true,
              identityHints: true,
            },
          }),
        },
        {
          id: 'whatsapp',
          describe: () => ({
            id: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'ready',
            implementationState: 'full',
            configured: true,
            transport: 'webhook',
            notes: ['WhatsApp Cloud API sincronizado no runtime web.'],
            features: {
              inbound: true,
              outbound: true,
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: false,
              groupPolicy: true,
              identityHints: true,
            },
          }),
        },
      ] as any,
    });

    const registry = (service as any).runtimeServices.gatewayChannelRegistry;
    const snapshot = registry.buildSnapshot();

    expect(snapshot.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'web',
          readiness: 'ready',
        }),
        expect.objectContaining({
          id: 'slack',
          readiness: 'ready',
          transport: 'native',
        }),
        expect.objectContaining({
          id: 'whatsapp',
          readiness: 'ready',
          transport: 'webhook',
        }),
      ]),
    );
  });
});
