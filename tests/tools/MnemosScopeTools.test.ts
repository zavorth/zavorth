
import { EnableMnemosTool } from '../../src/tools/EnableMnemosTool';
import { PlanMnemosScopeTool } from '../../src/tools/PlanMnemosScopeTool';
import fs from 'fs';
import path from 'path';

describe('Mnemos scope tools', () => {
  it('plans a natural-language whole-computer scope without applying it', async () => {
    const tool = new PlanMnemosScopeTool();
    const raw = await tool.execute({
      user_text: 'Pode procurar no meu PC inteiro',
      vault_dir: 'data/mnemos_vault',
    });
    const parsed = JSON.parse(raw);

    expect(parsed.ok).toBe(true);
    expect(parsed.risk).toBe('critical');
    expect(parsed.enableMnemosArgs.wide_scope_confirmed).toBe(false);
    expect(parsed.humanPrompt).toContain('Risk: critical');
  });

  it('blocks root scan configuration until wide scope is confirmed', async () => {
    const tool = new EnableMnemosTool();
    const raw = await tool.execute({
      vault_dir: 'data/mnemos_vault',
      scan_dirs: 'C:\\',
    });

    expect(raw).toContain('BLOQUEADO');
    expect(raw).toContain('wide_scope_confirmed=true');
  });

  it('keeps Mnemos file understanding scoped to authorized volumes', () => {
    const serverPath = path.resolve(process.cwd(), 'apps', 'mnemos', 'server.py');
    const source = fs.readFileSync(serverPath, 'utf8');

    expect(source).toContain('def _resolve_authorized_file');
    expect(source).toContain('File outside authorized Mnemos volumes');
    expect(source).toContain('understanding = _build_universal_understanding(str(fp))');
  });
});
