import fs from 'node:fs';
import path from 'node:path';
import { ProductEvidenceScorecardService } from '../../../src/services/ProductEvidenceScorecardService.js';
import type { ProductEvidenceClaimManifest } from '../../../src/contracts/ProductEvidenceScorecardContract.js';


const claim: ProductEvidenceClaimManifest = { id: 'security-proof', category: 'security', claim: { 'en-US': 'Security gate passes.', 'pt-BR': 'O gate de security passa.' }, evidence: { script: 'security:precommit', artifacts: ['proof.json'], maxAgeHours: 24 }, provenance: { source: 'CI', owner: 'Zavorth' } };
const now = new Date('2026-07-15T12:00:00.000Z');

describe('ProductEvidenceScorecardService', () => {
  const service = new ProductEvidenceScorecardService(() => now);
  it('makes a claim marketable only after reproducible evidence passes', () => {
    const result = service.build({ claims: [claim], executions: [{ script: 'security:precommit', exitCode: 0, completedAt: now.toISOString(), outputDigest: 'sha256', artifactsPresent: ['proof.json'] }], locale: 'pt-BR' });
    expect(result.claims[0]).toMatchObject({ status: 'verified', marketable: true, text: 'O gate de security passa.' });
    expect(result.benchmarkPolicy.externalScoresAssigned).toBe(false);
  });
  it.each([
    ['missing', [], 'evidence-missing'],
    ['failed', [{ script: 'security:precommit', exitCode: 1, completedAt: now.toISOString(), outputDigest: 'x', artifactsPresent: ['proof.json'] }], 'evidence-command-failed'],
    ['stale', [{ script: 'security:precommit', exitCode: 0, completedAt: '2026-07-01T00:00:00.000Z', outputDigest: 'x', artifactsPresent: ['proof.json'] }], 'evidence-stale'],
    ['artifact missing', [{ script: 'security:precommit', exitCode: 0, completedAt: now.toISOString(), outputDigest: 'x', artifactsPresent: [] }], 'evidence-artifact-missing'],
  ])('rejects %s evidence', (_label, executions, reason) => {
    const result = service.build({ claims: [claim], executions: executions as never, locale: 'en-US' });
    expect(result.claims[0]).toMatchObject({ status: 'unverified', marketable: false });
    expect(result.claims[0]?.reasons).toContain(reason);
  });
  it('rejects command injection and missing provenance', () => {
    const fake = { ...claim, evidence: { ...claim.evidence, script: 'qa:good; curl attacker' }, provenance: { source: '', owner: '' } };
    expect(service.build({ claims: [fake], executions: [] }).claims[0]?.reasons).toEqual(expect.arrayContaining(['evidence-command-not-allowlisted', 'provenance-missing']));
  });
  it('renders English and Portuguese without assigning external scores', () => {
    const executions = [{ script: 'security:precommit', exitCode: 0, completedAt: now.toISOString(), outputDigest: 'x', artifactsPresent: ['proof.json'] }];
    expect(service.render(service.build({ claims: [claim], executions: executions as never, locale: 'en' }))).toContain('Product evidence scorecard');
    expect(service.render(service.build({ claims: [claim], executions: executions as never, locale: 'pt' }))).toContain('Evidence scorecard');
  });
  it('keeps the evidence manifest valid UTF-8 without mojibake', () => {
    const source = fs.readFileSync(path.join(__dirname, 'config', 'product-evidence-claims.json'), 'utf8');
    expect(source).not.toMatch(new RegExp('\\u00c3.|\\u00c2.|-|\\uFFFD'));
    expect(JSON.parse(source).claims.every((item: any) => item.claim['pt-BR'] && item.claim['en-US'])).toBe(true);
  });
});
