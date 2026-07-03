import type { NaturalLearningCommandIntent } from './SharedSurfaceLearningCommandPack.js';
import type { NaturalMemoryCommandIntent } from './SharedSurfaceMemoryCommandPack.js';

export function normalizeSharedSurfaceNaturalText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function extractSharedSurfaceNaturalChannelId(normalized: string): string | null {
  const channelMatchers: Array<{ id: string; patterns: RegExp[] }> = [
    { id: 'discord', patterns: [/\bdiscord\b/] },
    { id: 'telegram', patterns: [/\btelegram\b/] },
    { id: 'slack', patterns: [/\bslack\b/] },
    { id: 'whatsapp', patterns: [/\bwhatsapp\b/, /\bwhats app\b/, /\bwpp\b/, /\bzap\b/] },
    { id: 'instagram', patterns: [/\binstagram\b/, /\binsta\b/, /\big\b/, /\bdirect\b/, /\bdm do instagram\b/] },
    { id: 'signal', patterns: [/\bsignal\b/] },
    { id: 'imessage', patterns: [/\bimessage\b/, /\bi message\b/, /\bapple messages\b/, /\bmensagens da apple\b/] },
    { id: 'teams', patterns: [/\bmicrosoft teams\b/, /\bteams\b/] },
    { id: 'email', patterns: [/\be-mail\b/, /\bemail\b/, /\bmail\b/] },
    { id: 'web', patterns: [/\bweb\b/, /\bsite\b/, /\bzavorthControl\b/, /\bapp\b/] },
  ];

  for (const entry of channelMatchers) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.id;
    }
  }
  return null;
}

export function formatSharedSurfaceNaturalChannelLabel(channelId: string): string {
  switch (String(channelId || '').trim().toLowerCase()) {
    case 'discord':
      return 'Discord';
    case 'telegram':
      return 'Telegram';
    case 'slack':
      return 'Slack';
    case 'whatsapp':
      return 'WhatsApp';
    case 'instagram':
      return 'Instagram';
    case 'signal':
      return 'Signal';
    case 'imessage':
      return 'iMessage';
    case 'teams':
      return 'Teams';
    case 'email':
      return 'Email';
    case 'web':
      return 'Web';
    default:
      return channelId;
  }
}

export function parseSharedSurfaceNaturalMemoryIntent(rawText: string): NaturalMemoryCommandIntent | null {
  const normalized = normalizeSharedSurfaceNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const mentionsMemoryPlane =
    /\b(memoria|memory|memory plane|retomada|artifact|artifacts|artefato|artefatos|procedimento|procedimentos|procedures)\b/.test(normalized);
  if (!mentionsMemoryPlane || /\bcodex\b/.test(normalized)) {
    return null;
  }

  if (/\b(procure|procurar|buscar|busque|pesquisar|pesquise|search|encontre|ache)\b/.test(normalized)) {
    const query = extractSharedSurfaceNaturalMemoryQuery(rawText);
    if (query) {
      return {
        command: 'memory',
        args: `search ${query}`,
        intro: `Entendi que voce quer procurar "${query}" na memoria do Zavorth.`,
      };
    }
  }

  if (/\b(procedimentos|procedimento|procedures|procedure|playbooks|receitas)\b/.test(normalized)) {
    return {
      command: 'memory',
      args: 'procedures',
      intro: 'Entendi que voce quer abrir a memoria procedural do Zavorth.',
    };
  }

  if (/\b(memory plane|plano de memoria|retomada|replay|artefato|artefatos|artifact|artifacts|entregas)\b/.test(normalized)) {
    return {
      command: 'memoryplane',
      args: '',
      intro: 'Entendi que voce quer ver a memory plane com retomada, replay e entregas.',
    };
  }

  if (/\b(status|estado|mostrar|mostre|ver|overview|painel|visao geral)\b/.test(normalized)) {
    return {
      command: 'memory',
      args: 'status',
      intro: 'Entendi que voce quer ver o estado da memoria do Zavorth.',
    };
  }

  return null;
}

export function parseSharedSurfaceNaturalLearningIntent(rawText: string): NaturalLearningCommandIntent | null {
  const normalized = normalizeSharedSurfaceNaturalText(rawText);
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }

  const candidateId = extractSharedSurfaceNaturalLearningCandidateId(normalized);
  const mentionsLearningPlane =
    /\b(learning|candidate|candidates|candidato|candidatos)\b/.test(normalized);
  if (!mentionsLearningPlane) {
    return null;
  }

  if (candidateId && /\b(promover|promova|promote)\b/.test(normalized)) {
    if (/\b(skill|habilidade)\b/.test(normalized)) {
      return {
        args: `promote-skill ${candidateId}`,
        intro: `Entendi que voce quer promover o candidato ${candidateId} como skill no learning plane.`,
      };
    }
    if (/\b(procedure|procedimento|procedural)\b/.test(normalized)) {
      return {
        args: `promote-procedure ${candidateId}`,
        intro: `Entendi que voce quer promover o candidato ${candidateId} como procedimento no learning plane.`,
      };
    }
    return {
      args: `promote ${candidateId}`,
      intro: `Entendi que voce quer promover o candidato ${candidateId} no learning plane.`,
    };
  }

  if (candidateId && /\b(aprovar|aprova|aprove|approve)\b/.test(normalized)) {
    return {
      args: `approve ${candidateId}`,
      intro: `Entendi que voce quer aprovar o candidato ${candidateId} no learning plane.`,
    };
  }

  if (candidateId && /\b(rejeitar|rejeite|reject|negar|negue)\b/.test(normalized)) {
    return {
      args: `reject ${candidateId}`,
      intro: `Entendi que voce quer rejeitar o candidato ${candidateId} no learning plane.`,
    };
  }

  if (candidateId && /\b(esquecer|esqueca|forget|revogar|revogue)\b/.test(normalized)) {
    return {
      args: `forget ${candidateId}`,
      intro: `Entendi que voce quer esquecer/revogar o candidato ${candidateId} no learning plane.`,
    };
  }

  if (/\b(candidates|candidate|candidatos|candidato)\b/.test(normalized)) {
    return {
      args: 'candidates',
      intro: 'Entendi que voce quer ver os candidatos do learning plane.',
    };
  }

  if (/\b(status|estado|mostrar|mostre|ver|overview|painel)\b/.test(normalized)) {
    return {
      args: 'status',
      intro: 'Entendi que voce quer ver o estado do learning plane.',
    };
  }

  return null;
}

function extractSharedSurfaceNaturalMemoryQuery(rawText: string): string | null {
  const original = String(rawText || '').trim();
  const quoted = original.match(/["'\u201C\u201D\u2018\u2019]([^"'\u201C\u201D\u2018\u2019]+)["'\u201C\u201D\u2018\u2019]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const normalized = normalizeSharedSurfaceNaturalText(rawText);
  const markers = [' por ', ' sobre ', ' de ', ' pra '];
  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index >= 0) {
      const query = normalized.slice(index + marker.length).trim();
      if (query) {
        return query;
      }
    }
  }

  return null;
}

function extractSharedSurfaceNaturalLearningCandidateId(normalized: string): string | null {
  const candidateMatch = normalized.match(/\b(candidate:[a-z0-9._:-]+)\b/i);
  if (candidateMatch?.[1]) {
    return candidateMatch[1];
  }

  const explicitMatch = normalized.match(/\b(?:candidato|candidate)\s+([a-z0-9][a-z0-9._:-]+)\b/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1];
  }

  return null;
}
