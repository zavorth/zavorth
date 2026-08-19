import fs from 'fs';
import path from 'path';


describe('Self-modification docs', () => {
  it('documents preview as the default mode and apply as explicit', () => {
    const docPath = path.resolve(__dirname, '../../docs', 'self-modification.md');
    const content = fs.readFileSync(docPath, 'utf8');

    expect(content).toContain('/selfmod <relative_file> -- <instruction>');
    expect(content).toContain('/selfmod goal -- <goal>');
    expect(content).toContain('/selfmod apply <preview_id>');
    expect(content).toContain('/selfmod rollback <change_id>');
    expect(content).toContain('preview` is the default mode and never writes to the file:');
    expect(content).toContain('apply` is explicit and only applies a proposal previously reviewed by `preview_id`:');
    expect(content).toContain('apply` and `rollback` are restricted to `owner` or `trusted` users.');
    expect(content).toContain('private chat and requires `BUILD` mode.');
  });

  it('links the README to the dedicated self-modification guide', () => {
    const readmePath = path.resolve(__dirname, '../../README.md');
    const content = fs.readFileSync(readmePath, 'utf8');

    expect(content).toContain('docs/self-modification.md');
    expect(content).toContain('/selfmod <relative_file> -- <instruction>');
    expect(content).toContain('/selfmod goal -- <goal>');
    expect(content).toContain('/selfmod apply <preview_id>');
  });
});
