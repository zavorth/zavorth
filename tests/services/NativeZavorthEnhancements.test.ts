import { ZavorthDenseContextEncoderService } from '../../src/services/ZavorthDenseContextEncoderService';
import { ZavorthTokenEconomyCompressor } from '../../src/services/llm/ZavorthTokenEconomyCompressor';
import { ZavorthDeterministicEventLedger } from '../../src/services/ZavorthDeterministicEventLedger';
import { ZavorthMobileControlBridge } from '../../src/services/ZavorthMobileControlBridge';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Native Zavorth Enhancements Suite', () => {
  describe('ZavorthDenseContextEncoderService', () => {
    it('encodes text payloads into PNG image base64 strings', async () => {
      const encoder = new ZavorthDenseContextEncoderService({
        maxCanvasWidth: 320,
        maxCanvasHeight: 200,
      });
      const sampleText = 'const name = "Zavorth";\nconsole.log(name);';
      const result = await encoder.encodeTextToBitmap(sampleText);

      expect(result.mimeType).toBe('image/png');
      expect(result.encodedImageBase64).toBeDefined();
      expect(result.encodedImageBase64.length).toBeGreaterThan(0);
      expect(result.linesEncoded).toBe(2);
      expect(result.digest).toBeDefined();
      expect(result.tokenEstimateSource).toBe('unavailable');
    });
  });

  describe('ZavorthTokenEconomyCompressor', () => {
    it('compresses code comments and whitespace efficiently', () => {
      const code = `
        // Single line comment
        function hello() {
          /* Multi line
             comment */
          console.log("world");
        }
      `;
      const result = ZavorthTokenEconomyCompressor.compressText(code, 'aggressive');

      expect(result.compressedCharCount).toBeLessThan(result.originalCharCount);
      expect(result.compressedText).not.toContain('Single line comment');
      expect(result.compressedText).not.toContain('Multi line');
      expect(result.savingsPercentage).toBeGreaterThan(0);
    });

    it('compresses code inside markdown blocks', () => {
      const markdown = 'Header text\n```ts\n// comment\nconst x = 10;\n```\nFooter text';
      const compressed = ZavorthTokenEconomyCompressor.compressCodeBlocks(markdown, 'aggressive');

      expect(compressed).not.toContain('// comment');
      expect(compressed).toContain('const x = 10;');
    });
  });

  describe('ZavorthDeterministicEventLedger', () => {
    it('records events in a tamper-proof hash chain', () => {
      const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ledger-test-'));
      const ledger = new ZavorthDeterministicEventLedger(storageDir, 'unit_test_session');
      const event1 = ledger.recordEvent('AGENT_DISPATCH', 'agent_1', { task: 'Analyze code' });
      const event2 = ledger.recordEvent('STEP_EXECUTE', 'agent_1', { step: 1 });

      expect(event1.sequenceNumber).toBe(1);
      expect(event2.sequenceNumber).toBe(2);
      expect(event2.previousHash).toBe(event1.hash);

      const verification = ledger.verifyIntegrity();
      expect(verification.valid).toBe(true);
      fs.rmSync(storageDir, { recursive: true, force: true });
    });
  });

  describe('ZavorthMobileControlBridge', () => {
    it('registers sessions and records activity logs for authorized clients', async () => {
      const bridge = new ZavorthMobileControlBridge({ authorize: () => true });
      bridge.registerTransport({ id: 'test-client', send: () => undefined });
      const session = bridge.registerSession('mobile_sess_1', 'gemini-pro');

      expect(session.sessionId).toBe('mobile_sess_1');
      expect(session.status).toBe('idle');

      await bridge.acceptInbound('test-client', 'mobile_sess_1', {
        rawText: 'Hello Zavorth',
        platform: 'mobile_web',
        userId: 'user_42',
      });

      const state = bridge.getMobileDashboardState();
      expect(state.sessions.length).toBe(1);
      expect(state.sessions[0].messageCount).toBe(1);

      const logs = bridge.getSessionLogs('mobile_sess_1');
      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('Hello Zavorth');
    });
  });
});
