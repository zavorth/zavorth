export type ZavorthBridgeUiResponseHints = {
  status?: string | null;
  hasPermissionPrompt?: boolean | null;
  hasInputBar?: boolean | null;
  uiVerified?: boolean | null;
  uiDiagnostics?: Record<string, any> | null;
  responseText?: string | null;
};

const EXACT_CHROME_LINES = new Set([
  'copy',
  'copiar',
  'switch to agent manager',
  'code with agent',
  'ctrl',
  'e',
  'l',
  '+',
  'working',
  'working...',
  'thinking',
  'thinking...',
  'generating',
  'generating...',
  'edited',
  'review changes',
  'files with changes',
  'accept all',
  'reject all',
  'ai may make mistakes. double-check all generated code.',
  'initiating response protocol',
  'analyzed',
]);

const PREFIX_CHROME_PATTERNS = [
  'acknowledge simple request',
  'thought for ',
  'files edited',
  'progress updates',
  'initiating prompt response',
  'initiating artifact generation',
  'handling ',
  'refining ',
  'open agent manager',
  'open editor',
  'scroll to bottom',
  'selected model:',
  'workspace:',
  'correlation token:',
  'pedido do usuario:',
  'user request:',
  '[zavorth_task_id:',
  '[zavorth_direct_prompt]',
  "i've initiated the response protocol",
  'ive initiated the response protocol',
  "i've started by reviewing",
  'ive started by reviewing',
  'the agents startup procedure',
  'the final step of the agents start-up process',
  'the final step of the agents startup process',
  'currently, i am about to read',
  'to gather a complete understanding before formulating the requested output.',
  'zavorth host supervisor',
  'zavorth foi derrubado e reiniciado com sucesso',
  'resumo da operacao:',
  'gateway do telegram',
  'spawning worker',
  '1. derrubada:',
  '2. reinicializacao:',
  '(ctrl+k m) to get started. start typing to dismiss or',
  'restricted mode is intended for safe code browsing.',
  'executor_recommendation:',
];

const INTERMEDIATE_RESPONSE_PATTERNS = [
  'acknowledge simple request',
  'initiating task execution',
  'i have received the directive',
  "i've received the directive",
  'the task is now actively being addressed',
  'current file context',
  'analyzed current file context',
  'reviewed and understand',
  'processing direct request',
  'initiating response protocol',
  'response protocol',
  'agents startup procedure',
  'formulating the requested output',
  'response sequence',
  'zavorth host supervisor',
  'zavorth foi derrubado e reiniciado com sucesso',
  'spawning worker',
  'gateway do telegram',
  'resumo da operacao',
  'executor_recommendation:',
];

const PATH_NOISE_PATTERNS = [
  /^#l\d+(?:[-:]\d+)?$/i,
  /^memory\/[\w./-]+$/i,
];

export function normalizeZavorthBridgeUiText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sanitizeZavorthBridgeUiResponse(
  value: string | null | undefined,
  promptText?: string | null | undefined,
): string {
  const normalizedPrompt = normalizeZavorthBridgeUiText(promptText);
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitDirectiveResponse = extractExplicitDirectiveResponse(value, promptText);
  if (explicitDirectiveResponse) {
    return explicitDirectiveResponse;
  }

  const anchoredDirectiveResponse = extractExplicitAnchorResponse(value, promptText);
  if (anchoredDirectiveResponse) {
    return anchoredDirectiveResponse;
  }

  const trailingAnswerBlock = extractTrailingAnswerBlock(lines, normalizedPrompt);
  if (trailingAnswerBlock.length > 0) {
    return trailingAnswerBlock.join('\n').trim();
  }

  const cleaned = lines.filter((line) => !isZavorthBridgeUiNoiseLine(line, normalizedPrompt));

  return cleaned.join('\n').trim();
}

export function doesZavorthBridgeUiResponseMatchPrompt(
  responseText: string | null | undefined,
  promptText: string | null | undefined,
): boolean {
  const normalizedResponse = normalizeZavorthBridgeUiText(responseText);
  if (!normalizedResponse) {
    return false;
  }

  const anchors = extractPromptAnchors(promptText);
  if (anchors.length === 0) {
    return true;
  }

  const strongestAnchor = anchors.find((anchor) => isStrongPromptAnchor(anchor));
  if (strongestAnchor) {
    return normalizedResponse.includes(strongestAnchor);
  }

  return anchors.some((anchor) => normalizedResponse.includes(anchor));
}

export function looksLikeZavorthBridgeHomeScreen(
  valueOrSnapshot: string | null | undefined | ZavorthBridgeUiResponseHints,
): boolean {
  if (typeof valueOrSnapshot === 'object' && valueOrSnapshot !== null) {
    const diagnostics = valueOrSnapshot.uiDiagnostics || {};
    if (diagnostics.homeScreenBefore === true || diagnostics.homeScreenAfter === true) {
      return true;
    }

    return looksLikeZavorthBridgeHomeScreen(valueOrSnapshot.responseText || '');
  }

  const normalized = normalizeZavorthBridgeUiText(String(valueOrSnapshot || ''));
  if (!normalized) {
    return false;
  }

  return normalized.includes('switch to agent manager') && normalized.includes('code with agent');
}

export function looksLikeZavorthBridgeIntermediateNarration(value: string | null | undefined): boolean {
  const normalized = normalizeZavorthBridgeUiText(value);
  if (!normalized) {
    return false;
  }

  if (looksLikeZavorthBridgeHomeScreen(normalized)) {
    return true;
  }

  if (INTERMEDIATE_RESPONSE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  if (
    /#l\d+/i.test(normalized) &&
    /(directive|reviewed and understand|current file context|task is now actively being addressed|analyzed)/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
}

function isZavorthBridgeUiNoiseLine(line: string, normalizedPrompt: string): boolean {
  const normalizedLine = normalizeZavorthBridgeUiText(line);
  if (!normalizedLine) {
    return true;
  }

  if (normalizedPrompt && normalizedLine === normalizedPrompt) {
    return true;
  }

  if (EXACT_CHROME_LINES.has(normalizedLine)) {
    return true;
  }

  if (PREFIX_CHROME_PATTERNS.some((pattern) => normalizedLine.startsWith(pattern))) {
    return true;
  }

  if (PATH_NOISE_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }

  if (
    normalizedLine.includes('zavorth_direct_prompt') ||
    normalizedLine.includes('correlation token:') ||
    normalizedLine.includes('user request:') ||
    normalizedLine.includes('pedido do usuario:')
  ) {
    return true;
  }

  if (INTERMEDIATE_RESPONSE_PATTERNS.some((pattern) => normalizedLine.includes(pattern))) {
    return true;
  }

  return false;
}

function extractTrailingAnswerBlock(lines: string[], normalizedPrompt: string): string[] {
  const block: string[] = [];
  let sawTrailingNoise = false;
  let started = false;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] || '';
    const isNoise = isZavorthBridgeUiNoiseLine(line, normalizedPrompt);

    if (!started) {
      if (isNoise) {
        sawTrailingNoise = true;
        continue;
      }

      block.unshift(line);
      started = true;
      continue;
    }

    if (isNoise) {
      return sawTrailingNoise ? block : [];
    }

    block.unshift(line);
  }

  return sawTrailingNoise ? block : [];
}

function extractExplicitDirectiveResponse(
  responseText: string | null | undefined,
  promptText: string | null | undefined,
): string | null {
  const expectedOutputs = extractExplicitDirectiveOutputs(promptText);
  if (expectedOutputs.length === 0) {
    return null;
  }

  const normalizedResponse = normalizeZavorthBridgeUiText(responseText);
  if (!normalizedResponse) {
    return null;
  }

  const matchedOutputs = expectedOutputs.filter((value) =>
    normalizedResponse.includes(normalizeZavorthBridgeUiText(value)),
  );

  if (matchedOutputs.length === 0) {
    return null;
  }

  if (expectedOutputs.length > 1 && matchedOutputs.length !== expectedOutputs.length) {
    return null;
  }

  return matchedOutputs.join('\n').trim();
}

function extractExplicitAnchorResponse(
  responseText: string | null | undefined,
  promptText: string | null | undefined,
): string | null {
  const normalizedPrompt = normalizeZavorthBridgeUiText(promptText);
  if (!isExplicitOutputPrompt(normalizedPrompt)) {
    return null;
  }

  const normalizedResponse = normalizeZavorthBridgeUiText(responseText);
  if (!normalizedResponse) {
    return null;
  }

  const matchedAnchors = extractPromptAnchorsPreservingCase(promptText).filter((anchor) =>
    normalizedResponse.includes(normalizeZavorthBridgeUiText(anchor)),
  );
  if (matchedAnchors.length === 0) {
    return null;
  }

  const compactAnchors = matchedAnchors.filter(
    (anchor, index) =>
      !matchedAnchors.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          normalizeZavorthBridgeUiText(other).includes(normalizeZavorthBridgeUiText(anchor)) &&
          other.length > anchor.length,
      ),
  );

  return compactAnchors.join('\n').trim() || null;
}

function extractExplicitDirectiveOutputs(promptText: string | null | undefined): string[] {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    return [];
  }

  const outputs: string[] = [];
  const seen = new Set<string>();
  const robustPatterns = [
    /(?:responda|answer|reply)\s+(?:apenas|somente|only)\s+(?:com|with)\s+(?:["'`“”‘’])?(.+?)(?:["'`“”‘’])?(?=(?:\s+e\s+(?:em|na|on)\s+(?:uma?\s+|a\s+)?segunda\s+linha\b)|(?:\s+and\s+(?:on|in)\s+(?:a\s+)?second\s+line\b)|(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?segunda\s+linha.{0,120}?(?:escreva|write)\s+(?:["'`“”‘’])?(.+?)(?:["'`“”‘’])?(?=(?:\s+e\s+(?:em|na|on)\s+(?:uma?\s+|a\s+)?terceira\s+linha\b)|(?:\s+and\s+(?:on|in)\s+(?:a\s+)?third\s+line\b)|(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?terceira\s+linha.{0,120}?(?:escreva|write)\s+(?:["'`“”‘’])?(.+?)(?:["'`“”‘’])?(?=(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
  ];
  for (const pattern of robustPatterns) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = sanitizeDirectiveCandidate(match[1]);
      if (!candidate || seen.has(candidate)) {
        continue;
      }
      outputs.push(candidate);
      seen.add(candidate);
    }
  }
  const patterns = [
    /(?:responda|answer|reply)\s+(?:apenas|somente|only)\s+(?:com|with)\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]{1,200})["'`\u201C\u201D\u2018\u2019]/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?segunda\s+linha[^"'`\u201C\u201D\u2018\u2019]{0,120}(?:escreva|write)\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]{1,200})["'`\u201C\u201D\u2018\u2019]/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?terceira\s+linha[^"'`\u201C\u201D\u2018\u2019]{0,120}(?:escreva|write)\s+["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]{1,200})["'`\u201C\u201D\u2018\u2019]/gi,
  ];

  for (const pattern of patterns) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = sanitizeDirectiveCandidate(match[1]);
      if (!candidate || seen.has(candidate)) {
        continue;
      }
      outputs.push(candidate);
      seen.add(candidate);
    }
  }

  const unquotedPatterns = [
    /(?:responda|answer|reply)\s+(?:apenas|somente|only)\s+(?:com|with)\s+(.+?)(?=(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?segunda\s+linha.{0,120}?(?:escreva|write)\s+(.+?)(?=(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
    /(?:na|em|on)\s+(?:uma?\s+|a\s+)?terceira\s+linha.{0,120}?(?:escreva|write)\s+(.+?)(?=(?:\s+(?:e\s+depois|and\s+then|depois|then)\b)|[\r\n]|$)/gi,
  ];

  for (const pattern of unquotedPatterns) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const candidate = sanitizeDirectiveCandidate(match[1]);
      if (!candidate || seen.has(candidate)) {
        continue;
      }
      outputs.push(candidate);
      seen.add(candidate);
    }
  }

  return outputs;
}

function sanitizeDirectiveCandidate(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^[`"'\u201C\u201D\u2018\u2019]+|[`"'\u201C\u201D\u2018\u2019]+$/g, '')
    .trim()
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

function isExplicitOutputPrompt(normalizedPrompt: string): boolean {
  return [
    'responda apenas com',
    'responda somente com',
    'answer only with',
    'reply only with',
    'segunda linha',
    'second line',
    'terceira linha',
    'third line',
  ].some((marker) => normalizedPrompt.includes(marker));
}

function extractPromptAnchorsPreservingCase(promptText: string | null | undefined): string[] {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    return [];
  }

  const anchors = new Map<string, string>();
  const pushAnchor = (candidate: string | null | undefined, minimumLength: number) => {
    const cleaned = sanitizeDirectiveCandidate(candidate);
    if (!cleaned || cleaned.length < minimumLength) {
      return;
    }

    const normalized = normalizeZavorthBridgeUiText(cleaned);
    if (!anchors.has(normalized)) {
      anchors.set(normalized, cleaned);
    }
  };

  const quotedMatches = prompt.matchAll(/["'`\u201C\u201D\u2018\u2019]([^"'`\u201C\u201D\u2018\u2019]{5,160})["'`\u201C\u201D\u2018\u2019]/g);
  for (const match of quotedMatches) {
    pushAnchor(match[1], 5);
  }

  const pathMatches = prompt.matchAll(/[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)+(?:\.[A-Za-z0-9_-]+)?/g);
  for (const match of pathMatches) {
    pushAnchor(match[0], 5);
  }

  const symbolicMatches = prompt.matchAll(/\b[A-Z0-9_=-]{6,}\b/g);
  for (const match of symbolicMatches) {
    pushAnchor(match[0], 6);
  }

  return Array.from(anchors.values()).sort((left, right) => right.length - left.length);
}

function extractPromptAnchors(promptText: string | null | undefined): string[] {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    return [];
  }

  const anchors = new Set<string>();
  const quotedMatches = prompt.matchAll(/["'`“”‘’]([^"'`“”‘’]{5,160})["'`“”‘’]/g);
  for (const match of quotedMatches) {
    const normalized = normalizeZavorthBridgeUiText(match[1]);
    if (normalized.length >= 5) {
      anchors.add(normalized);
    }
  }

  const pathMatches = prompt.matchAll(/[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)+(?:\.[A-Za-z0-9_-]+)?/g);
  for (const match of pathMatches) {
    const normalized = normalizeZavorthBridgeUiText(match[0]);
    if (normalized.length >= 5) {
      anchors.add(normalized);
    }
  }

  const symbolicMatches = prompt.matchAll(/\b[A-Z0-9_=-]{6,}\b/g);
  for (const match of symbolicMatches) {
    const normalized = normalizeZavorthBridgeUiText(match[0]);
    if (normalized.length >= 6) {
      anchors.add(normalized);
    }
  }

  return Array.from(anchors).sort((left, right) => right.length - left.length);
}

function isStrongPromptAnchor(anchor: string): boolean {
  return (
    anchor.length >= 12 ||
    /\d/.test(anchor) ||
    /[\\/._=-]/.test(anchor) ||
    /[A-Z]/.test(anchor)
  );
}

export function isZavorthBridgeUiSurfaceReady(snapshot: ZavorthBridgeUiResponseHints): boolean {
  if (snapshot.hasPermissionPrompt) {
    return false;
  }

  const hasInputBar = snapshot.hasInputBar === true;
  if (looksLikeZavorthBridgeHomeScreen(snapshot) && !hasInputBar) {
    return false;
  }

  return true;
}

export function isZavorthBridgeUiResponseReadyForDelivery(
  snapshot: ZavorthBridgeUiResponseHints,
  text: string | null | undefined,
): boolean {
  const cleaned = String(text || '').trim();
  if (!cleaned) {
    return false;
  }

  if (!isZavorthBridgeUiSurfaceReady(snapshot)) {
    return false;
  }

  if (String(snapshot.status || '').trim().toLowerCase() !== 'ready') {
    return false;
  }

  if (looksLikeZavorthBridgeIntermediateNarration(cleaned)) {
    return false;
  }

  return true;
}
