import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(__dirname, '../../scripts/zavorth-language-boundary-check.mjs');

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-language-boundary-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'produto', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'ai-gateway', 'i18n', 'messages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests', 'fixtures', 'multilingual'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'language-boundary-test' }));
  return root;
}

function runCheck(root: string) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('zavorth-language-boundary-check', () => {
  it('blocks Portuguese hardcoded in runtime source', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'src', 'runtime-copy.ts'), 'export const copy = "Aprovacao pendente";\n');

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr || result.stdout).toContain('src/runtime-copy.ts');
    expect(result.stderr || result.stdout).toContain('Move user-facing copy into i18n catalogs');
  });

  it('allows Portuguese in pt i18n catalogs and explicit multilingual fixtures', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'src', 'runtime-copy.ts'), 'export const copy = "Approval pending";\n');
    fs.writeFileSync(path.join(root, 'src', 'ai-gateway', 'i18n', 'messages', 'pt-BR.json'), JSON.stringify({
      approvalPending: 'Aprovacao pendente',
    }));
    fs.writeFileSync(
      path.join(root, 'tests', 'fixtures', 'multilingual', 'portuguese-intent.fixture.ts'),
      '// @zavorth-allow-portuguese-fixture\nexport const sample = "Usuario prefere respostas em portugues";\n',
    );

    const result = runCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[zavorth-language-boundary] ok');
  });

  it('blocks obsolete immediate-install skill documentation', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'src', 'runtime-copy.ts'), 'export const copy = "Approval pending";\n');
    fs.writeFileSync(
      path.join(root, 'docs', 'produto', 'skills', 'criar.md'),
      'Skills are plain Markdown files. If Zavorth can read it, it can run it.\n\nApprove it and it is installed immediately.\n',
    );

    const result = runCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr || result.stdout).toContain('obsolete immediate-install claim');
  });
});
