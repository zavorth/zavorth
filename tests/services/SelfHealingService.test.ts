import { SelfHealingService } from '../../src/services/SelfHealingService';

describe('SelfHealingService', () => {
  it('extracts the command from fenced markdown even when prose comes first', async () => {
    const service = Object.create(SelfHealingService.prototype) as SelfHealingService & {
      llm: { chat: jest.Mock };
    };

    service.llm = {
      chat: jest.fn().mockResolvedValue({
        content: 'Aqui esta o comando:\n```bash\nnpm install\n```',
      }),
    };

    const result = await service.analyzeAndProposeFix(
      {
        executor: 'local',
        workspace: 'C:/repo',
        objective: 'Corrigir dependencias',
        instructions: ['npm test'],
      } as any,
      {
        stderr: 'npm ERR! missing dependency',
      } as any,
      'win32',
    );

    expect(result).toBe('npm install');
  });

  it('rejects dangerous commands suggested by the model', async () => {
    const service = Object.create(SelfHealingService.prototype) as SelfHealingService & {
      llm: { chat: jest.Mock };
    };

    service.llm = {
      chat: jest.fn().mockResolvedValue({
        content: 'rm -rf /',
      }),
    };

    const result = await service.analyzeAndProposeFix(
      {
        executor: 'local',
        workspace: 'C:/repo',
        objective: 'Corrigir ambiente',
        instructions: ['npm test'],
      } as any,
      {
        stderr: 'algum erro',
      } as any,
      'win32',
    );

    expect(result).toBeNull();
  });

  it('rejects chained commands even if they look operationally valid', async () => {
    const service = Object.create(SelfHealingService.prototype) as SelfHealingService & {
      llm: { chat: jest.Mock };
    };

    service.llm = {
      chat: jest.fn().mockResolvedValue({
        content: 'npm install && npm test',
      }),
    };

    const result = await service.analyzeAndProposeFix(
      {
        executor: 'local',
        workspace: 'C:/repo',
        objective: 'Corrigir dependencias',
        instructions: ['npm test'],
      } as any,
      {
        stderr: 'npm ERR! missing dependency',
      } as any,
      'win32',
    );

    expect(result).toBeNull();
  });
});
