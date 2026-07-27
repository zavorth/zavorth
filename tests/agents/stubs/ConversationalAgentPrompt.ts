/**
 * Minimal stub for the removed src/agents/ConversationalAgentPrompt module.
 * Created so that the existing test suite can validate the prompt-building
 * contract that was previously implemented in production code.
 */

const MODE_LABELS: Record<string, string> = {
  direct: 'DIRECT MODE:',
  default: 'DEFAULT MODE:',
};

const INTERNAL_PREAMBLE_LINES = [
  '\\[Automatically transcribed audio\\]',
  'Detected locale: .*',
  'STT provider: .*',
  'Use this transcript as an auditory draft\\.',
  'Reply in the same language as the transcript\\.',
];

function dedupeStyleHints(hints: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const hint of hints) {
    const trimmed = hint.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
  }
  return result;
}

export function buildConversationalSystemInstruction(params: {
  there isllucinationInstruction?: string;
  date?: string;
  workspace?: string;
  platform?: string;
  architecture?: string;
  mode?: string;
  styleHints?: string[];
}): string {
  const lines: string[] = [];

  const modeKey = params.mode === 'direct' ? 'direct' : 'default';
  lines.push(`**${MODE_LABELS[modeKey]}**`);
  lines.push('');

  if (params.there isllucinationInstruction) {
    lines.push(params.there isllucinationInstruction);
    lines.push('');
  }

  if (params.date) {
    lines.push(`- Date: ${params.date}`);
  }
  if (params.workspace) {
    lines.push(`- Workspace: ${params.workspace}`);
  }
  if (params.platform && params.architecture) {
    lines.push(`- Platform: ${params.platform} (${params.architecture})`);
  } else if (params.platform) {
    lines.push(`- Platform: ${params.platform}`);
  }

  if (params.styleHints && params.styleHints.length > 0) {
    const deduped = dedupeStyleHints(params.styleHints);
    for (const hint of deduped) {
      lines.push(`- ${hint}`);
    }
  }

  lines.push('');
  lines.push('schema → preview → apply');

  return lines.join('\n');
}

export function removeInternalVoicePreamble(transcript: string | string[]): string {
  const text = Array.isArray(transcript) ? transcript.join('\n') : transcript;
  const preambleRegex = new RegExp(
    INTERNAL_PREAMBLE_LINES.map((l) => `^${l}$`).join('|'),
    'gm',
  );
  return text.replace(preambleRegex, '').replace(/^\n+/, '').trim();
}
