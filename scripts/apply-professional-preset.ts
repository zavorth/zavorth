import { applySecurityOperationalPreset } from '../src/security/SecurityOperationalPreset.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const result = applySecurityOperationalPreset({
    preset: 'professional',
    projectRoot: path.resolve(__dirname, '..'),
    appliedBy: 'developer-manual-fix',
  });
  console.log('Preset applied successfully!');
  console.log(result.summary);
} catch (error: unknown) {
  console.error('Failed to apply preset:', error);
  process.exit(1);
}
