import fs from 'fs';
import path from 'path';

describe('Self-modification docs', () => {
  it('documents preview as the default mode and apply as explicit', () => {
    const docPath = path.resolve(process.cwd(), 'docs', 'self-modification.md');
    const content = fs.readFileSync(docPath, 'utf8');

    expect(content).toContain('/selfmod <arquivo_relativo> -- <instrucao>');
    expect(content).toContain('/selfmod goal -- <objetivo>');
    expect(content).toContain('/selfmod apply <preview_id>');
    expect(content).toContain('/selfmod rollback <change_id>');
    expect(content).toContain('preview` e o modo padrao e nunca escreve no arquivo.');
    expect(content).toContain('apply` e explicito e so aplica uma proposta previamente revisada por `preview_id`.');
    expect(content).toContain('`apply` e `rollback` ficam restritos a `owner` ou `trusted`');
    expect(content).toContain('chat privado e exige modo `BUILD`');
  });

  it('links the README to the dedicated self-modification guide', () => {
    const readmePath = path.resolve(process.cwd(), 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');

    expect(content).toContain('docs/self-modification.md');
    expect(content).toContain('/selfmod <arquivo_relativo> -- <instrucao>');
    expect(content).toContain('/selfmod goal -- <objetivo>');
    expect(content).toContain('/selfmod apply <preview_id>');
  });
});
