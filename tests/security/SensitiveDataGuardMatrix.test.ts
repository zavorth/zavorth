import { detectSensitiveData, redactSensitiveData } from '../../src/security/SensitiveDataGuard.js';

describe('SensitiveDataGuard Combinatorial Matrix Tests', () => {
  const baseValues = [
    { type: 'openai', val: 'sk-12345678901234567890', isSecret: true },
    { type: 'bearer', val: 'Bearer abcdefghijklmnopqrstuvwxyz', isSecret: true },
    { type: 'github', val: 'ghp_12345678901234567890', isSecret: true },
    { type: 'slack', val: 'xoxb-1234567890-1234567890-abcdefghijklmnopqrstuvwx', isSecret: true },
    { type: 'aws', val: 'AKIA1234567890123456', isSecret: true },
    { type: 'gcp', val: 'AIzaSyA_123456789012345678901234567890', isSecret: true },
    { type: 'jwt', val: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', isSecret: true },
    { type: 'secret-ref', val: 'secret-ref:vault/my_secret', isSecret: false },
    { type: 'redacted', val: '[redacted-secret]', isSecret: false },
    { type: 'normal', val: 'just a normal string with numbers 1234567890', isSecret: false }
  ];

  const placements = [
    { name: 'bare', fn: (v: string) => v },
    { name: 'start', fn: (v: string) => `${v} and some trailing text` },
    { name: 'middle', fn: (v: string) => `leading text ${v} trailing text` },
    { name: 'end', fn: (v: string) => `leading text and then ${v}` }
  ];

  const keys = [
    { name: 'normal_key', isSensitiveKey: false },
    { name: 'apiKey', isSensitiveKey: true },
    { name: 'my_secret_token', isSensitiveKey: true },
    { name: 'AUTHORIZATION', isSensitiveKey: true },
    { name: 'password123', isSensitiveKey: true },
    { name: 'randomField', isSensitiveKey: false }
  ];

  const wrappers = [
    { name: 'flat-string', build: (k: string, v: string) => v },
    { name: 'flat-object', build: (k: string, v: string) => ({ [k]: v, other: 'data' }) },
    { name: 'nested-object', build: (k: string, v: string) => ({ root: { child: { [k]: v } } }) },
    { name: 'array', build: (k: string, v: string) => [{ [k]: v }, { unrelated: true }] },
    { name: 'circular', build: (k: string, v: string) => {
        const obj: any = { [k]: v };
        obj.self = obj;
        return obj;
      }
    }
  ];

  const methods = ['detect', 'redact'];

  let testCount = 0;

  methods.forEach((method) => {
    describe(`Method: ${method}`, () => {
      wrappers.forEach((wrapper) => {
        describe(`Wrapper: ${wrapper.name}`, () => {
          keys.forEach((keyConfig) => {
            baseValues.forEach((baseVal) => {
              placements.forEach((placement) => {
                testCount++;
                const testName = `handles ${baseVal.type} at ${placement.name} in key ${keyConfig.name}`;

                it(testName, () => {
                  const finalValue = placement.fn(baseVal.val);
                  const payload = wrapper.build(keyConfig.name, finalValue);
                  
                  // A payload is considered sensitive if the base value matches a secret pattern,
                  // OR if the key name is sensitive and the value is not an allowed reference/empty.
                  const hasSecretPattern = baseVal.isSecret;
                  const isBare = placement.name === 'bare';
                  const isAllowedRef = (baseVal.type === 'secret-ref' || baseVal.type === 'redacted') && isBare;
                  const hasSensitiveKey = keyConfig.isSensitiveKey && !isAllowedRef;
                  
                  // However, for flat strings, the key is completely ignored because it's just a string!
                  const expectsFinding = wrapper.name === 'flat-string' 
                    ? hasSecretPattern 
                    : (hasSecretPattern || hasSensitiveKey);

                  if (method === 'detect') {
                    const findings = detectSensitiveData(payload);
                    if (expectsFinding) {
                      expect(findings.length).toBeGreaterThan(0);
                      // Make sure there are no circular reference crashes
                      if (wrapper.name === 'circular') {
                        expect(findings[0].path).toBeDefined();
                      }
                    } else {
                      expect(findings.length).toBe(0);
                    }
                  } else if (method === 'redact') {
                    const redacted = redactSensitiveData(payload);
                    let redactedStr: string;
                    if (typeof redacted === 'string') {
                      redactedStr = redacted;
                    } else {
                      const seenNodes = new WeakSet();
                      redactedStr = JSON.stringify(redacted, (k, v) => {
                        if (typeof v === 'object' && v !== null) {
                          if (seenNodes.has(v)) return '[Circular]';
                          seenNodes.add(v);
                        }
                        return v;
                      }) || '';
                    }
                    
                    if (expectsFinding) {
                      expect(redactedStr).toContain('[redacted-secret]');
                      if (baseVal.type !== 'redacted') {
                        expect(redactedStr).not.toContain(baseVal.val);
                      }
                    } else {
                      // If it's a circular object, JSON.stringify would fail, but our logic handles it.
                      if (wrapper.name === 'circular') {
                        expect(redacted).toHaveProperty('self');
                      } else {
                        // The original value should remain mostly intact
                        if (baseVal.type === 'normal') {
                          expect(redactedStr).toContain('1234567890');
                        }
                      }
                    }
                  }
                });
              });
            });
          });
        });
      });
    });
  });

  it('sanity checks total permutations for SensitiveDataGuardMatrix', () => {
    // 2 methods * 5 wrappers * 6 keys * 10 values * 4 placements = 2400 tests
    expect(testCount).toBe(2400);
  });
});
