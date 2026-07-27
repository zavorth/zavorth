import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
 captureConversationTurn,
 formatConversationRecallLines,
 recallConversations,
 redactConversationText,
 resetConversationContinuumCache,
 resolveLearnedKnowledgeFlags,
 isContinuumCaptureEnabled,
} from '../../../src/services/learned-knowledge/index.js';
import { ConversationRecallTool } from '../../../src/tools/ConversationRecallTool.js';

describe('Conversation continuum capture (Learned Knowledge)', () => {
 let tmp: string;
 let runtimeDir: string;

 beforeEach(() => {
 tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-continuum-'));
 runtimeDir = path.join(tmp, 'data', 'runtime');
 fs.mkdirSync(runtimeDir, { recursive: true });
 resetConversationContinuumCache();
 delete process.env.ZAVORTH_CONTINUUM_CAPTURE;
 delete process.env.ZAVORTH_LEARNED_KNOWLEDGE;
 });

 afterEach(() => {
 resetConversationContinuumCache();
 try {
 fs.rmSync(tmp, { recursive: true, force: true });
 } catch {
 // ignore
 }
 });

 it('resolves flags with safe defaults', () => {
 const flags = resolveLearnedKnowledgeFlags({});
 expect(flags.learnedKnowledgeEnabled).toBe(true);
 expect(flags.continuumCaptureEnabled).toBe(true);
 expect(flags.userModelEnabled).toBe(false);
 expect(flags.injectTokenBudget).toBe(1200);
 });

 it('captures a turn and recalls it by query', () => {
 const result = captureConversationTurn({
 userMessage: 'How do we configure the provider mesh for staging-',
 assistantMessage: 'Use the mesh checklist and verify API keys.',
 sessionId: 'sess-phase1',
 userId: 'user-a',
 surface: 'cli',
 runtimeDir,
 source: 'test',
 });
 expect(result).not.toBeNull();
 expect(result?.sessionId).toBeTruthy();

 const snap = recallConversations({
 query: 'provider mesh staging',
 limit: 5,
 runtimeDir,
 });
 expect(snap.returned).toBeGreaterThan(0);
 expect(snap.hits.some((h) => /provider|mesh|staging/i.test(h.snippet + h.title))).toBe(true);
 const lines = formatConversationRecallLines(snap);
 expect(lines.join('\n')).toMatch(/Conversation recall/i);
 });

 it('redacts secrets in capture and recall', () => {
 captureConversationTurn({
 userMessage: 'My token is sk-secretvalue1234567890 and password=hunter2',
 assistantMessage: 'Stored Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb for later.',
 sessionId: 'sess-secret',
 runtimeDir,
 });
 const snap = recallConversations({
 query: 'token password Bearer',
 limit: 10,
 runtimeDir,
 maxSnippet: 400,
 });
 const blob = JSON.stringify(snap);
 expect(blob).not.toMatch(/sk-secretvalue1234567890/);
 expect(blob).not.toMatch(/hunter2/);
 expect(blob).toMatch(/REDACTED/i);
 expect(redactConversationText('api_key=abc12345678')).toContain('[REDACTED]');
 });

 it('skips capture when continuum capture disabled', () => {
 process.env.ZAVORTH_CONTINUUM_CAPTURE = '0';
 expect(isContinuumCaptureEnabled()).toBe(false);
 const result = captureConversationTurn({
 userMessage: 'should not store',
 assistantMessage: 'nope',
 runtimeDir,
 });
 expect(result).toBeNull();
 });

 it('conversation_recall tool returns governed guidance', async () => {
 captureConversationTurn({
 userMessage: 'Document the release checklist for desktop builds',
 assistantMessage: 'Checklist includes smoke tests and sign off.',
 sessionId: 'tool-sess',
 runtimeDir,
 });
 const tool = new ConversationRecallTool({ runtimeDir });
 const out = await tool.execute({ query: 'release checklist desktop' });
 expect(out).toMatch(/Conversation recall/i);
 expect(out).toMatch(/untrusted context/i);
 expect(out.toLowerCase()).toMatch(/release|checklist|desktop/);
 });
});
