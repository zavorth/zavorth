import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 AboutYouService,
 formatAboutYouInject,
 isUserModelEnabled,
} from '../../../src/services/learned-knowledge/index.js';

describe('AboutYouService (Learned Knowledge)', () => {
 let tmp: string;
 const prevUserModel = process.env.ZAVORTH_USER_MODEL;

 beforeEach(() => {
 tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-about-'));
 fs.writeFileSync(
 path.join(tmp, 'USER.md'),
 [
 '# USER.md',
 '',
 '- **Name**: Test Operator',
 '- **Primary language**: English',
 '- **Preferred tone from the agent**: concise',
 '',
 ].join('\n'),
 'utf8',
 );
 delete process.env.ZAVORTH_USER_MODEL;
 });

 afterEach(() => {
 if (prevUserModel === undefined) delete process.env.ZAVORTH_USER_MODEL;
 else process.env.ZAVORTH_USER_MODEL = prevUserModel;
 try {
 fs.rmSync(tmp, { recursive: true, force: true });
 } catch {
 // ignore
 }
 });

 it('builds snapshot merging USER.md fields', () => {
 const snap = new AboutYouService({ projectRoot: tmp }).buildSnapshot('user-a');
 expect(snap.pillar).toBe('about-you');
 expect(snap.userId).toBe('user-a');
 expect(snap.facts.some((f) => /name/i.test(f.key) && /Test Operator/i.test(f.value))).toBe(true);
 expect(snap.injectEnabled).toBe(false);
 expect(snap.injectBlock).toBe('');
 });

 it('propose → approve is draft gate (no silent active write)', () => {
 const svc = new AboutYouService({ projectRoot: tmp });
 const proposed = svc.propose('user-a', {
 key: 'timezone',
 value: 'UTC',
 confidence: 0.6,
 });
 expect(proposed.ok).toBe(true);
 expect(proposed.draft?.status).toBe('draft');
 let snap = svc.buildSnapshot('user-a');
 expect(snap.drafts.some((d) => d.key === 'timezone')).toBe(true);
 expect(snap.facts.some((f) => f.key === 'timezone' && f.source === 'operator-approved')).toBe(false);

 const approved = svc.approve('user-a', proposed.draft!.id);
 expect(approved.ok).toBe(true);
 snap = svc.buildSnapshot('user-a');
 expect(snap.facts.some((f) => f.key === 'timezone' && f.value === 'UTC')).toBe(true);
 expect(snap.drafts.some((d) => d.key === 'timezone')).toBe(false);
 });

 it('refuses secret-like propose', () => {
 const svc = new AboutYouService({ projectRoot: tmp });
 const bad = svc.propose('user-a', { key: 'api_key', value: 'sk-secret' });
 expect(bad.ok).toBe(false);
 });

 it('forget removes operator-approved fact', () => {
 const svc = new AboutYouService({ projectRoot: tmp });
 const p = svc.propose('user-a', { key: 'hobby', value: 'hiking' });
 svc.approve('user-a', p.draft!.id);
 const forgot = svc.forget('user-a', 'hobby');
 expect(forgot.ok).toBe(true);
 const snap = svc.buildSnapshot('user-a');
 expect(snap.facts.some((f) => f.key === 'hobby')).toBe(false);
 });

 it('isolates stores per userId', () => {
 const svc = new AboutYouService({ projectRoot: tmp });
 svc.propose('alice', { key: 'team', value: 'alpha' });
 svc.approve('alice', svc.buildSnapshot('alice').drafts[0].id);
 const bob = svc.buildSnapshot('bob');
 expect(bob.facts.some((f) => f.key === 'team' && f.source === 'operator-approved')).toBe(false);
 });

 it('inject only when ZAVORTH_USER_MODEL=1', () => {
 expect(isUserModelEnabled()).toBe(false);
 expect(formatAboutYouInject('user-a', tmp)).toBe('');
 process.env.ZAVORTH_USER_MODEL = '1';
 const block = formatAboutYouInject('user-a', tmp);
 expect(block).toMatch(/About you/i);
 expect(block.length).toBeLessThan(4000);
 });

 it('export writes snapshot json', () => {
 const svc = new AboutYouService({ projectRoot: tmp });
 const exp = svc.exportProfile('user-a');
 expect(exp.ok).toBe(true);
 expect(exp.path && fs.existsSync(exp.path)).toBe(true);
 });
});
