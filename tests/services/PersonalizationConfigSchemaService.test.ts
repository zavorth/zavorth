import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PersonalizationConfigSchemaService } from '../../src/services/PersonalizationConfigSchemaService';

describe('PersonalizationConfigSchemaService', () => {
  it('validates required identity, user and soul fields with .zavorth/profile preference', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-personalization-'));
    const profile = path.join(root, '.zavorth', 'profile');
    fs.mkdirSync(profile, { recursive: true });
    fs.writeFileSync(path.join(profile, 'identity.md'), '- **Primary name:** Zavorth\n- **Role:** Agent\n- **Core promise:** Governed action\n', 'utf8');
    fs.writeFileSync(path.join(profile, 'user.md'), '- **What to call them:** User\n- **Primary language:** en-US\n- **Preferred tone from the agent:** direct\n', 'utf8');
    fs.writeFileSync(path.join(profile, 'soul.md'), '## Baseline character\nCalm.\n', 'utf8');

    const result = new PersonalizationConfigSchemaService({ projectRoot: root }).validate();

    expect(result.ok).toBe(true);
    expect(result.resolvedFiles.identity).toContain('.zavorth');
  });
});
