export type ZavorthHeadlessApprovalMode = 'manual' | 'governed' | 'speculative';

export type ZavorthHeadlessParseResult = {
  enabled: boolean;
  prompt: string | null;
  approvalMode: ZavorthHeadlessApprovalMode | null;
  argv: string[];
};

const APPROVAL_MODES = new Set(['manual', 'governed', 'speculative']);

export function normalizeZavorthHeadlessArgs(argv: string[]): ZavorthHeadlessParseResult {
  const output: string[] = [];
  let prompt: string | null = null;
  let approvalMode: ZavorthHeadlessApprovalMode | null = null;
  let enabled = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '');
    if (token === '-p' || token === '--prompt') {
      enabled = true;
      const value = String(argv[index + 1] || '').trim();
      if (value && !value.startsWith('-')) {
        prompt = value;
        index += 1;
      }
      continue;
    }
    if (token.startsWith('--prompt=')) {
      enabled = true;
      prompt = token.slice('--prompt='.length).trim() || prompt;
      continue;
    }
    if (token === '--approval-mode') {
      const value = normalizeApprovalMode(argv[index + 1]);
      if (value) {
        approvalMode = value;
        index += 1;
        continue;
      }
    }
    if (token.startsWith('--approval-mode=')) {
      approvalMode = normalizeApprovalMode(token.slice('--approval-mode='.length)) || approvalMode;
      continue;
    }
    output.push(token);
  }

  if (!enabled) {
    return { enabled: false, prompt: null, approvalMode, argv };
  }

  const rewritten = ['ask', prompt || '', ...output].filter((entry) => String(entry || '').trim());
  return {
    enabled,
    prompt,
    approvalMode,
    argv: rewritten,
  };
}

export function normalizeApprovalMode(value: unknown): ZavorthHeadlessApprovalMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  return APPROVAL_MODES.has(normalized)
    ? normalized as ZavorthHeadlessApprovalMode
    : null;
}
