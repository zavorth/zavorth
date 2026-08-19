import { ZavorthCodebaseGraphService } from '../../../src/services/graph/ZavorthCodebaseGraphService';

describe('ZavorthCodebaseGraphService', () => {
  let service: ZavorthCodebaseGraphService;

  beforeEach(() => {
    service = new ZavorthCodebaseGraphService();
  });

  it('should index functions, classes, interfaces, and type aliases accurately without regex bugs', () => {
    const source = `
export interface UserToken {
  id: string;
}

export class AuthService {
  private secret = 'key';
}

export async function verifyToken(token: string): Promise<boolean> {
  return true;
}

type TokenPayload = { sub: string };
`;

    const symbols = service.indexSourceFile('src/auth/jwt.ts', source);

    expect(symbols.length).toBe(4);
    expect(symbols.find((s) => s.name === 'UserToken')?.kind).toBe('INTERFACE');
    expect(symbols.find((s) => s.name === 'AuthService')?.kind).toBe('CLASS');
    expect(symbols.find((s) => s.name === 'verifyToken')?.kind).toBe('FUNCTION');
    expect(symbols.find((s) => s.name === 'TokenPayload')?.kind).toBe('TYPE_ALIAS');
    expect(symbols.find((s) => s.name === 'verifyToken')?.isExported).toBe(true);
  });

  it('should perform cross-file impact analysis and identify dependent caller files', () => {
    const authCode = 'export function generateKey(): string { return "123"; }';
    const serverCode = 'export function startServer(): void { generateKey(); }';

    service.indexSourceFile('src/auth.ts', authCode);
    service.indexSourceFile('src/server.ts', serverCode);

    service.registerCallEdge('src/server.ts#startServer', 'src/auth.ts#generateKey', 'CALLS');

    const impact = service.getImpactAnalysis('src/auth.ts', 'generateKey');

    expect(impact).not.toBeNull();
    expect(impact?.totalImpactCount).toBe(1);
    expect(impact?.dependentFiles).toContain('src/server.ts');
    expect(impact?.riskRecommendation).toBe('REQUIRES_CALLER_UPDATES');
  });

  it('should return null when analyzing non-existent symbols', () => {
    const impact = service.getImpactAnalysis('src/missing.ts', 'ghostFunction');
    expect(impact).toBeNull();
  });
});
