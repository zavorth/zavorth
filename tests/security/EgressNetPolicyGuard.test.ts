import { describe, it, expect } from '@jest/globals';
import { EgressNetPolicyGuard } from '../../src/security/EgressNetPolicyGuard.js';

describe('EgressNetPolicyGuard (SSRF & Metadata Protection)', () => {
  it('should block AWS/GCP instance metadata IP 169.254.169.254 unconditionally', () => {
    const result = EgressNetPolicyGuard.validateUrl('http://169.254.169.254/latest/meta-data/');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('metadata');
  });

  it('should block GCP metadata hostname metadata.google.internal', () => {
    const result = EgressNetPolicyGuard.validateUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('metadata');
  });

  it('should block dangerous ports like 22 (SSH) and 445 (SMB)', () => {
    const resultSsh = EgressNetPolicyGuard.validateUrl('http://example.com:22/');
    expect(resultSsh.allowed).toBe(false);
    expect(resultSsh.reason).toContain('dangerous egress port');

    const resultSmb = EgressNetPolicyGuard.validateUrl('http://example.com:445/');
    expect(resultSmb.allowed).toBe(false);
  });

  it('should allow public https targets', () => {
    const result = EgressNetPolicyGuard.validateUrl('https://api.github.com/repos');
    expect(result.allowed).toBe(true);
  });

  it('should block local loopback unless allowLoopback is true', () => {
    const blocked = EgressNetPolicyGuard.validateUrl('http://localhost:3000/api');
    expect(blocked.allowed).toBe(false);

    const allowed = EgressNetPolicyGuard.validateUrl('http://localhost:3000/api', { allowLoopback: true });
    expect(allowed.allowed).toBe(true);
  });
});
