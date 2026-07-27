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

const PREFIX_CHROME_MARKERS = [
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
  'user request:',
  '[zavorth_task_id:',
  '[zavorth_direct_prompt]',
  'operation summary:',
  'spawning worker',
  'executor_recommendation:',
];

const INTERMEDIATE_RESPONSE_MARKERS = [
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
  'formulating the requested output',
  'response sequence',
  'spawning worker',
  'executor_recommendation:',
];

export function normalizeZavorthBridgeUiText(value: string | null | undefined): string {
  const source = String(value || '').trim().toLowerCase();
  let output = '';
  let previousWasSpace = false;
  for (const char of source) {
    const isSpace = char.trim().length === 0;
    if (isSpace) {
      if (!previousWasSpace) {
        output += ' ';
      }
      previousWasSpace = true;
      continue;
    }
    output += char;
    previousWasSpace = false;
  }
  return output.trim();
}

export function sanitizeZavorthBridgeUiResponse(
  value: string | null | undefined,
  promptText?: string | null | undefined,
): string {
  const normalizedPrompt = normalizeZavorthBridgeUiText(promptText);
  const lines = splitLines(value).map((line) => line.trim()).filter(Boolean);
  const anchoredDirectiveResponse = extractExplicitAnchorResponse(value, promptText);
  if (anchoredDirectiveResponse) {
    return anchoredDirectiveResponse;
  }

  const trailingAnswerBlock = extractTrailingAnswerBlock(lines, normalizedPrompt);
  if (trailingAnswerBlock.length > 0) {
    return trailingAnswerBlock.join('\n').trim();
  }

  return lines.filter((line) => !isZavorthBridgeUiNoiseLine(line, normalizedPrompt)).join('\n').trim();
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
    return containsText(normalizedResponse, strongestAnchor);
  }

  return anchors.some((anchor) => containsText(normalizedResponse, anchor));
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
  return Boolean(normalized && containsText(normalized, 'switch to agent manager') && containsText(normalized, 'code with agent'));
}

export function looksLikeZavorthBridgeIntermediateNarration(value: string | null | undefined): boolean {
  const normalized = normalizeZavorthBridgeUiText(value);
  if (!normalized) {
    return false;
  }
  if (looksLikeZavorthBridgeHomeScreen(normalized)) {
    return true;
  }
  if (INTERMEDIATE_RESPONSE_MARKERS.some((marker) => containsText(normalized, marker))) {
    return true;
  }
  return hasLineReference(normalized) && [
    'directive',
    'reviewed and understand',
    'current file context',
    'task is now actively being addressed',
    'analyzed',
  ].some((marker) => containsText(normalized, marker));
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
  if (PREFIX_CHROME_MARKERS.some((marker) => hasTextPrefix(normalizedLine, marker))) {
    return true;
  }
  if (isTechnicalPathNoise(line)) {
    return true;
  }
  if (
    containsText(normalizedLine, 'zavorth_direct_prompt') ||
    containsText(normalizedLine, 'correlation token:') ||
    containsText(normalizedLine, 'user request:')
  ) {
    return true;
  }
  return INTERMEDIATE_RESPONSE_MARKERS.some((marker) => containsText(normalizedLine, marker));
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

function extractExplicitAnchorResponse(
  responseText: string | null | undefined,
  promptText: string | null | undefined,
): string | null {
  const normalizedResponse = normalizeZavorthBridgeUiText(responseText);
  if (!normalizedResponse) {
    return null;
  }
  const matchedAnchors = extractPromptAnchorsPreservingCase(promptText).filter((anchor) =>
    containsText(normalizedResponse, normalizeZavorthBridgeUiText(anchor)),
  );
  if (matchedAnchors.length === 0) {
    return null;
  }
  const compactAnchors = matchedAnchors.filter((anchor, index) =>
    !matchedAnchors.some((other, otherIndex) =>
      otherIndex !== index &&
      containsText(normalizeZavorthBridgeUiText(other), normalizeZavorthBridgeUiText(anchor)) &&
      other.length > anchor.length,
    ),
  );
  return compactAnchors.join('\n').trim() || null;
}

function sanitizeDirectiveCandidate(value: string | null | undefined): string {
  return stripTerminalPunctuation(stripSymmetricQuotes(String(value || '').trim())).trim();
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

  for (const quoted of extractQuotedSegments(prompt, 5, 160)) {
    pushAnchor(quoted, 5);
  }
  for (const path of extractPathLikeSegments(prompt)) {
    pushAnchor(path, 5);
  }
  for (const symbol of extractSymbolicSegments(prompt)) {
    pushAnchor(symbol, 6);
  }

  return Array.from(anchors.values()).sort((left, right) => right.length - left.length);
}

function extractPromptAnchors(promptText: string | null | undefined): string[] {
  return extractPromptAnchorsPreservingCase(promptText)
    .map((anchor) => normalizeZavorthBridgeUiText(anchor))
    .filter((anchor, index, all) => anchor.length >= 5 && all.indexOf(anchor) === index)
    .sort((left, right) => right.length - left.length);
}

function isStrongPromptAnchor(anchor: string): boolean {
  return anchor.length >= 12 || containsDigit(anchor) || containsAny(anchor, ['/', '\\', '.', '_', '=', '-']) || containsUppercase(anchor);
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
  if (!cleaned || !isZavorthBridgeUiSurfaceReady(snapshot)) {
    return false;
  }
  if (String(snapshot.status || '').trim().toLowerCase() !== 'ready') {
    return false;
  }
  return !looksLikeZavorthBridgeIntermediateNarration(cleaned);
}

function splitLines(value: string | null | undefined): string[] {
  const output: string[] = [];
  let current = '';
  for (const char of String(value || '')) {
    if (char === '\r') {
      continue;
    }
    if (char === '\n') {
      output.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  output.push(current);
  return output;
}

function extractQuotedSegments(value: string, min: number, max: number): string[] {
  const quoteChars = new Set(['"', "'", '`', '“', '”', '‘', '’']);
  const result: string[] = [];
  let quote: string | null = null;
  let buffer = '';
  for (const char of value) {
    if (!quote && quoteChars.has(char)) {
      quote = char;
      buffer = '';
      continue;
    }
    if (quote && quoteChars.has(char)) {
      if (buffer.length >= min && buffer.length <= max) {
        result.push(buffer);
      }
      quote = null;
      buffer = '';
      continue;
    }
    if (quote) {
      buffer += char;
    }
  }
  return result;
}

function extractPathLikeSegments(value: string): string[] {
  return tokenize(value).filter((token) =>
    token.length >= 5 &&
    (containsText(token, '/') || containsText(token, '\\')) &&
    token.split('/').join('\\').split('\\').filter(Boolean).length >= 2,
  );
}

function extractSymbolicSegments(value: string): string[] {
  return tokenize(value).filter((token) => token.length >= 6 && allChars(token, isSymbolicAnchorChar) && containsUppercase(token));
}

function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const char of value) {
    if (isAnchorTokenChar(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
    }
    current = '';
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function isTechnicalPathNoise(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (hasTextPrefix(normalized, '#l')) {
    const rest = normalized.slice(2);
    return rest.length > 0 && allChars(rest, (char) => isDigit(char) || char === '-' || char === ':');
  }
  return hasTextPrefix(normalized, 'memory/') && normalized.length > 'memory/'.length && tokenize(normalized).length === 1;
}

function hasLineReference(value: string): boolean {
  const index = value.indexOf('#l');
  if (index < 0) {
    return false;
  }
  const next = value[index + 2] || '';
  return isDigit(next);
}

function stripSymmetricQuotes(value: string): string {
  const quoteChars = new Set(['"', "'", '`', '“', '”', '‘', '’']);
  let start = 0;
  let end = value.length;
  while (start < end && quoteChars.has(value[start] || '')) {
    start += 1;
  }
  while (end > start && quoteChars.has(value[end - 1] || '')) {
    end -= 1;
  }
  return value.slice(start, end);
}

function stripTerminalPunctuation(value: string): string {
  let end = value.length;
  while (end > 0 && isTerminalPunctuation(value[end - 1] || '')) {
    end -= 1;
  }
  return value.slice(0, end);
}

function containsDigit(value: string): boolean {
  return Array.from(value).some(isDigit);
}

function containsUppercase(value: string): boolean {
  return Array.from(value).some((char) => char >= 'A' && char <= 'Z');
}

function containsAny(value: string, chars: string[]): boolean {
  return chars.some((char) => containsText(value, char));
}

function allChars(value: string, predicate: (char: string) => boolean): boolean {
  return Array.from(value).every(predicate);
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isAsciiLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isAnchorTokenChar(char: string): boolean {
  return isAsciiLetter(char) || isDigit(char) || isAnchorSymbol(char);
}

function isSymbolicAnchorChar(char: string): boolean {
  return isAsciiLetter(char) || isDigit(char) || isCompactSymbol(char);
}

function containsText(value: string, needle: string): boolean {
  return value.indexOf(needle) >= 0;
}

function hasTextPrefix(value: string, prefix: string): boolean {
  if (prefix.length > value.length) {
    return false;
  }
  for (let index = 0; index < prefix.length; index += 1) {
    if (value.charAt(index) !== prefix.charAt(index)) {
      return false;
    }
  }
  return true;
}

function isTerminalPunctuation(char: string): boolean {
  return char === '.' || char === ',' || char === ';' || char === ':' || char === '!';
}

function isAnchorSymbol(char: string): boolean {
  return char === '_' || char === '.' || char === '-' || char === '/' || char === '\\' || char === '=';
}

function isCompactSymbol(char: string): boolean {
  return char === '_' || char === '=' || char === '-';
}
