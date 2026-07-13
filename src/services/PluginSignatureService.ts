import fs from 'node:fs';
import path from 'node:path';
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from 'node:crypto';

export type PluginVerifyStatus =
  | 'verified'
  | 'unsigned'
  | 'checksum_mismatch'
  | 'hmac_mismatch'
  | 'ed25519_invalid'
  | 'ed25519_mismatch'
  | 'signature_required'
  | 'error';

export type PluginVerifyResult = {
  ok: boolean;
  status: PluginVerifyStatus;
  packageChecksum?: string;
  expectedChecksum?: string | null;
  findings: string[];
};

export type PluginVerifyOptions = {
  requireSignature?: boolean;
  publicKeyPem?: string;
  hmacSecret?: string;
  privateKeyPem?: string;
};

export type PluginSignatureRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  env?: NodeJS.ProcessEnv;
};

export type PluginSignPackageResult = {
  ok: boolean;
  packageDir: string;
  packageChecksum: string;
  signaturePath: string;
  ed25519?: string;
  publicKeyId?: string | null;
  findings: string[];
};

const SKIP_NAMES = new Set([
  'node_modules',
  '.git',
  'SIGNATURE',
  'plugin.sig',
  '.DS_Store',
]);

/**
 * Package integrity helpers for Plugin OS installs.
 *
 * Strong proof accepted by requireSignature (ZAVORTH_PLUGIN_REQUIRE_SIGNATURE=1):
 * - valid ed25519 signature (sidecar or manifest.integrity.signature), OR
 * - valid hmac-sha256, OR
 * - matching declared integrity.checksum / sidecar sha256
 */
export class PluginSignatureService {
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly env: NodeJS.ProcessEnv;

  constructor(runtime: PluginSignatureRuntime = {}) {
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
    this.env = runtime.env || process.env;
  }

  /**
   * SHA-256 of sorted relative paths + file contents (hex, no prefix).
   */
  public computePackageChecksum(packageDir: string): string {
    const root = path.resolve(packageDir);
    const files = this.listPackageFiles(root);
    const hash = createHash('sha256');
    for (const relative of files) {
      const absolute = path.join(root, relative);
      hash.update(relative.replace(/\\/g, '/'));
      hash.update('\0');
      try {
        hash.update(this.readFileSync(absolute));
      } catch {
        hash.update('missing');
      }
      hash.update('\n');
    }
    return hash.digest('hex');
  }

  /**
   * Ed25519-sign a package checksum. Returns base64 signature.
   * privateKeyPemOrDer accepts PEM text or base64-encoded PKCS8/raw key material.
   */
  public signPackageChecksum(checksumHex: string, privateKeyPemOrDer: string): string {
    const key = resolvePrivateKey(privateKeyPemOrDer);
    const payload = Buffer.from(normalizeSha256(checksumHex) || String(checksumHex || '').trim(), 'utf8');
    const signature = cryptoSign(null, payload, key);
    return signature.toString('base64');
  }

  /**
   * Verify an Ed25519 signature over the package checksum.
   * Soft-fails (returns false) on malformed keys or crypto errors.
   */
  public verifyEd25519(
    checksumHex: string,
    signatureBase64: string,
    publicKeyPem: string,
  ): boolean {
    try {
      const key = resolvePublicKey(publicKeyPem);
      const payload = Buffer.from(normalizeSha256(checksumHex) || String(checksumHex || '').trim(), 'utf8');
      const signature = Buffer.from(String(signatureBase64 || '').trim(), 'base64');
      if (!signature.length) {
        return false;
      }
      return cryptoVerify(null, payload, key, signature);
    } catch {
      return false;
    }
  }

  public verifyPackage(
    packageDir: string,
    options: PluginVerifyOptions = {},
  ): PluginVerifyResult {
    const findings: string[] = [];
    const root = path.resolve(packageDir);
    if (!this.existsSync(root)) {
      return {
        ok: false,
        status: 'error',
        findings: [`package directory missing: ${root}`],
      };
    }

    let packageChecksum: string;
    try {
      packageChecksum = this.computePackageChecksum(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: 'error',
        findings: [`checksum failed: ${message}`],
      };
    }

    const integrity = this.readManifestIntegrity(root);
    const sidecar = this.readSidecarSignature(root);
    const expectedChecksum = integrity.checksum || sidecar.sha256 || null;

    const requireSignature = options.requireSignature === true
      || this.env.ZAVORTH_PLUGIN_REQUIRE_SIGNATURE === '1';

    const hmacSecret = options.hmacSecret
      || this.env.ZAVORTH_PLUGIN_HMAC_SECRET
      || '';

    const publicKey = options.publicKeyPem
      || this.env.ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY
      || '';

    const ed25519Signature = sidecar.ed25519 || integrity.signature || null;
    const publicKeyId = sidecar.publicKeyId || integrity.publicKeyId || null;

    if (expectedChecksum) {
      const normalized = normalizeSha256(expectedChecksum);
      if (normalized && normalized !== packageChecksum) {
        findings.push(
          `checksum mismatch expected=${normalized} actual=${packageChecksum}`,
        );
        return {
          ok: false,
          status: 'checksum_mismatch',
          packageChecksum,
          expectedChecksum: normalized,
          findings,
        };
      }
      if (normalized) {
        findings.push('package checksum matches declared integrity');
      }
    }

    let ed25519Ok = false;
    if (ed25519Signature) {
      if (!publicKey) {
        // Soft-fail: missing public key does not reject when another strong proof exists
        // (matching checksum / hmac). Require still enforced at the end.
        findings.push(
          'ed25519 signature present but no public key configured (ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY)',
        );
      } else {
        const valid = this.verifyEd25519(packageChecksum, ed25519Signature, publicKey);
        if (!valid) {
          findings.push('ed25519_mismatch');
          findings.push('ed25519 signature invalid');
          return {
            ok: false,
            status: 'ed25519_invalid',
            packageChecksum,
            expectedChecksum,
            findings,
          };
        }
        ed25519Ok = true;
        findings.push('ed25519_verified');
        if (publicKeyId) {
          findings.push(`public-key-id=${publicKeyId}`);
        }
      }
    }

    let hmacOk = false;
    if (sidecar.hmacSha256) {
      if (!hmacSecret) {
        // Soft-fail: missing secret does not reject when checksum/ed25519 already proves integrity.
        findings.push('hmac-sha256 present but no secret configured (ZAVORTH_PLUGIN_HMAC_SECRET)');
      } else {
        const expectedHmac = createHmac('sha256', hmacSecret)
          .update(packageChecksum)
          .digest('hex');
        if (expectedHmac !== normalizeSha256(sidecar.hmacSha256)) {
          findings.push('hmac-sha256 mismatch');
          return {
            ok: false,
            status: 'hmac_mismatch',
            packageChecksum,
            expectedChecksum,
            findings,
          };
        }
        hmacOk = true;
        findings.push('hmac-sha256 verified');
      }
    }

    const checksumOk = Boolean(
      expectedChecksum && normalizeSha256(expectedChecksum) === packageChecksum,
    );

    // requireSignature accepts ed25519 OR hmac OR matching declared checksum
    const hasStrongProof = ed25519Ok || hmacOk || checksumOk;

    if (requireSignature && !hasStrongProof) {
      findings.push('signature required but no valid ed25519/hmac/checksum found');
      return {
        ok: false,
        status: 'signature_required',
        packageChecksum,
        expectedChecksum,
        findings,
      };
    }

    if (!expectedChecksum && !sidecar.hmacSha256 && !sidecar.sha256 && !ed25519Signature) {
      findings.push('unsigned package (no integrity.checksum or SIGNATURE/plugin.sig)');
      return {
        ok: true,
        status: 'unsigned',
        packageChecksum,
        expectedChecksum: null,
        findings,
      };
    }

    return {
      ok: true,
      status: hasStrongProof ? 'verified' : 'unsigned',
      packageChecksum,
      expectedChecksum,
      findings,
    };
  }

  /**
   * Write SIGNATURE sidecar with sha256 and optional ed25519 signature.
   * Uses ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY when private key is not passed.
   */
  public signPackage(
    packageDir: string,
    options: {
      privateKeyPem?: string;
      publicKeyId?: string | null;
      yes?: boolean;
    } = {},
  ): PluginSignPackageResult {
    const root = path.resolve(packageDir);
    const findings: string[] = [];
    if (!this.existsSync(root)) {
      return {
        ok: false,
        packageDir: root,
        packageChecksum: '',
        signaturePath: path.join(root, 'SIGNATURE'),
        findings: [`package directory missing: ${root}`],
      };
    }

    const packageChecksum = this.computePackageChecksum(root);
    const privateKey = options.privateKeyPem
      || this.env.ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY
      || '';
    const publicKeyId = options.publicKeyId
      || this.env.ZAVORTH_PLUGIN_ED25519_PUBLIC_KEY_ID
      || null;

    const lines = [`sha256=${packageChecksum}`];
    let ed25519: string | undefined;

    if (privateKey) {
      try {
        ed25519 = this.signPackageChecksum(packageChecksum, privateKey);
        lines.push(`ed25519=${ed25519}`);
        if (publicKeyId) {
          lines.push(`public-key-id=${publicKeyId}`);
        }
        findings.push('ed25519 signature written');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        findings.push(`ed25519 sign failed: ${message}`);
      }
    } else {
      findings.push('no private key (ZAVORTH_PLUGIN_ED25519_PRIVATE_KEY); wrote sha256 only');
    }

    const signaturePath = path.join(root, 'SIGNATURE');
    this.writeFileSync(signaturePath, `${lines.join('\n')}\n`, 'utf8');
    findings.push(`wrote ${signaturePath}`);

    return {
      ok: true,
      packageDir: root,
      packageChecksum,
      signaturePath,
      ed25519,
      publicKeyId,
      findings,
    };
  }

  private readManifestIntegrity(packageDir: string): {
    checksum: string | null;
    signature: string | null;
    publicKeyId: string | null;
  } {
    for (const name of ['manifest.json', 'zavorth.plugin.json', 'plugin.json']) {
      const file = path.join(packageDir, name);
      if (!this.existsSync(file)) {
        continue;
      }
      try {
        const raw = JSON.parse(this.readFileSync(file, 'utf8')) as {
          integrity?: {
            checksum?: string;
            signature?: string;
            publicKeyId?: string;
            public_key_id?: string;
          };
          checksum?: string;
        };
        const integrity = raw.integrity || {};
        const checksum = integrity.checksum || raw.checksum || null;
        const signature = integrity.signature || null;
        const publicKeyId = integrity.publicKeyId || integrity.public_key_id || null;
        if (checksum || signature) {
          return {
            checksum: checksum ? String(checksum) : null,
            signature: signature ? String(signature) : null,
            publicKeyId: publicKeyId ? String(publicKeyId) : null,
          };
        }
      } catch {
        /* soft-fail */
      }
    }
    return { checksum: null, signature: null, publicKeyId: null };
  }

  private readSidecarSignature(packageDir: string): {
    sha256: string | null;
    hmacSha256: string | null;
    ed25519: string | null;
    publicKeyId: string | null;
  } {
    for (const name of ['SIGNATURE', 'plugin.sig']) {
      const file = path.join(packageDir, name);
      if (!this.existsSync(file)) {
        continue;
      }
      try {
        const text = this.readFileSync(file, 'utf8');
        const sha256 = matchField(text, 'sha256') || matchField(text, 'checksum');
        const hmacSha256 = matchField(text, 'hmac-sha256') || matchField(text, 'hmac');
        const ed25519 = matchField(text, 'ed25519') || matchField(text, 'signature');
        const publicKeyId = matchField(text, 'public-key-id') || matchField(text, 'publicKeyId');
        return { sha256, hmacSha256, ed25519, publicKeyId };
      } catch {
        /* soft-fail */
      }
    }
    return { sha256: null, hmacSha256: null, ed25519: null, publicKeyId: null };
  }

  private listPackageFiles(root: string): string[] {
    const results: string[] = [];
    const stack = [''];
    while (stack.length > 0) {
      const relative = stack.pop() as string;
      const absolute = relative ? path.join(root, relative) : root;
      let entries: string[] = [];
      try {
        entries = this.readdirSync(absolute);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (SKIP_NAMES.has(entry)) {
          continue;
        }
        const childRel = relative ? path.join(relative, entry) : entry;
        const childAbs = path.join(root, childRel);
        let stat: fs.Stats;
        try {
          stat = this.statSync(childAbs);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          stack.push(childRel);
        } else if (stat.isFile()) {
          results.push(childRel);
        }
      }
    }
    return results
      .map((item) => item.replace(/\\/g, '/'))
      .sort((left, right) => left.localeCompare(right));
  }
}

function matchField(text: string, field: string): string | null {
  const pattern = new RegExp(`(?:^|\\n)\\s*${field}\\s*[=:]\\s*(\\S+)`, 'i');
  const match = String(text || '').match(pattern);
  return match?.[1] ? String(match[1]).trim() : null;
}

function normalizeSha256(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^sha256:/i, '')
    .toLowerCase();
}

function resolvePrivateKey(privateKeyPemOrDer: string): KeyObject {
  const raw = String(privateKeyPemOrDer || '').trim();
  if (!raw) {
    throw new Error('empty private key');
  }
  if (raw.includes('BEGIN')) {
    return createPrivateKey(raw);
  }
  // Raw base64 PKCS8 or SPKI material
  const der = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  try {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch {
    return createPrivateKey({ key: der, format: 'der', type: 'sec1' });
  }
}

function resolvePublicKey(publicKeyPem: string): KeyObject {
  const raw = String(publicKeyPem || '').trim();
  if (!raw) {
    throw new Error('empty public key');
  }
  if (raw.includes('BEGIN')) {
    return createPublicKey(raw);
  }
  const der = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  try {
    return createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch {
    // 32-byte raw ed25519 public key — wrap as SPKI
    if (der.length === 32) {
      const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      return createPublicKey({
        key: Buffer.concat([spkiPrefix, der]),
        format: 'der',
        type: 'spki',
      });
    }
    throw new Error('unsupported public key format');
  }
}
