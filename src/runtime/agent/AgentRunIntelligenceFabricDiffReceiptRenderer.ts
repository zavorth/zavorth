export function renderIntelligenceFabricDiffReceipt(value: unknown): string | null {
  const receipt = readRecord(value);
  const files = Array.isArray(receipt.files)
    ? receipt.files.map((entry) => readRecord(entry)).filter((entry) => Object.keys(entry).length > 0)
    : [];
  if (files.length === 0) {
    return null;
  }
  const verifier = readRecord(receipt.verifier);
  const lines = [
    'Previa de alteracao',
    `Resumo: ${text(receipt.summary, `${files.length} arquivo(s) afetado(s).`)}`,
    `Risco: ${text(receipt.riskLevel, '3')} reversivel; rollback: ${receipt.rollbackAvailable === false ? 'indisponivel' : 'disponivel'}.`,
    `Verifier: ${text(verifier.status, 'unknown')}${verifier.ambiguous === true ? ' (ambiguo)' : ''}.`,
    `Apply: ${receipt.applyRequiresRequest === false ? 'pode seguir policy existente' : 'so com pedido explicito'}.`,
    'Arquivos:',
    ...files.slice(0, 6).flatMap((file) => renderFile(file)),
  ];
  if (files.length > 6) {
    lines.push(`- mais ${files.length - 6} arquivo(s) omitido(s) da previa curta.`);
  }
  return lines.join('\n');
}

function renderFile(file: Record<string, unknown>): string[] {
  const hunks = Array.isArray(file.hunks)
    ? file.hunks.map((entry) => readRecord(entry)).filter((entry) => Object.keys(entry).length > 0)
    : [];
  const reasons = Array.isArray(file.reasons)
    ? file.reasons.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  const lines = [
    `- ${text(file.path, 'arquivo')}: ${text(file.operation, 'edit')}, ${text(file.hunkCount, String(hunks.length || 1))} hunk(s), ${text(file.status, 'unknown')}`,
  ];
  for (const hunk of hunks.slice(0, 4)) {
    lines.push(`  ${text(hunk.index, '?')}. ${renderHunk(hunk)}`);
  }
  if (hunks.length > 4) {
    lines.push(`  ... mais ${hunks.length - 4} hunk(s)`);
  }
  for (const reason of reasons.slice(0, 2)) {
    lines.push(`  bloqueio: ${reason}`);
  }
  return lines;
}

function renderHunk(hunk: Record<string, unknown>): string {
  const search = optionalText(hunk.searchPreview);
  const replace = text(hunk.replacePreview, '');
  return search
    ? `"${search}" -> "${replace}"`
    : `novo conteudo: "${replace}"`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function optionalText(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
