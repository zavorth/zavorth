import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { Database } from '../../src/storage/Database';

describe('ProviderSecretStore Security Tests (Phase 21H)', () => {
  let store: LocalEncryptedProviderSecretStore;
  const testProviderId = 'test-provider-123';
  const testSecret = 'sk-zavorth-test-secret-DO-NOT-LEAK-21H';
  let db: any;
  let originalMasterKeyPath: string | null = null;

  beforeAll(async () => {
    // Reset any existing master key to ensure deterministic testing
    const keyPath = path.join(os.homedir(), '.zavorth', 'provider_master_key');
    if (fs.existsSync(keyPath)) {
      originalMasterKeyPath = fs.readFileSync(keyPath, 'utf8');
      fs.unlinkSync(keyPath);
    }
    
    // Initialize DB explicitly if needed or clear rows
    db = await Database.getInstance();
    await db.run('DELETE FROM provider_secret_ciphertexts', []);
    await db.run('DELETE FROM provider_secret_refs', []);
    await db.run('DELETE FROM provider_config WHERE provider_id = ?', [testProviderId]);
    await db.run("INSERT INTO provider_config (provider_id, type, display_name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))", [testProviderId, 'openai-compatible', 'Test Provider']);
    
    store = LocalEncryptedProviderSecretStore.getInstance();
  });

  afterAll(async () => {
    // Restore master key
    const keyPath = path.join(os.homedir(), '.zavorth', 'provider_master_key');
    if (originalMasterKeyPath) {
      if (!fs.existsSync(path.dirname(keyPath))) {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      }
      fs.writeFileSync(keyPath, originalMasterKeyPath, { mode: 0o600 });
    }
  });

  it('salva uma API key com marcador unico garantindo que nao aparece em texto claro no sqlite', async () => {
    const result = await store.saveSecret(testProviderId, testSecret);
    expect(result.secretRef).toBeDefined();

    // Directly query database to prove no leaks
    const refs = await db.all('SELECT * FROM provider_secret_refs WHERE secret_ref = ?', [result.secretRef]);
    expect(refs.length).toBe(1);
    
    const ciphertexts = await db.all('SELECT * FROM provider_secret_ciphertexts WHERE secret_ref = ?', [result.secretRef]);
    expect(ciphertexts.length).toBe(1);

    // 1. Garante que provider_secret_refs contém só suffix/fingerprint/ref (NO raw key)
    const refStr = JSON.stringify(refs[0]);
    expect(refStr).not.toContain(testSecret);
    expect(refs[0].key_suffix).toBe('-21H');
    expect(refs[0].secret_store_type).toBe('encrypted_local_fallback');

    // 2. Garante que ciphertext não contém a key em claro
    const cipherStr = JSON.stringify(ciphertexts[0]);
    expect(cipherStr).not.toContain(testSecret);

    // 3. Try searching across entire DB for the raw secret string (brute force proof)
    const rawTables = await db.all("SELECT name FROM sqlite_master WHERE type='table'", []);
    for (const table of rawTables) {
      const rows = await db.all(`SELECT * FROM ${table.name}`, []);
      const rowsStr = JSON.stringify(rows);
      if (table.name !== 'sqlite_sequence') {
        expect(rowsStr).not.toContain(testSecret);
      }
    }

    // 4. Retrieving via proper API restores the key successfully
    const retrieved = await store.getSecret(result.secretRef);
    expect(retrieved).toBe(testSecret);
  });
});
