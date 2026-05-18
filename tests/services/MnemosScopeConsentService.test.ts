import { MnemosScopeConsentService } from '../../src/services/MnemosScopeConsentService';

describe('MnemosScopeConsentService', () => {
  const service = new MnemosScopeConsentService();
  const cwd = 'C:\\TESTES DEV\\zavorth-core\\Zavorth';
  const homeDir = 'C:\\Users\\operator';

  it('turns a Documents request into an explicit confirmable scope', () => {
    const proposal = service.createProposal({
      userText: 'Pode procurar na minha pasta documentos',
      cwd,
      homeDir,
    });

    expect(proposal.ok).toBe(true);
    expect(proposal.scanDirs).toContain('C:\\Users\\operator\\Documents');
    expect(proposal.risk).toBe('low');
    expect(proposal.requiresConfirmation).toBe(true);
    expect(proposal.enableMnemosArgs.wide_scope_confirmed).toBe(false);
  });

  it('marks whole computer requests as critical and warns before confirmation', () => {
    const proposal = service.createProposal({
      userText: 'Pode procurar no meu PC inteiro',
      cwd,
      homeDir,
    });

    expect(proposal.ok).toBe(true);
    expect(proposal.wholeComputerRequested).toBe(true);
    expect(proposal.risk).toBe('critical');
    expect(proposal.scanDirs).toEqual(['C:\\']);
    expect(proposal.warnings.join('\n')).toContain('Whole-computer search');
  });

  it('asks for a folder when the text has no usable scope', () => {
    const proposal = service.createProposal({
      userText: 'configure o mnemos',
      cwd,
      homeDir,
    });

    expect(proposal.ok).toBe(false);
    expect(proposal.scanDirs).toEqual([]);
    expect(proposal.nextSafeAction).toContain('Ask the user');
  });

  it('recognizes natural approval text', () => {
    expect(service.isApprovalText('Aprovo, pode continuar')).toBe(true);
    expect(service.isApprovalText('nao ainda')).toBe(false);
  });
});
