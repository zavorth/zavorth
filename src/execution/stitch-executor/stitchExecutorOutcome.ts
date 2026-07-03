import { StitchClassifiedError, StitchSuccessSummaryInput } from './stitchExecutorTypes.js';

interface StitchErrorLike {
  code?: string;
  message?: string;
  suggestion?: string;
}

function asStitchError(error: unknown): StitchErrorLike {
  if (typeof error === 'object' && error !== null) {
    return error as StitchErrorLike;
  }
  return {};
}

export function isRetriableStitchGenerationError(error: unknown): boolean {
  const stitchErr = asStitchError(error);
  const code = String(stitchErr.code || '').trim().toUpperCase();
  const message = String(stitchErr.message || error || '').toLowerCase();
  return (
    code === 'TIMEOUT' ||
    code === 'NETWORK_ERROR' ||
    message.includes('timed out') ||
    message.includes('request timed out') ||
    message.includes('aborterror') ||
    message.includes('operation was aborted')
  );
}

export function formatStitchSuccessSummary(input: StitchSuccessSummaryInput): string {
  const lines = [
    'Stitch concluiu a geracao do app com sucesso.',
    `Projeto: ${input.projectId}`,
    `Tela: ${input.screenId}`,
    `Dispositivo: ${input.deviceType}`,
  ];

  if (input.modelId) {
    lines.push(`Modelo: ${input.modelId}`);
  }

  lines.push('', 'Artefatos gerados:');
  if (input.downloadedImagePath) {
    lines.push(`- Screenshot local: ${input.downloadedImagePath}`);
  } else if (input.imageUrl) {
    lines.push(`- Screenshot remoto: ${input.imageUrl}`);
  }
  if (input.downloadedHtmlPath) {
    lines.push(`- HTML local: ${input.downloadedHtmlPath}`);
  } else if (input.htmlUrl) {
    lines.push(`- HTML remoto: ${input.htmlUrl}`);
  }
  if (input.imageUrl) {
    lines.push(`- Link da imagem: ${input.imageUrl}`);
  }
  if (input.htmlUrl) {
    lines.push(`- Link do HTML: ${input.htmlUrl}`);
  }

  return lines.join('\n');
}

export function classifyStitchError(error: unknown): StitchClassifiedError {
  const stitchErr = asStitchError(error);
  const stitchCode = String(stitchErr.code || '').trim().toUpperCase();
  const stitchSuggestion = String(stitchErr.suggestion || '').trim() || undefined;
  const message = String(stitchErr.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (
    normalized.includes('api keys are not supported by this api') ||
    normalized.includes('expected oauth2 access token')
  ) {
    return {
      code: 'STITCH_OAUTH_REQUIRED',
      message:
        'Este host ainda nao tem uma credencial OAuth valida para o Stitch. Configure STITCH_ACCESS_TOKEN + GOOGLE_CLOUD_PROJECT para usar /stitch aqui.',
      stderr: message || null,
    };
  }

  if (stitchCode) {
    switch (stitchCode) {
      case 'AUTH_FAILED':
        return {
          code: 'STITCH_AUTH_FAILED',
          message:
            'O Stitch rejeitou a autenticacao. Verifique STITCH_API_KEY ou STITCH_ACCESS_TOKEN/GOOGLE_CLOUD_PROJECT.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
      case 'RATE_LIMITED':
        return {
          code: 'STITCH_RATE_LIMITED',
          message: 'O Stitch recusou a chamada por limite de taxa. Aguarde um pouco antes de tentar novamente.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
      case 'NETWORK_ERROR':
        return {
          code: 'STITCH_NETWORK_ERROR',
          message: 'Nao consegui falar com o Stitch pela rede neste momento.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
      case 'VALIDATION_ERROR':
        return {
          code: 'STITCH_VALIDATION_ERROR',
          message: String(stitchErr.message || '') || 'O Stitch recusou os parametros da geracao.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
      case 'PERMISSION_DENIED':
        return {
          code: 'STITCH_PERMISSION_DENIED',
          message: 'O Stitch negou acesso a esse recurso para a autenticacao atual.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
      default:
        return {
          code: `STITCH_${stitchCode}`,
          message: String(stitchErr.message || '') || 'O Stitch falhou durante a geracao.',
          stderr: String(stitchErr.message || ''),
          suggestion: stitchSuggestion,
        };
    }
  }

  if (normalized.includes('api key') || normalized.includes('auth')) {
    return {
      code: 'STITCH_AUTH_FAILED',
      message: 'O Stitch falhou por autenticacao invalida ou ausente.',
      stderr: message || null,
    };
  }
  if (normalized.includes('timeout')) {
    return {
      code: 'STITCH_TIMEOUT',
      message: 'O Stitch excedeu o tempo limite configurado para esta geracao.',
      stderr: message || null,
    };
  }
  if (normalized.includes('rate') || normalized.includes('quota')) {
    return {
      code: 'STITCH_RATE_LIMITED',
      message: 'O Stitch recusou a chamada por quota ou limite de taxa.',
      stderr: message || null,
    };
  }

  return {
    code: 'STITCH_ERROR',
    message: message || 'O Stitch falhou durante a geracao do app.',
    stderr: message || null,
  };
}
