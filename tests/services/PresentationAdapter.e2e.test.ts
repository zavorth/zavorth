import { ZavorthChannelCapabilitiesService } from '../../src/services/ZavorthChannelCapabilitiesService';
import {
  ZavorthPresentationAdapterService,
  type UniversalResponse,
} from '../../src/services/ZavorthPresentationAdapterService';

describe('PresentationAdapter — Real-world simulation across channels', () => {
  let caps: ZavorthChannelCapabilitiesService;
  let adapter: ZavorthPresentationAdapterService;

  beforeEach(() => {
    caps = new ZavorthChannelCapabilitiesService();
    adapter = new ZavorthPresentationAdapterService(caps);
  });

  // SCENARIO 1: Task reminder sent by the agent
  describe('Scenario 1: Daily task reminder', () => {
    const reminder: UniversalResponse = {
      type: 'card',
      title: 'Daily Summary',
      text: 'You have 3 pending tasks today:\n- Finish API documentation\n- Review PR #42\n- Deploy v2.1 to staging\n\nDeadline: 6:00 PM',
    };

    it('Telegram — shows markdown card with visual divider', () => {
      const result = adapter.format(reminder, 'telegram');
      console.log('\n=== TELEGRAM ===');
      console.log(result.text);

      expect(result.text).toContain('**Daily Summary**');
      expect(result.text).toContain('Finish API documentation');
      expect(result.appliedCapabilities).toContain('markdown-card');
    });

    it('WhatsApp — plain text, no markdown', () => {
      const result = adapter.format(reminder, 'whatsapp');
      console.log('\n=== WHATSAPP ===');
      console.log(result.text);

      expect(result.text).not.toContain('**');
      expect(result.text).toContain('[Daily Summary]');
      expect(result.text).toContain('Finish API documentation');
      expect(result.appliedCapabilities).toContain('plain-card');
    });

    it('Discord — rich embed card', () => {
      const result = adapter.format(reminder, 'discord');
      console.log('\n=== DISCORD ===');
      console.log(result.text);

      expect(result.text).toContain('**Daily Summary**');
      expect(result.appliedCapabilities).toContain('rich-embed');
    });

    it('Email — plain text with HTML fallback', () => {
      const result = adapter.format(reminder, 'email');
      console.log('\n=== EMAIL ===');
      console.log(result.text);

      expect(result.text).toContain('Daily Summary');
      expect(result.text).toContain('Finish API documentation');
      expect(result.appliedCapabilities).toContain('plain-card');
    });

    it('CLI — plain text in terminal', () => {
      const result = adapter.format(reminder, 'cli');
      console.log('\n=== CLI ===');
      console.log(result.text);

      expect(result.text).toContain('Daily Summary');
      expect(result.text).toContain('Finish API documentation');
    });
  });

  // SCENARIO 2: User asks to create a file
  describe('Scenario 2: File creation confirmation', () => {
    const confirmation: UniversalResponse = {
      type: 'confirmation',
      title: 'Create File',
      text: 'Create file "report.md" with 2.4 KB of content-',
    };

    it('Telegram — inline Confirm/Cancel buttons', () => {
      const result = adapter.format(confirmation, 'telegram');
      console.log('\n=== TELEGRAM (confirmation) ===');
      console.log(result.text);
      console.log('Buttons:', result.buttons?.map((b) => b.label).join(', '));

      expect(result.buttons).toHaveLength(2);
      expect(result.buttons![0].label).toBe('Confirm');
      expect(result.buttons![1].label).toBe('Cancel');
      expect(result.appliedCapabilities).toContain('confirm-buttons');
    });

    it('WhatsApp — text fallback with yes/no instruction', () => {
      const result = adapter.format(confirmation, 'whatsapp');
      console.log('\n=== WHATSAPP (confirmation) ===');
      console.log(result.text);

      expect(result.buttons).toBeUndefined();
      expect(result.text).toContain('yes');
      expect(result.text).toContain('no');
      expect(result.appliedCapabilities).toContain('text-confirmation');
    });

    it('Discord — button row', () => {
      const result = adapter.format(confirmation, 'discord');
      console.log('\n=== DISCORD (confirmation) ===');
      console.log(result.text);
      console.log('Buttons:', result.buttons?.map((b) => b.label).join(', '));

      expect(result.buttons).toHaveLength(2);
    });
  });

  // SCENARIO 3: Code review response
  describe('Scenario 3: Code snippet response', () => {
    const codeResponse: UniversalResponse = {
      type: 'code',
      text: 'Here is the fixed function:',
      code: `async function fetchData(url: string) {\n  const res = await fetch(url);\n  if (!res.ok) throw new Error(res.statusText);\n  return res.json();\n}`,
      language: 'typescript',
    };

    it('Telegram — fenced code block with language', () => {
      const result = adapter.format(codeResponse, 'telegram');
      console.log('\n=== TELEGRAM (code) ===');
      console.log(result.text);

      expect(result.text).toContain('```typescript');
      expect(result.text).toContain('async function fetchData');
      expect(result.appliedCapabilities).toContain('code-block');
    });

    it('WhatsApp — indented plain text code', () => {
      const result = adapter.format(codeResponse, 'whatsapp');
      console.log('\n=== WHATSAPP (code) ===');
      console.log(result.text);

      expect(result.text).not.toContain('```');
      expect(result.text).toContain('  async function fetchData');
      expect(result.appliedCapabilities).toContain('indented-code');
    });

    it('CLI — fenced code block', () => {
      const result = adapter.format(codeResponse, 'cli');
      console.log('\n=== CLI (code) ===');
      console.log(result.text);

      expect(result.text).toContain('```typescript');
    });
  });

  // SCENARIO 4: Error message
  describe('Scenario 4: Deployment error', () => {
    const error: UniversalResponse = {
      type: 'error',
      text: 'Deploy failed: container exited with code 1. Check logs at /var/log/app.log',
    };

    it('Telegram — emoji warning + bold header', () => {
      const result = adapter.format(error, 'telegram');
      console.log('\n=== TELEGRAM (error) ===');
      console.log(result.text);

      expect(result.text).toContain('\u26A0\uFE0F');
      expect(result.text).toContain('**Error**');
      expect(result.text).toContain('container exited with code 1');
      expect(result.typingDelayMs).toBe(500);
    });

    it('WhatsApp — [ERROR] prefix', () => {
      const result = adapter.format(error, 'whatsapp');
      console.log('\n=== WHATSAPP (error) ===');
      console.log(result.text);

      expect(result.text).toContain('[ERROR]');
      expect(result.text).toContain('container exited with code 1');
    });

    it('Discord — emoji + bold', () => {
      const result = adapter.format(error, 'discord');
      console.log('\n=== DISCORD (error) ===');
      console.log(result.text);

      expect(result.text).toContain('\u26A0\uFE0F');
      expect(result.text).toContain('**Error**');
    });
  });

  // SCENARIO 5: User asks "what tools are available-"
  describe('Scenario 5: List available tools', () => {
    const toolList: UniversalResponse = {
      type: 'list',
      title: 'Available Skills',
      items: [
        'Business Writer — Professional writing',
        'SEO Optimizer — Search engine optimization',
        'Resume Coach — Career planning',
        'Meeting Facilitator — Meeting management',
        'Contract Reviewer — Legal document analysis',
        'Personal Finance — Budget and savings',
        'Content Calendar — Editorial planning',
        'Data Storyteller — Data visualization',
        'Workflow Designer — Process automation',
        'Presentation Builder — Slide creation',
      ],
    };

    it('Telegram — bullet list with markdown', () => {
      const result = adapter.format(toolList, 'telegram');
      console.log('\n=== TELEGRAM (list) ===');
      console.log(result.text);

      expect(result.text).toContain('**Available Skills**');
      expect(result.text).toContain('- Business Writer');
      expect(result.text).toContain('- SEO Optimizer');
      expect(result.appliedCapabilities).toContain('bullet-list');
    });

    it('WhatsApp — bullet list without markdown', () => {
      const result = adapter.format(toolList, 'whatsapp');
      console.log('\n=== WHATSAPP (list) ===');
      console.log(result.text);

      expect(result.text).toContain('AVAILABLE SKILLS');
      expect(result.text).toContain('\u2022 Business Writer');
      expect(result.appliedCapabilities).toContain('bullet-list');
    });

    it('CLI — bullet list', () => {
      const result = adapter.format(toolList, 'cli');
      console.log('\n=== CLI (list) ===');
      console.log(result.text);

      expect(result.text).toContain('**Available Skills**');
      expect(result.text).toContain('- Business Writer');
    });
  });

  // SCENARIO 6: Choice with multiple options
  describe('Scenario 6: Provider selection', () => {
    const choice: UniversalResponse = {
      type: 'choice',
      text: 'Which provider do you want to use-',
      options: ['OpenAI GPT-4o', 'Claude 4 Sonnet', 'Gemini 2.5 Flash', 'DeepSeek V3'],
    };

    it('Telegram — 4 inline buttons', () => {
      const result = adapter.format(choice, 'telegram');
      console.log('\n=== TELEGRAM (choice) ===');
      console.log(result.text);
      console.log('Buttons:', result.buttons?.map((b) => b.label).join(' | '));

      expect(result.buttons).toHaveLength(4);
      expect(result.buttons![0].label).toBe('OpenAI GPT-4o');
      expect(result.appliedCapabilities).toContain('inline-buttons');
    });

    it('WhatsApp — numbered list with emojis', () => {
      const result = adapter.format(choice, 'whatsapp');
      console.log('\n=== WHATSAPP (choice) ===');
      console.log(result.text);

      expect(result.buttons).toBeUndefined();
      expect(result.text).toContain('1\uFE0F\u20E3 OpenAI GPT-4o');
      expect(result.text).toContain('2\uFE0F\u20E3 Claude 4 Sonnet');
      expect(result.text).toContain('3\uFE0F\u20E3 Gemini 2.5 Flash');
      expect(result.appliedCapabilities).toContain('numbered-list');
    });

    it('Discord — 4 buttons', () => {
      const result = adapter.format(choice, 'discord');
      console.log('\n=== DISCORD (choice) ===');
      console.log(result.text);
      console.log('Buttons:', result.buttons?.map((b) => b.label).join(' | '));

      expect(result.buttons).toHaveLength(4);
    });
  });

  // SCENARIO 7: Status update
  describe('Scenario 7: Build status', () => {
    const statusSuccess: UniversalResponse = {
      type: 'status',
      title: 'Build Complete',
      text: 'All 26 tests passed. Deployment ready.',
      severity: 'success',
    };

    const statusWarning: UniversalResponse = {
      type: 'status',
      title: 'Low Disk Space',
      text: 'Only 2.1 GB remaining on /var. Consider cleanup.',
      severity: 'warning',
    };

    const statusError: UniversalResponse = {
      type: 'status',
      title: 'Provider Down',
      text: 'OpenAI API returning 503. Falling back to Claude.',
      severity: 'error',
    };

    it('Success — checkmark emoji on markdown channels', () => {
      const result = adapter.format(statusSuccess, 'telegram');
      console.log('\n=== TELEGRAM (success status) ===');
      console.log(result.text);

      expect(result.text).toContain('\u2705');
      expect(result.text).toContain('**Build Complete**');
    });

    it('Warning — warning emoji', () => {
      const result = adapter.format(statusWarning, 'discord');
      console.log('\n=== DISCORD (warning status) ===');
      console.log(result.text);

      expect(result.text).toContain('\u26A0\uFE0F');
      expect(result.text).toContain('**Low Disk Space**');
    });

    it('Error — cross emoji', () => {
      const result = adapter.format(statusError, 'telegram');
      console.log('\n=== TELEGRAM (error status) ===');
      console.log(result.text);

      expect(result.text).toContain('\u274C');
      expect(result.text).toContain('**Provider Down**');
    });

    it('Plain text — bracket prefix', () => {
      const result = adapter.format(statusSuccess, 'whatsapp');
      console.log('\n=== WHATSAPP (success status) ===');
      console.log(result.text);

      expect(result.text).toContain('[SUCCESS]');
      expect(result.text).toContain('Build Complete');
    });
  });

  // SCENARIO 8: Long message truncation
  describe('Scenario 8: Long research summary', () => {
    const longResponse: UniversalResponse = {
      type: 'text',
      text: 'A'.repeat(5000) + '\n\nConclusion: The analysis shows positive trends.',
    };

    it('Telegram — truncated at 4096 chars', () => {
      const result = adapter.format(longResponse, 'telegram');
      console.log('\n=== TELEGRAM (truncated) ===');
      console.log(`Length: ${result.text.length} (original: 5000+)`);
      console.log(`Ends with: ...${result.text.slice(-30)}`);

      expect(result.text.length).toBeLessThanOrEqual(4096);
      expect(result.text).toContain('...');
    });

    it('Email — no truncation', () => {
      const result = adapter.format(longResponse, 'email');
      console.log('\n=== EMAIL (no limit) ===');
      console.log(`Length: ${result.text.length}`);

      expect(result.text.length).toBeGreaterThan(5000);
    });

    it('Discord — truncated at 2000 chars', () => {
      const result = adapter.format(longResponse, 'discord');
      console.log('\n=== DISCORD (truncated) ===');
      console.log(`Length: ${result.text.length}`);

      expect(result.text.length).toBeLessThanOrEqual(2000);
    });
  });

  // SCENARIO 9: Custom channel registration
  describe('Scenario 9: Custom channel (MyCustomBot)', () => {
    beforeEach(() => {
      caps.register({
        id: 'my-custom-bot',
        label: 'My Custom Bot',
        supportsMarkdown: true,
        supportsButtons: false,
        supportsRichEmbeds: false,
        supportsImages: true,
        supportsAudio: false,
        supportsVideo: false,
        supportsReactions: false,
        supportsHTML: false,
        supportsThreads: false,
        supportsMessageEditing: false,
        supportsPinning: false,
        maxMessageLength: 1500,
        maxButtonsPerMessage: 0,
        maxAttachmentsPerMessage: 3,
        supportsEphemeral: false,
        supportsScheduledMessages: false,
        supportsTypingIndicator: false,
        supportsPresence: false,
      });
    });

    it('should format choice as numbered list (no buttons)', () => {
      const choice: UniversalResponse = {
        type: 'choice',
        text: 'Pick a model:',
        options: ['GPT-4o', 'Claude', 'Gemini'],
      };
      const result = adapter.format(choice, 'my-custom-bot');
      console.log('\n=== MY CUSTOM BOT (choice) ===');
      console.log(result.text);

      expect(result.buttons).toBeUndefined();
      expect(result.text).toContain('1\uFE0F\u20E3 GPT-4o');
      expect(result.appliedCapabilities).toContain('numbered-list');
    });

    it('should truncate at 1500 chars', () => {
      const long: UniversalResponse = {
        type: 'text',
        text: 'B'.repeat(2000),
      };
      const result = adapter.format(long, 'my-custom-bot');
      console.log('\n=== MY CUSTOM BOT (truncated) ===');
      console.log(`Length: ${result.text.length}`);

      expect(result.text.length).toBeLessThanOrEqual(1500);
    });

    it('should use markdown for formatting', () => {
      const card: UniversalResponse = {
        type: 'card',
        title: 'Custom Alert',
        text: 'Something happened',
      };
      const result = adapter.format(card, 'my-custom-bot');
      console.log('\n=== MY CUSTOM BOT (card) ===');
      console.log(result.text);

      expect(result.text).toContain('**Custom Alert**');
      expect(result.appliedCapabilities).toContain('markdown-card');
    });
  });

  // SCENARIO 10: Message splitting
  describe('Scenario 10: Long message splitting', () => {
    it('should split a very long message into chunks for Telegram', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: ${'x'.repeat(50)}`);
      const fullText = lines.join('\n');
      const chunks = adapter.splitMessage(fullText, 'telegram');

      console.log('\n=== TELEGRAM (split) ===');
      console.log(`Original: ${fullText.length} chars`);
      console.log(`Chunks: ${chunks.length}`);
      chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: ${chunk.length} chars`));

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });

    it('should not split when channel has no limit', () => {
      const text = 'X'.repeat(100000);
      const chunks = adapter.splitMessage(text, 'email');
      expect(chunks).toHaveLength(1);
    });

    it('should try to split at newlines', () => {
      const text = 'Paragraph 1\n\nParagraph 2\n\n' + 'Y'.repeat(5000);
      const chunks = adapter.splitMessage(text, 'telegram');
      console.log('\n=== SPLIT AT NEWLINES ===');
      chunks.forEach((chunk, i) => console.log(`  Chunk ${i + 1}: starts with "${chunk.slice(0, 30)}..."`));

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });
});
