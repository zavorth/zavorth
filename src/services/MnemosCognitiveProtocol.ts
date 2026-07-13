/**
 * MnemosCognitiveProtocol
 *
 * Cognitive cadence instructions the LLM agent should follow when Mnemos
 * tools are available. Injected as an extra system-prompt layer.
 *
 * Cadence stages:
 *  Stage 1: Semantic vault search → search_memory
 *  Stage 2: Metadata scan         → scan_local_metadata
 *  Stage 3: Human-in-the-loop     → user confirms indexing
 */

export const MNEMOS_SEARCH_MEMORY_TOOL = 'search_memory';
export const MNEMOS_SCAN_LOCAL_METADATA_TOOL = 'scan_local_metadata';
export const MNEMOS_UNDERSTAND_FILE_TOOL = 'understand_file';
export const MNEMOS_INDEX_FILE_TOOL = 'index_file';

export const MNEMOS_CONTEXT_REQUIRED_TOOLS = [
  MNEMOS_SEARCH_MEMORY_TOOL,
  MNEMOS_SCAN_LOCAL_METADATA_TOOL,
  MNEMOS_UNDERSTAND_FILE_TOOL,
] as const;

export const MNEMOS_CANONICAL_CADENCE = [
  ...MNEMOS_CONTEXT_REQUIRED_TOOLS,
  MNEMOS_INDEX_FILE_TOOL,
] as const;

export const MNEMOS_INDEXING_APPROVAL_BOUNDARY = 'human-in-the-loop';

/**
 * Returns true when Mnemos tools are available in the agent catalog.
 */
export function isMnemosAvailable(toolNames: readonly string[]): boolean {
  const toolNameSet = new Set(toolNames);
  return MNEMOS_CONTEXT_REQUIRED_TOOLS.every((toolName) => toolNameSet.has(toolName));
}

/**
 * Full cognitive cadence instruction for system-prompt injection.
 * Include only when Mnemos is connected with registered tools.
 */
export function buildMnemosCognitiveInstruction(): string {
  return [
    'LOCAL MEMORY PROTOCOL (MNEMOS):',
    'You have access to a local vector memory engine called Mnemos.',
    'When the user asks something that may refer to their documents, notes, PDFs, or personal files, follow this cadence:',
    '',
    '1. STAGE 1 — HOT ZONE: Use search_memory(query="...") to search the vector vault.',
    '   - If you find relevant results (hits > 0), use them as context to answer.',
    '   - If not (hits = 0), proceed to Stage 2.',
    '',
    '2. STAGE 2 — LIGHT RADAR: Use scan_local_metadata(keywords=["..."]) to scan file names in authorized folders.',
    '   - Extract meaningful keywords from the user question.',
    '   - If you find candidates, present them and ask whether to index.',
    '   - When presenting candidates, ALWAYS prefix the message with "🔍 **Mnemos Vault Search**".',
    '',
    '3. STAGE 3 — HUMAN-IN-THE-LOOP: If the user confirms indexing:',
    '   - Before indexing a new file, use understand_file(file_path="...") for type, text, OCR, tables, limits, and receipt.',
    '   - If vision_required=true or transcription_required=true, explain that visual/audio reading needs separate approval for a multimodal/transcription provider.',
    '   - Use index_file(file_path="...") to index with the same Universal File Understanding.',
    '   - After successful indexing, run search_memory again with the original query.',
    '   - Use the results to produce the final answer.',
    '',
    'IMPORTANT RULES:',
    '- NEVER send local file contents to external APIs without user confirmation first.',
    '- Only short text fragments extracted from the vault should be used as context.',
    '- If the vault is empty (total_documents = 0), tell the user they can add documents.',
    '- Do not force the Mnemos cadence on generic questions that clearly do not refer to personal documents.',
    '- Use vault_status when the user asks about memory state.',
  ].join('\n');
}

/**
 * Compact instruction for token-limited surfaces.
 */
export function buildMnemosCognitiveInstructionCompact(): string {
  return [
    'MNEMOS: You have access to the local memory vault.',
    'For questions about user documents: search_memory → scan_local_metadata → understand_file → index_file.',
    'Extracted fragments are used as context. No file leaves the machine without consent.',
  ].join(' ');
}
