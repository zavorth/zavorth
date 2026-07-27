import { StitchClassifiedError, StitchSuccessSummaryInput } from './stitchExecutorTypes.js';

interface StitchErrorLike {
  code?: string;
  message?: string;
  suggestion?: string;
}

type StitchErrorTaxonomyEntry = {
  code: StitchClassifiedError['code'];
  message: string;
  stitchCodes?: string[];
  messageFragments?: string[];
  retriable?: boolean;
};

const STITCH_ERROR_TAXONOMY: StitchErrorTaxonomyEntry[] = [
  {
    code: 'STITCH_OAUTH_REQUIRED',
    message:
      'This host does not have a valid OAuth credential for Stitch yet. Configure STITCH_ACCESS_TOKEN + GOOGLE_CLOUD_PROJECT to use /stitch here.',
    messageFragments: ['api keys are not supported by this api', 'expected oauth2 access token'],
  },
  {
    code: 'STITCH_AUTH_FAILED',
    message: 'Stitch rejected authentication. Check STITCH_API_KEY or STITCH_ACCESS_TOKEN/GOOGLE_CLOUD_PROJECT.',
    stitchCodes: ['AUTH_FAILED'],
    messageFragments: ['api key', 'auth'],
  },
  {
    code: 'STITCH_RATE_LIMITED',
    message: 'Stitch rejected the call due to quota or rate limits. Wait before trying again.',
    stitchCodes: ['RATE_LIMITED'],
    messageFragments: ['rate', 'quota'],
  },
  {
    code: 'STITCH_NETWORK_ERROR',
    message: 'I could not reach Stitch over the network right now.',
    stitchCodes: ['NETWORK_ERROR'],
    retriable: true,
  },
  {
    code: 'STITCH_TIMEOUT',
    message: 'Stitch exceeded the configured time limit for this generation.',
    stitchCodes: ['TIMEOUT'],
    messageFragments: ['timed out', 'request timed out', 'aborterror', 'operation was aborted', 'timeout'],
    retriable: true,
  },
  {
    code: 'STITCH_VALIDATION_ERROR',
    message: 'Stitch rejected the generation parameters.',
    stitchCodes: ['VALIDATION_ERROR'],
  },
  {
    code: 'STITCH_PERMISSION_DENIED',
    message: 'Stitch denied access to this resource for the current authentication.',
    stitchCodes: ['PERMISSION_DENIED'],
  },
];

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
  return Boolean(resolveStitchErrorTaxonomy(code, message)?.retriable);
}

export function formatStitchSuccessSummary(input: StitchSuccessSummaryInput): string {
  const lines = [
    'Stitch finished app generation successfully.',
    `Project: ${input.projectId}`,
    `Screen: ${input.screenId}`,
    `Device: ${input.deviceType}`,
  ];

  if (input.modelId) {
    lines.push(`Model: ${input.modelId}`);
  }

  lines.push('', 'Generated artifacts:');
  if (input.downloadedImagePath) {
    lines.push(`- Local screenshot: ${input.downloadedImagePath}`);
  } else if (input.imageUrl) {
    lines.push(`- Remote screenshot: ${input.imageUrl}`);
  }
  if (input.downloadedHtmlPath) {
    lines.push(`- Local HTML: ${input.downloadedHtmlPath}`);
  } else if (input.htmlUrl) {
    lines.push(`- Remote HTML: ${input.htmlUrl}`);
  }
  if (input.imageUrl) {
    lines.push(`- Image link: ${input.imageUrl}`);
  }
  if (input.htmlUrl) {
    lines.push(`- HTML link: ${input.htmlUrl}`);
  }

  return lines.join('\n');
}

export function classifyStitchError(error: unknown): StitchClassifiedError {
  const stitchErr = asStitchError(error);
  const stitchCode = String(stitchErr.code || '').trim().toUpperCase();
  const stitchSuggestion = String(stitchErr.suggestion || '').trim() || undefined;
  const message = String(stitchErr.message || error || '').trim();
  const normalized = message.toLowerCase();
  const taxonomy = resolveStitchErrorTaxonomy(stitchCode, normalized);

  if (taxonomy) {
    return {
      code: taxonomy.code,
      message: taxonomy.message,
      stderr: message || null,
      suggestion: stitchSuggestion,
    };
  }

  if (stitchCode) {
    return {
      code: `STITCH_${stitchCode}`,
      message: message || 'Stitch failed during generation.',
      stderr: message || null,
      suggestion: stitchSuggestion,
    };
  }

  return {
    code: 'STITCH_ERROR',
    message: message || 'Stitch failed during app generation.',
    stderr: message || null,
  };
}

function resolveStitchErrorTaxonomy(
  stitchCode: string,
  normalizedMessage: string,
): StitchErrorTaxonomyEntry | undefined {
  return STITCH_ERROR_TAXONOMY.find((entry) => {
    if (entry.stitchCodes?.some((code) => code === stitchCode)) {
      return true;
    }
    return entry.messageFragments?.some((fragment) => normalizedMessage.indexOf(fragment) >= 0) || false;
  });
}
