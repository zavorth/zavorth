export type NaturalTaskApprovalIntent = {
  command: 'approve' | 'reject';
  taskId?: string;
  resolveRecent?: {
    keywords: string[];
  } | null;
  intro: string;
};

export type NaturalTaskControlIntent = {
  action: 'resume' | 'undo' | 'retry';
  taskId?: string;
  resolveRecent?: {
    keywords: string[];
  } | null;
  intro: string;
};

export type NaturalRecentTaskFollowupIntent = {
  kind: 'status' | 'next';
  keywords: string[];
  intro: string;
};

export function parseNaturalTaskApprovalIntent(rawText: string): NaturalTaskApprovalIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalTaskText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  if (!/\b(task|tarefa)\b/.test(normalized)) {
    return null;
  }

  const taskId = extractNaturalTaskId(normalized);

  if (/\b(aprovar|aprova|aprove|approve)\b/.test(normalized)) {
    if (!taskId) {
      return extractRecentTaskApprovalIntent(original, normalized, 'approve');
    }
    return {
      command: 'approve',
      taskId,
      intro: `Entendi que voce quer aprovar a tarefa ${taskId}.`,
    };
  }

  if (/\b(rejeitar|rejeite|reject|negar|negue)\b/.test(normalized)) {
    if (!taskId) {
      return extractRecentTaskApprovalIntent(original, normalized, 'reject');
    }
    return {
      command: 'reject',
      taskId,
      intro: `Entendi que voce quer rejeitar a tarefa ${taskId}.`,
    };
  }

  return null;
}

export function parseNaturalTaskControlIntent(rawText: string): NaturalTaskControlIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalTaskText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const mentionsTaskSurface = /\b(task|tarefa|trabalho|pedido)\b/.test(normalized);
  const referencesPriorTaskPronoun = /\b(isso|disso|nisso|nisto)\b/.test(normalized);
  if (!mentionsTaskSurface || /\bworkflow\b/.test(normalized)) {
    if (!referencesPriorTaskPronoun) {
      return null;
    }
  }

  const taskId = extractNaturalTaskId(normalized);

  if (/\b(reabrir|reabra|reopen|retry|repetir|repita)\b/.test(normalized) || /\btente de novo\b/.test(normalized) || /\btente novamente\b/.test(normalized)) {
    if (taskId) {
      return {
        action: 'retry',
        taskId,
        intro: `Entendi que voce quer reabrir a tarefa ${taskId} como um novo pedido canonico.`,
      };
    }
    return extractRecentTaskControlIntent(original, normalized, 'retry');
  }

  if (/\b(desfazer|desfaca|undo|reverter|reverta|rollback)\b/.test(normalized)) {
    if (taskId) {
      return {
        action: 'undo',
        taskId,
        intro: `Entendi que voce quer desfazer a tarefa ${taskId}.`,
      };
    }
    return extractRecentTaskControlIntent(original, normalized, 'undo');
  }

  if (/\b(retomar|retome|continuar|continue|seguir|prossiga)\b/.test(normalized)) {
    if (taskId) {
      return {
        action: 'resume',
        taskId,
        intro: `Entendi que voce quer retomar a tarefa ${taskId}.`,
      };
    }
    return extractRecentTaskControlIntent(original, normalized, 'resume');
  }

  return null;
}

export function parseNaturalRecentTaskFollowupIntent(
  rawText: string,
): NaturalRecentTaskFollowupIntent | null {
  const original = String(rawText || '').trim();
  const normalized = normalizeNaturalTaskText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const keywords = extractRecentTaskContextKeywords(original);
  const mentionsRecentTask =
    /\b(ultima tarefa|ultimo pedido|ultimo trabalho|trabalho anterior|pedido anterior|dessa ultima|da ultima)\b/.test(
      normalized,
    ) || /^(e ai|e a ultima tarefa|cade a ultima tarefa|como ficou)/.test(normalized);
  const referencesPriorTaskPronoun =
    /\b(nela|nisso|disso|nisto)\b/.test(normalized) &&
    /\b(falta|faltou|proximo passo|proxima etapa|status|andamento|deu certo|terminou|ficou)\b/.test(normalized);

  if (
    /\b(o que falta|falta nela|falta nisso|qual o proximo passo|proxima etapa|e agora)\b/.test(normalized) &&
    (mentionsRecentTask || referencesPriorTaskPronoun)
  ) {
    return {
      kind: 'next',
      keywords,
      intro: 'Entendi que voce quer saber o proximo passo da tarefa recente do Zavorth.',
    };
  }

  if (
    (/\b(cade|como ficou|deu certo|terminou|status|andamento|ficou pronto|qual foi)\b/.test(normalized) ||
      /^(e a ultima tarefa|e o ultimo pedido)\b/.test(normalized)) &&
    (mentionsRecentTask || referencesPriorTaskPronoun)
  ) {
    return {
      kind: 'status',
      keywords,
      intro: 'Entendi que voce quer ver o status da tarefa recente do Zavorth.',
    };
  }

  return null;
}

export function extractRecentTaskContextKeywords(rawText: string): string[] {
  const taskReferenceMatch = rawText.match(
    /\b(?:task|tarefa|trabalho|pedido)(?:\s+(?:de|do|da|para|sobre))\s+(.+)$/i,
  );
  if (taskReferenceMatch?.[1]) {
    return extractWorkflowSearchKeywords(taskReferenceMatch[1]);
  }
  return [];
}

export function extractWorkflowSearchKeywords(text: string): string[] {
  const normalized = normalizeNaturalTaskText(text);
  return Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 3 &&
            ![
              'workflow',
              'retomar',
              'retome',
              'resume',
              'continuar',
              'continue',
              'ultimo',
              'ultima',
              'anterior',
              'mais',
              'recente',
              'sobre',
              'para',
              'de',
              'do',
              'da',
              'com',
              'sem',
              'uma',
              'uns',
              'umas',
              'dos',
              'das',
              'que',
            ].includes(token),
        ),
    ),
  ).slice(0, 6);
}

export function normalizeNaturalTaskText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function extractRecentTaskApprovalIntent(
  rawText: string,
  normalized: string,
  command: 'approve' | 'reject',
): NaturalTaskApprovalIntent | null {
  const latestOnly = /\b(ultimo|ultima|anterior|mais recente|recente|pendente)\b/.test(normalized);
  const descriptiveMatch = rawText.match(/\b(?:task|tarefa)(?:\s+(?:de|do|da|para|sobre))\s+(.+)$/i);
  const keywords = descriptiveMatch?.[1]
    ? extractWorkflowSearchKeywords(descriptiveMatch[1])
    : [];

  if (!latestOnly && keywords.length === 0) {
    return null;
  }

  const actionLabel = command === 'approve' ? 'aprovar' : 'rejeitar';
  const targetLabel =
    keywords.length > 0
      ? `mais relacionada a ${keywords.join(' ')}`
      : 'mais recente com approval pendente';

  return {
    command,
    resolveRecent: { keywords },
    intro: `Entendi que voce quer ${actionLabel} a tarefa ${targetLabel}.`,
  };
}

function extractRecentTaskControlIntent(
  rawText: string,
  normalized: string,
  action: 'resume' | 'undo' | 'retry',
): NaturalTaskControlIntent | null {
  const latestOnly = /\b(ultimo|ultima|anterior|mais recente|recente|atual)\b/.test(normalized);
  const pronounReference = /\b(isso|disso|nisso|nisto)\b/.test(normalized);
  const descriptiveMatch = rawText.match(
    /\b(?:task|tarefa|trabalho|pedido)(?:\s+(?:de|do|da|para|sobre))\s+(.+)$/i,
  );
  const keywords = descriptiveMatch?.[1]
    ? extractWorkflowSearchKeywords(descriptiveMatch[1])
    : [];

  if (!latestOnly && !pronounReference && keywords.length === 0) {
    return null;
  }

  const actionLabel =
    action === 'resume'
      ? 'retomar'
      : action === 'undo'
        ? 'desfazer'
        : 'reabrir';
  const targetLabel =
    keywords.length > 0
      ? `mais relacionada a ${keywords.join(' ')}`
      : action === 'resume'
        ? 'mais recente com retomada disponivel'
        : action === 'undo'
          ? 'mais recente com rollback disponivel'
          : 'mais recente elegivel para retry canonico';

  return {
    action,
    resolveRecent: { keywords },
    intro: `Entendi que voce quer ${actionLabel} a tarefa ${targetLabel}.`,
  };
}

function extractNaturalTaskId(normalized: string): string | null {
  const uuidMatch = normalized.match(
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
  );
  if (uuidMatch?.[1]) {
    return uuidMatch[1];
  }

  const taskLikeMatch = normalized.match(/\b(task[-:][a-z0-9._:-]+)\b/i);
  if (taskLikeMatch?.[1]) {
    return taskLikeMatch[1];
  }

  const explicitMatch = normalized.match(/\b(?:task|tarefa)\s+([a-z0-9][a-z0-9._:-]+)\b/i);
  if (explicitMatch?.[1]) {
    const candidate = explicitMatch[1].trim().toLowerCase();
    if (
      ![
        'de',
        'do',
        'da',
        'para',
        'sobre',
        'ultima',
        'ultimo',
        'anterior',
        'pendente',
        'recente',
      ].includes(candidate)
    ) {
      return explicitMatch[1];
    }
  }

  return null;
}
