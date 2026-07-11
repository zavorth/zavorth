import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { SupplyChainVerifier } from '../../src/security/SupplyChainVerifier.js';

describe('SupplyChainVerifier', () => {
  let verifier: SupplyChainVerifier;
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-test-'));
    verifier = new SupplyChainVerifier({
      trustedKeysPath: path.join(tempDir, 'trust.json'),
      autoTrustOnFirstUse: true,
    });
    testFile = path.join(tempDir, 'test-skill.txt');
    fs.writeFileSync(testFile, 'test content');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('verifies a skill file', async () => {
    const result = await verifier.verifySkill(testFile);
    expect(result.verified).toBe(true);
    expect(result.hash).toBeTruthy();
    expect(result.hashMatch).toBe(true);
    expect(result.firstSeen).toBe(true);
  });

  it('verifies with matching hash', async () => {
    const hash = await verifier.calculateHash(testFile);
    const result = await verifier.verifySkill(testFile, hash);
    expect(result.verified).toBe(true);
    expect(result.hashMatch).toBe(true);
  });

  it('fails with non-matching hash', async () => {
    const result = await verifier.verifySkill(testFile, 'wrong_hash');
    expect(result.verified).toBe(false);
    expect(result.hashMatch).toBe(false);
  });

  it('tracks first seen', async () => {
    await verifier.verifySkill(testFile);
    const result = await verifier.verifySkill(testFile);
    expect(result.firstSeen).toBe(false);
    expect(result.verified).toBe(true);
  });

  it('increments verification count', async () => {
    await verifier.verifySkill(testFile);
    await verifier.verifySkill(testFile);
    const fp = verifier.getFingerprint(testFile);
    expect(fp?.verificationCount).toBe(2);
  });

  it('adds and verifies trusted keys', () => {
    const key = verifier.addTrustedKey('test-key', 'public-key-data');
    expect(key.name).toBe('test-key');
    expect(key.fingerprint).toBeTruthy();

    const keys = verifier.listTrustedKeys();
    expect(keys.length).toBe(1);
  });

  it('removes trusted keys', () => {
    const key = verifier.addTrustedKey('test-key', 'public-key-data');
    const removed = verifier.removeTrustedKey(key.fingerprint);
    expect(removed).toBe(true);
    expect(verifier.listTrustedKeys().length).toBe(0);
  });

  it('lists verified skills', async () => {
    await verifier.verifySkill(testFile);
    const skills = verifier.listVerifiedSkills();
    expect(skills.length).toBe(1);
    expect(skills[0].path).toBe(testFile);
  });

  it('checks if skill has been seen', async () => {
    expect(verifier.hasSeen(testFile)).toBe(false);
    await verifier.verifySkill(testFile);
    expect(verifier.hasSeen(testFile)).toBe(true);
  });

  it('calculates hash for directory', async () => {
    const dir = path.join(tempDir, 'skill-dir');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir, 'file2.txt'), 'content2');

    const hash = await verifier.calculateHash(dir);
    expect(hash).toBeTruthy();
  });

  it('verifies trusted signatures for files and rejects tampering', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    verifier.addTrustedKey('test-signer', publicPem);

    const signature = verifier.signSkill(testFile, privatePem);
    const valid = await verifier.verifySkill(testFile, undefined, signature);
    expect(valid.verified).toBe(true);
    expect(valid.signatureValid).toBe(true);
    expect(valid.trustedKey).toBe(true);

    fs.writeFileSync(testFile, 'tampered content');
    const tampered = await verifier.verifySkill(testFile, undefined, signature);
    expect(tampered.verified).toBe(false);
    expect(tampered.signatureValid).toBe(false);
  });

  it('signs directories and rejects signatures from untrusted keys', async () => {
    const skillDir = path.join(tempDir, 'signed-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'safe instructions');
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const signature = verifier.signSkill(skillDir, privatePem);
    const result = await verifier.verifySkill(skillDir, undefined, signature);
    expect(result.verified).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.trustedKey).toBe(false);
  });

  it('fails closed for malformed signature envelopes', async () => {
    const result = await verifier.verifySkill(testFile, undefined, 'not-a-signed-envelope');
    expect(result.verified).toBe(false);
    expect(result.signatureValid).toBe(false);
  });

  it('exports report', async () => {
    await verifier.verifySkill(testFile);
    const report = verifier.exportReport();
    const data = JSON.parse(report);
    expect(data.trustedKeys).toBeDefined();
    expect(data.verifiedSkills).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it('gets stats', async () => {
    await verifier.verifySkill(testFile);
    const stats = verifier.getStats();
    expect(stats.verifiedSkills).toBe(1);
    expect(stats.totalVerifications).toBe(1);
  });
});
