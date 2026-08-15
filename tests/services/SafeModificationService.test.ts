import path from 'path';
import fs from 'fs';
import { SafeModificationService } from '../../src/services/SafeModificationService';


describe('SafeModificationService', () => {
  it('blocks writes outside the project root before validating syntax', async () => {
    const projectRoot = path.join(__dirname, 'tmp', 'safe-mod-root');
    const service = new SafeModificationService(projectRoot);
    const validateSyntax = jest.spyOn(service as any, 'validateSyntax');

    const result = await service.safeApply('../outside.ts', 'export const value = 1;');

    expect(result.success).toBe(false);
    expect(result.reason).toContain('fora da raiz do projeto');
    expect(validateSyntax).not.toHaveBeenCalled();
  });

  it('applies safe writes inside the project root when validation passes', async () => {
    const projectRoot = path.join(__dirname, 'tmp', 'safe-mod-root-apply');
    const targetFile = path.join(projectRoot, 'src', 'dummy.ts');
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, 'export const initialValue = 1;\n', 'utf8');

    const service = new SafeModificationService(projectRoot);
    jest.spyOn(service as any, 'validateSyntax').mockReturnValue({ passes: true, output: '' });
    jest.spyOn(service as any, 'requestHostBackup').mockResolvedValue(undefined);

    const result = await service.safeApply('src/dummy.ts', 'export const initialValue = 2;\n');

    expect(result.success).toBe(true);
    expect(fs.readFileSync(targetFile, 'utf8')).toContain('initialValue = 2');
  });

  it('routes .ps1 candidates through the PowerShell validator', () => {
    const projectRoot = path.join(__dirname, 'tmp', 'safe-mod-root-ps1');
    const service = new SafeModificationService(projectRoot);
    const powerShellValidator = jest
      .spyOn(service as any, 'validatePowerShellSyntax')
      .mockReturnValue({ passes: true, output: '' });

    const result = service.validateCandidate('scripts/launch-zavorth-supervised.ps1', 'Write-Host "ok"\n');

    expect(powerShellValidator).toHaveBeenCalled();
    expect(result).toEqual({ passes: true, output: '' });
  });
});
