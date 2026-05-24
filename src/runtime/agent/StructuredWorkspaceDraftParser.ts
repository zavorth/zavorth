export type StructuredWorkspaceDraft = {
  source: string;
  writes: Array<{ path: string; content: string }>;
  patches: Array<{ path: string; search: string; replace: string; hunks: Array<{ search: string; replace: string }> }>;
};

export class StructuredWorkspaceDraftParser {
  public extract(content: string): StructuredWorkspaceDraft | null {
    const writes = this.extractWorkspaceWriteBlocks(content);
    const patches = this.extractWorkspacePatchBlocks(content);
    if (writes.length === 0 && patches.length === 0) {
      return null;
    }
    return {
      source: patches.length > 0 ? 'llm-runtime-zavorth-workspace-patches' : 'llm-runtime-zavorth-workspace-writes',
      writes,
      patches,
    };
  }

  private extractWorkspaceWriteBlocks(content: string): Array<{ path: string; content: string }> {
    const blocks = Array.from(content.matchAll(/```zavorth-workspace-writes\s*([\s\S]*?)```/gi)).slice(0, 1);
    const writes: Array<{ path: string; content: string }> = [];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(String(block[1] || '').trim());
        const entries = Array.isArray(parsed.writes) ? parsed.writes : [];
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const record = entry as Record<string, unknown>;
          const filePath = normalizeText(record.path || record.target);
          const fileContent = typeof record.content === 'string'
            ? record.content
            : typeof record.newContent === 'string'
              ? record.newContent
              : '';
          if (filePath && fileContent !== '') {
            writes.push({ path: filePath, content: fileContent });
          }
        }
      } catch {
        // Invalid structured proposal blocks are ignored; natural text remains intact.
      }
    }
    return writes.slice(0, 12);
  }

  private extractWorkspacePatchBlocks(content: string): Array<{ path: string; search: string; replace: string; hunks: Array<{ search: string; replace: string }> }> {
    const blocks = Array.from(content.matchAll(/```zavorth-workspace-patches\s*([\s\S]*?)```/gi)).slice(0, 1);
    const patches: Array<{ path: string; search: string; replace: string; hunks: Array<{ search: string; replace: string }> }> = [];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(String(block[1] || '').trim());
        const entries = Array.isArray(parsed.patches) ? parsed.patches : [];
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const record = entry as Record<string, unknown>;
          const filePath = normalizeText(record.path || record.target);
          const hunks = this.normalizePatchHunks(record);
          const search = normalizeText(record.search);
          const replace = String(record.replace ?? '');
          if (filePath && hunks.length > 0) {
            patches.push({ path: filePath, search: hunks[0]?.search || search, replace: hunks[0]?.replace || replace, hunks });
          } else if (filePath && search && replace) {
            patches.push({ path: filePath, search, replace, hunks: [{ search, replace }] });
          }
        }
      } catch {
        // Invalid structured proposal blocks are ignored; natural text remains intact.
      }
    }
    return patches.slice(0, 12);
  }

  private normalizePatchHunks(entry: Record<string, unknown>): Array<{ search: string; replace: string }> {
    if (Array.isArray(entry.hunks)) {
      return entry.hunks
        .map((hunk) => this.normalizePatchHunk(hunk))
        .filter((hunk): hunk is { search: string; replace: string } => Boolean(hunk))
        .slice(0, 20);
    }
    const single = this.normalizePatchHunk(entry);
    return single ? [single] : [];
  }

  private normalizePatchHunk(entry: unknown): { search: string; replace: string } | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const replace = typeof record.replace === 'string'
      ? record.replace
      : typeof record.newText === 'string'
        ? record.newText
        : typeof record.newContent === 'string'
          ? record.newContent
          : '';
    const search = typeof record.search === 'string' ? record.search : typeof record.oldText === 'string' ? record.oldText : '';
    return search && replace ? { search, replace } : null;
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
