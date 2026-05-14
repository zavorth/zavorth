import {
  formatUserFacingSecurityApprovalMessage,
  inspectSecurityProfileConfiguration,
  listSecurityProfilePolicies,
  resolveSecurityProfile,
} from '../../src/security/SecurityProfile';

describe('SecurityProfile', () => {
  const originalEnv = process.env.ZAVORTH_SECURITY_PROFILE;
  const originalEnterprise = process.env.ZAVORTH_ENTERPRISE_MODE;
  const originalMode = process.env.ZAVORTH_SECURITY_MODE;
  const originalGenericProfile = process.env.ZAVORTH_PROFILE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ZAVORTH_SECURITY_PROFILE;
    } else {
      process.env.ZAVORTH_SECURITY_PROFILE = originalEnv;
    }
    if (originalEnterprise === undefined) {
      delete process.env.ZAVORTH_ENTERPRISE_MODE;
    } else {
      process.env.ZAVORTH_ENTERPRISE_MODE = originalEnterprise;
    }
    if (originalMode === undefined) {
      delete process.env.ZAVORTH_SECURITY_MODE;
    } else {
      process.env.ZAVORTH_SECURITY_MODE = originalMode;
    }
    if (originalGenericProfile === undefined) {
      delete process.env.ZAVORTH_PROFILE;
    } else {
      process.env.ZAVORTH_PROFILE = originalGenericProfile;
    }
  });

  it('lists the three user-facing profiles', () => {
    expect(listSecurityProfilePolicies().map((profile) => profile.id)).toEqual([
      'personal',
      'professional',
      'enterprise',
    ]);
  });

  it('uses professional as the safe low-friction default', () => {
    delete process.env.ZAVORTH_SECURITY_PROFILE;
    delete process.env.ZAVORTH_ENTERPRISE_MODE;
    delete process.env.ZAVORTH_SECURITY_MODE;
    delete process.env.ZAVORTH_PROFILE;

    const resolution = resolveSecurityProfile({ ignoreOperationalPreset: true });

    expect(resolution.profile.id).toBe('professional');
    expect(resolution.source).toBe('default');
    expect(resolution.reason).toContain('padrao seguro');
  });

  it('honors explicit and environment profile aliases', () => {
    expect(resolveSecurityProfile({ profile: 'pessoal' }).profile.id).toBe('personal');

    process.env.ZAVORTH_SECURITY_PROFILE = 'enterprise';
    expect(resolveSecurityProfile().profile.id).toBe('enterprise');
    expect(resolveSecurityProfile().source).toBe('environment');
  });

  it('detects managed enterprise signals without asking the user to configure keys', () => {
    delete process.env.ZAVORTH_SECURITY_PROFILE;
    delete process.env.ZAVORTH_SECURITY_MODE;
    delete process.env.ZAVORTH_PROFILE;
    process.env.ZAVORTH_ENTERPRISE_MODE = '1';

    expect(resolveSecurityProfile().profile.id).toBe('enterprise');
    expect(resolveSecurityProfile().source).toBe('enterprise-signal');
  });

  it('formats approval prompts in plain language', () => {
    const message = formatUserFacingSecurityApprovalMessage({
      action: 'require_confirmation',
      allowed: false,
      risk: 'review',
      toolName: 'create_file',
      surface: 'native-tool',
      capabilities: ['filesystem'],
      securityProfile: {
        id: 'professional',
        label: 'Uso profissional',
        source: 'default',
      },
      requiresConfirmation: true,
      reasons: ['test'],
      rule: 'CONFIRMATION_REQUIRED',
    });

    expect(message).toContain('O Zavorth quer executar "create_file"');
    expect(message).toContain('Perfil: Uso profissional');
    expect(message).toContain('mudancas em arquivos ou workspace');
    expect(message).toContain('A acao so continua se voce aprovar');
  });

  it('inspects invalid security profile configuration without silently blessing drift', () => {
    process.env.ZAVORTH_SECURITY_PROFILE = 'enterprisee';

    const inspection = inspectSecurityProfileConfiguration();

    expect(inspection.status).toBe('attention');
    expect(inspection.invalidValues).toEqual([
      expect.objectContaining({
        key: 'ZAVORTH_SECURITY_PROFILE',
        value: 'enterprisee',
      }),
    ]);
    expect(inspection.recommendations.join(' ')).toContain('personal, professional ou enterprise');
  });
});
