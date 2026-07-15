import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 formatKnowledgeFactsLines,
 knowledgeWikiPresent,
 previewKnowledgeConsolidate,
 queryKnowledgeFacts,
} from '../../../src/services/learned-knowledge/index.js';
import { KnowledgeRecallTool } from '../../../src/tools/KnowledgeRecallTool.js';

function seedWiki(root: string): void {
 const wiki = path.join(root, '.zavorth', 'wiki');
 const pages = path.join(wiki, 'pages');
 fs.mkdirSync(pages, { recursive: true });
 const pageRel = '.zavorth/wiki/pages/provider-readiness.md';
 const pageAbs = path.join(root, pageRel);
 fs.writeFileSync(
 pageAbs,
 [
 '# Provider readiness',
 '',
 'Tags: providers, readiness, architecture',
 '',
 'Zavorth uses a provider mesh checklist for staging and production.',
 'Never store raw API keys in wiki pages.',
 '',
 ].join('\n'),
 'utf8',
 );
 fs.writeFileSync(
 path.join(wiki, 'index.json'),
 JSON.stringify(
 {
 pages: [
 {
 id: 'provider-readiness',
 path: pageRel.replace(/\\/g, '/'),
 title: 'Provider readiness',
 tags: ['providers', 'readiness', 'architecture'],
 },
 ],
 edges: [],
 },
 null,
 2,
 ),
 'utf8',
 );
}

describe('Knowledge facts recall (Learned Knowledge)', () => {
 let tmp: string;

 beforeEach(() => {
 tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-knowledge-'));
 });

 afterEach(() => {
 try {
 fs.rmSync(tmp, { recursive: true, force: true });
 } catch {
 // ignore
 }
 });

 it('detects missing wiki index', () => {
 expect(knowledgeWikiPresent(tmp)).toBe(false);
 });

 it('queries wiki facts with budget and redaction safety flags', () => {
 seedWiki(tmp);
 expect(knowledgeWikiPresent(tmp)).toBe(true);
 const result = queryKnowledgeFacts({
 query: 'provider readiness staging',
 topK: 5,
 contextTokenBudget: 800,
 projectRoot: tmp,
 });
 expect(result.pillar).toBe('knowledge');
 expect(result.engine).toBe('mnemos-wiki-os');
 expect(result.safety.secretsRedacted).toBe(true);
 expect(result.safety.providerCall).toBe(false);
 expect(result.receipt.durableMutation).toBe(false);
 expect(result.hits.length).toBeGreaterThan(0);
 expect(result.hits[0].title.toLowerCase()).toMatch(/provider|readiness/);
 const lines = formatKnowledgeFactsLines(result).join('\n');
 expect(lines).toMatch(/Knowledge \(Mnemos wiki\)/i);
 expect(lines).toMatch(/no durable mutation/i);
 });

 it('respects topK budget', () => {
 seedWiki(tmp);
 // add second page
 const pageRel = '.zavorth/wiki/pages/mesh-ops.md';
 fs.writeFileSync(
 path.join(tmp, pageRel),
 '# Mesh ops\n\nProvider mesh operations notes for readiness drills.\n',
 'utf8',
 );
 const indexPath = path.join(tmp, '.zavorth', 'wiki', 'index.json');
 const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
 index.pages.push({
 id: 'mesh-ops',
 path: pageRel,
 title: 'Mesh ops',
 tags: ['providers', 'ops'],
 });
 fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

 const result = queryKnowledgeFacts({
 query: 'provider mesh',
 topK: 1,
 projectRoot: tmp,
 });
 expect(result.hits.length).toBeLessThanOrEqual(1);
 });

 it('consolidate preview never allows apply without approval', () => {
 const preview = previewKnowledgeConsolidate({
 projectRoot: tmp,
 sessionSummary: 'Prefer English docs for architecture decisions.',
 });
 expect(preview.mode).toBe('preview-only');
 expect(preview.durableMutation).toBe(false);
 expect(preview.promotionGate.canApply).toBe(false);
 expect(preview.promotionGate.blockers.join(' ')).toMatch(/preview|approval/i);
 });

 it('knowledge_recall tool returns read-only guidance', async () => {
 seedWiki(tmp);
 const tool = new KnowledgeRecallTool({ projectRoot: tmp });
 const out = await tool.execute({ query: 'provider readiness' });
 expect(out).toMatch(/Knowledge recall/i);
 expect(out).toMatch(/no tool authority|untrusted/i);
 expect(out.toLowerCase()).toMatch(/provider|readiness/);
 });
});
