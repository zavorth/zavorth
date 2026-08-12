import * as fs from 'fs';
import * as path from 'path';
import { asErrorLike } from '../../src/utils/errorLike';

describe('Tool Security Leak Test', () => {
  it('ensures no tool imports ProviderSecretStore or accesses secrets directly', () => {
    const toolsDir = path.join(__dirname, '../../src/tools');
    
    if (!fs.existsSync(toolsDir)) {
      console.warn('Tools directory not found. Skipping static analysis.');
      return;
    }

    const files = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(toolsDir, file), 'utf8');
      
      // No tool should import ProviderSecretStore
      expect(content).not.toMatch(/ProviderSecretStore/);
      
      // No tool should directly query provider_secret_refs or provider_secret_ciphertexts
      expect(content).not.toMatch(/provider_secret_refs/);
      expect(content).not.toMatch(/provider_secret_ciphertexts/);
    }
  });

  it('ensures adapters do not import ProviderSecretStore', () => {
    const adaptersDir = path.join(__dirname, '../../src/adapters');
    
    if (!fs.existsSync(adaptersDir)) {
      console.warn('Adapters directory not found. Skipping static analysis.');
      return;
    }

    const walkSync = (dir: string, filelist: string[] = []) => {
      fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        try {
          filelist = fs.statSync(dirFile).isDirectory() ? walkSync(dirFile, filelist) : filelist.concat(dirFile);
        } catch (error: unknown) {
          const err = asErrorLike(error);

          if ((err as any).code === 'ENOENT' || (err as any).code === 'EPERM') return;
          throw err;
        }
      });
      return filelist;
    };

    const files = walkSync(adaptersDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      // No adapter should import ProviderSecretStore directly. They should use the core injected clients!
      expect(content).not.toMatch(/ProviderSecretStore/);
    }
  });
});
