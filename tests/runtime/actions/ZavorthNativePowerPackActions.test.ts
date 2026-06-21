import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthActionCatalog, ZavorthActionGateway } from '../../../src/runtime/actions';

const POWER_PACK_ACTIONS = [
  'google.workspace.status',
  'gmail.search',
  'gmail.draft',
  'gmail.send',
  'google.drive.search',
  'google.drive.read_file',
  'google.calendar.list',
  'google.calendar.create',
  'google.calendar.update',
  'google.tasks.list',
  'google.tasks.create',
  'google.tasks.update',
  'media.status',
  'media.image.generate',
  'media.image.analyze',
  'media.speech.synthesize',
  'memory.deep.review',
  'memory.deep.resolve',
  'memory.deep.correct',
  'memory.deep.forget',
  'documents.extract',
  'wiki.search',
  'canvas.render',
  'computer.screenshot',
  'computer.vision',
  'computer.media_control',
  'devices.iot.status',
  'devices.iot.mqtt_publish',
];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-native-power-pack-actions-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'guide.md'), '# Native Wiki\n\nPower pack searchable text.');
  fs.writeFileSync(path.join(root, 'note.md'), 'Document extraction target.');
  return root;
}

describe('Zavorth native power pack actions', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('registers Google, media, deep memory, docs/wiki/canvas and device packs as verified LLM actions', () => {
    const actions = new ZavorthActionCatalog().list();
    const byId = new Map(actions.map((action) => [action.id, action]));

    for (const id of POWER_PACK_ACTIONS) {
      expect(byId.get(id)).toEqual(expect.objectContaining({
        verificationStatus: 'verified',
        surface: expect.arrayContaining(['llm']),
        capabilityId: expect.stringMatching(/^native-/),
      }));
    }

    for (const id of [
      'gmail.send',
      'google.calendar.create',
      'media.image.generate',
      'memory.deep.correct',
      'canvas.render',
      'computer.screenshot',
      'devices.iot.mqtt_publish',
    ]) {
      expect(byId.get(id)).toEqual(expect.objectContaining({
        requiresPreview: true,
        requiresApproval: true,
        receiptPolicy: 'required',
      }));
    }
  });

  it('runs safe read/preview actions through the gateway', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const google = await gateway.apply('google.workspace.status', {});
    const docs = await gateway.apply('documents.extract', { filePath: 'note.md' });
    const wiki = await gateway.apply('wiki.search', { query: 'searchable' });
    const memory = await gateway.apply('memory.deep.review', { workspaceHint: root });

    expect(google.ok).toBe(true);
    expect(JSON.stringify(google)).not.toMatch(/Bearer|secret-token|access_token/i);
    expect(docs.ok).toBe(true);
    expect(docs.data?.textPreview).toContain('Document extraction target');
    expect(wiki.ok).toBe(true);
    expect(wiki.data?.hits).toEqual(expect.arrayContaining([expect.objectContaining({ file: 'docs/guide.md' })]));
    expect(memory.ok).toBe(true);
  });

  it('keeps personal, external, media, memory mutation and device control actions approval-gated', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    for (const [actionId, args] of [
      ['gmail.send', { to: 'a@example.com', subject: 'Hi', body: 'Hello' }],
      ['google.drive.search', { query: 'budget' }],
      ['google.calendar.create', { title: 'Meet', startsAt: '2026-01-01T10:00:00Z', endsAt: '2026-01-01T11:00:00Z' }],
      ['media.image.generate', { prompt: 'A native diagram' }],
      ['memory.deep.correct', { userId: 'u1', key: 'preference.theme', value: 'dark' }],
      ['canvas.render', { title: 'Plan', content: 'Native packs' }],
      ['computer.screenshot', { mode: 'fullscreen' }],
      ['devices.iot.mqtt_publish', { topic: 'zavorth/test', message: 'hello' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const result = await gateway.apply(actionId, args);
      expect(result.status).toBe('approval_required');
      expect(result.summary).toMatch(/approval required/i);
    }
  });

  it('applies approved local artifact actions and leaves receipts', async () => {
    const root = makeRoot();
    roots.push(root);
    const gateway = new ZavorthActionGateway({ root });

    const image = await gateway.apply('media.image.generate', { prompt: 'Native artifact' }, { trustedOperatorConfirmation: true });
    const canvas = await gateway.apply('canvas.render', { title: 'Native Canvas', content: 'Rendered by Action Harness' }, { trustedOperatorConfirmation: true });

    expect(image.ok).toBe(true);
    expect(image.receipt?.status).toBe('applied');
    expect(fs.existsSync(path.join(root, String(image.data?.artifactPath)))).toBe(true);
    expect(canvas.ok).toBe(true);
    expect(canvas.receipt?.status).toBe('applied');
    expect(fs.existsSync(path.join(root, String(canvas.data?.artifactPath)))).toBe(true);
  });
});
