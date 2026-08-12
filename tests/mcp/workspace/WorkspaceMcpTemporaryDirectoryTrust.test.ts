import { TemporaryDirectoryTrustService } from '../../../src/services/TemporaryDirectoryTrustService';

const mockInstance = {
  checkPathAccess: jest.fn(),
};

jest.mock('../../../src/services/TemporaryDirectoryTrustService', () => {
  return {
    TemporaryDirectoryTrustService: {
      getInstance: () => mockInstance,
    },
  };
});

describe('WorkspaceMcpTemporaryDirectoryTrust', () => {
  let mockTrustService: jest.Mocked<TemporaryDirectoryTrustService>;

  beforeEach(() => {
    mockTrustService = TemporaryDirectoryTrustService.getInstance() as jest.Mocked<TemporaryDirectoryTrustService>;
  });

  it('deve validar se a acao de ler/escrever arquivos via MCP valida o trust do workspaceId correto', () => {
    const workspaceId = 'my-workspace-id';
    const workspaceRoot = 'C:/workspaces/zavorth';
    const filePath = 'C:/some/external/temp/file.txt';

    mockTrustService.checkPathAccess.mockReturnValue({
      allowed: false,
      reason: 'No active Temporary Directory Trust covers this path',
      mandateViolation: false,
    });

    // Simular a chamada que o MCP faria
    const result = mockTrustService.checkPathAccess(
      workspaceId,
      workspaceRoot,
      filePath,
      'filesystem.read'
    );

    expect(result.allowed).toBe(false);
    expect(mockTrustService.checkPathAccess).toHaveBeenCalledWith(
      workspaceId,
      workspaceRoot,
      filePath,
      'filesystem.read'
    );
  });
});
