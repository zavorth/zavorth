import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkflowTemplateService } from '../../src/services/WorkflowTemplateService';

describe('WorkflowTemplateService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts with zero templates when no WORKFLOWS.md exists', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.templateCount).toBe(0);
    expect(status.filePath).toBe(path.join(tempDir, 'WORKFLOWS.md'));
  });

  it('adds a template and persists it to WORKFLOWS.md', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });

    const template = service.addTemplate({
      id: 'bug-fix',
      label: 'Bug Fix Workflow',
      description: 'Standard bug fix process',
      steps: [
        { order: 1, description: 'Reproduce the bug' },
        { order: 2, description: 'Write failing test' },
        { order: 3, description: 'Fix the bug' },
      ],
      triggers: ['bug', 'fix'],
      tags: ['engineering'],
    });

    expect(template.id).toBe('bug-fix');
    expect(template.label).toBe('Bug Fix Workflow');
    expect(template.steps.length).toBe(3);
    expect(fs.existsSync(path.join(tempDir, 'WORKFLOWS.md'))).toBe(true);
    const fileContent = fs.readFileSync(path.join(tempDir, 'WORKFLOWS.md'), 'utf8');
    expect(fileContent).toContain('Bug Fix Workflow');
    expect(fileContent).toContain('<!-- id:bug-fix -->');
  });

  it('lists templates after adding multiple', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });
    service.addTemplate({ id: 't1', label: 'Template 1', description: 'First', steps: [{ order: 1, description: 'Step 1' }], triggers: [], tags: [] });
    service.addTemplate({ id: 't2', label: 'Template 2', description: 'Second', steps: [{ order: 1, description: 'Step 1' }], triggers: [], tags: [] });

    const templates = service.listTemplates();

    expect(templates.length).toBe(2);
    expect(templates.map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't2']));
  });

  it('removes a template by id', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });
    service.addTemplate({ id: 'to-delete', label: 'Delete Me', description: 'Temp', steps: [{ order: 1, description: 'Step' }], triggers: [], tags: [] });

    const removed = service.removeTemplate('to-delete');

    expect(removed).toBe(true);
    expect(service.listTemplates().length).toBe(0);
  });

  it('returns false when removing a non-existent template', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });

    const removed = service.removeTemplate('nonexistent');

    expect(removed).toBe(false);
  });

  it('renders steps for a given template id', () => {
    const service = new WorkflowTemplateService({ projectRoot: tempDir });
    service.addTemplate({
      id: 'deploy',
      label: 'Deploy',
      description: 'Deploy workflow',
      steps: [
        { order: 1, description: 'Build', tool: 'shell.execute' },
        { order: 2, description: 'Test', command: 'npm test' },
      ],
      triggers: ['deploy'],
      tags: ['ops'],
    });

    const rendered = service.renderSteps('deploy');

    expect(rendered).toContain('## Deploy');
    expect(rendered).toContain('1. Build');
    expect(rendered).toContain('2. Test');
  });
});
