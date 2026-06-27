import {
  actionIntentToDraftEffect,
  inferEffectRisk,
} from '../../../src/runtime/effects/index.js';
import {
  toolCallToActionIntent,
  ToolEffectRegistry,
} from '../../../src/tools/governance/index.js';

describe('ToolCallToActionIntent', () => {
  it('maps get_datetime tool calls to safe observation intent and effect', () => {
    const intent = toolCallToActionIntent({
      toolCall: {
        id: 'call-1',
        name: 'get_datetime',
        arguments: { timezone: 'America/Sao_Paulo' },
      },
      sourceTrust: 'trusted-user',
      createdAt: '2026-05-22T12:00:00.000Z',
    });
    const effect = actionIntentToDraftEffect(intent);

    expect(intent).toEqual(expect.objectContaining({
      id: 'call-1',
      kind: 'tool_call',
      toolName: 'get_datetime',
      sourceTrust: 'trusted-user',
      targetScope: [expect.objectContaining({
        kind: 'time',
        uri: 'timezone:America/Sao_Paulo',
      })],
    }));
    expect(effect.reads).toHaveLength(1);
    expect(inferEffectRisk(effect)).toBe('safe');
  });

  it('maps workspace writes to mutation intents with workspace target scope', () => {
    const intent = toolCallToActionIntent({
      toolCall: {
        id: 'call-write',
        name: 'write_file',
        arguments: { target_file: 'src/index.ts', content: 'hello' },
      },
      sourceTrust: 'trusted-user',
    });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'workspace_mutation',
      toolName: 'write_file',
      targetScope: [expect.objectContaining({
        kind: 'workspace',
        uri: 'src/index.ts',
      })],
    }));
  });

  it('preserves untrusted metadata as source trust', () => {
    const intent = toolCallToActionIntent({
      toolCall: {
        id: 'call-untrusted',
        name: 'write_file',
        arguments: {
          path: 'src/index.ts',
          metadata: {
            sourceTrust: 'untrusted-content',
          },
        },
      },
    });

    expect(intent.sourceTrust).toBe('untrusted-content');
  });

  it('supports custom descriptors for project-specific tools', () => {
    const registry = new ToolEffectRegistry({
      descriptors: [{
        toolName: 'custom.audit',
        level: 'observation',
        intentKind: 'tool_call',
        operation: 'custom audit',
        defaultResourceKind: 'workspace',
        requiresEffectBoundary: false,
        safeObservation: true,
        description: 'Read-only custom audit.',
        argumentResourceHints: ['target'],
      }],
    });

    const intent = toolCallToActionIntent({
      registry,
      toolCall: {
        id: 'call-audit',
        name: 'custom.audit',
        arguments: { target: 'src/security' },
      },
    });

    expect(intent.targetScope).toEqual([expect.objectContaining({
      kind: 'workspace',
      uri: 'src/security',
    })]);
  });
});
