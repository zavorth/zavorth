import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildArtifactMemoryCliSnapshot,
  formatArtifactMemorySnapshot,
  resolveArtifactMemoryCliText,
} from '../../src/cli/ZavorthCliArtifactMemoryRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-artifact-memory',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Artifact Memory', () => {
  it('parses artifact-memory text after subcommands', () => {
    expect(resolveArtifactMemoryCliText('search "wave 38 artifacts"')).toBe('wave 38 artifacts');
  });

  it('renders artifact-memory JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'artifact-memory',
      normalized: 'artifact-memory',
      args: 'search "wave 38 artifacts"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-38',
      source: 'ArtifactMemoryService',
      summary: expect.objectContaining({
        artifactCount: 3,
        memoryEntryCount: expect.any(Number),
        reusableCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noArtifactContentInvented: true,
        noFilesystemReadPerformed: true,
        promotionRequiresExplicitAction: true,
        reusedArtifactMustCiteOrigin: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth artifact-memory');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildArtifactMemoryCliSnapshot({
      text: 'artifacts da wave',
      userId: 'grey',
      sessionId: 'session-cli-artifact-memory-human',
    });

    const text = formatArtifactMemorySnapshot(snapshot);

    expect(text).toContain('Artifact Memory - Wave 38');
    expect(text).toContain('Artifacts indexados');
    expect(text).toContain('nao le conteudo de arquivo');
    expect(text).toContain('Command Center: /control?sector=dreams');
  });
});
